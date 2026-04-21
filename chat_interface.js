/**
 * Chat Interface - Optimized JavaScript
 * Handles WebSocket communication, message rendering, and file uploads
 */

class ChatInterface {
    constructor(config) {
        this.chatRoomId = config.chatRoomId;
        this.currentUserId = config.currentUserId;
        this.isEmpresa = config.isEmpresa;
        this.csrfToken = config.csrfToken;
        this.uploadUrl = config.uploadUrl;
        this.finalizeUrl = config.finalizeUrl;

        // Web Audio API — sin archivos MP3
        this._audioCtx = null;

        // DOM Elements
        this.messagesContainer = document.getElementById('chat-messages');
        this.messageInput = document.getElementById('chat-message-input');
        this.submitBtn = document.getElementById('chat-message-submit');
        this.statusText = document.getElementById('connection-status');
        this.fileInput = document.getElementById('chat-file-input');
        this.imagePreviewContainer = document.getElementById('image-preview-container');
        this.imagePreview = document.getElementById('image-preview');
        this.isReceiptCheck = document.getElementById('is-receipt-check');

        this.selectedFile = null;
        this.chatSocket = null;

        this.init();
    }

    init() {
        this.connectWebSocket();
        this.attachEventListeners();
        this._initVisualViewport();

        // Scroll al último mensaje al cargar (instant, sin animación)
        if (document.readyState === 'complete') {
            this.scrollToBottom(false);
            this._adjustMessagesHeight();
        } else {
            window.addEventListener('load', () => {
                this.scrollToBottom(false);
                this._adjustMessagesHeight();
            });
        }
    }

    connectWebSocket() {
        // Automatically use wss:// for HTTPS and ws:// for HTTP
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = protocol + '//' + window.location.host + '/ws/chat/' + this.chatRoomId + '/';

        console.log('Connecting to WebSocket:', wsUrl);
        this.chatSocket = new WebSocket(wsUrl);

        this.chatSocket.onopen = (e) => this.handleSocketOpen(e);
        this.chatSocket.onclose = (e) => this.handleSocketClose(e);
        this.chatSocket.onmessage = (e) => this.handleSocketMessage(e);
    }

    handleSocketOpen(e) {
        this.statusText.textContent = 'En línea';
        this.statusText.className = 'small text-success fw-bold';

        // Check for pending product message after connection is established
        this.checkPendingMessage();
    }

    handleSocketClose(e) {
        this.statusText.textContent = 'Desconectado';
        this.statusText.className = 'small text-danger';
    }

    handleSocketMessage(e) {
        const data = JSON.parse(e.data);

        if (data.type === 'chat_message') {
            this.handleNewMessage(data);
        } else if (data.type === 'receipt_update') {
            this.handleReceiptUpdate(data);
        } else if (data.type === 'chat_finalized') {
            console.log('Chat finalizado por:', data.finalized_by);
            this.showFinalizedOverlay();
        }
    }

    checkPendingMessage() {
        const pendingMessage = localStorage.getItem('pendingMessage');
        if (pendingMessage) {
            console.log('[Chat] Found pending message, attempting to send...');

            // Try to send the message
            if (this.chatSocket && this.chatSocket.readyState === WebSocket.OPEN) {
                this.sendMessage(pendingMessage);
                localStorage.removeItem('pendingMessage');
                console.log('[Chat] Pending message sent successfully');
            } else {
                // WebSocket not ready, put message in input field as fallback
                console.log('[Chat] WebSocket not ready, using input fallback');
                if (this.messageInput) {
                    this.messageInput.value = pendingMessage;
                    // Flash the input to draw attention
                    this.messageInput.style.background = '#fef3c7';
                    setTimeout(() => {
                        this.messageInput.style.background = '';
                    }, 2000);
                }
                localStorage.removeItem('pendingMessage');

                // Try to send after a delay when WebSocket might be ready
                setTimeout(() => {
                    if (this.messageInput && this.messageInput.value &&
                        this.chatSocket && this.chatSocket.readyState === WebSocket.OPEN) {
                        console.log('[Chat] Retry: Sending message from input');
                        this.sendMessage(this.messageInput.value);
                        this.messageInput.value = '';
                    }
                }, 1500);
            }
        }
    }

    /**
     * Reproduce un tono del navegador sin archivos MP3.
     * @param {'notification'|'success'} type
     */
    _playTone(type = 'notification') {
        try {
            if (!this._audioCtx) {
                this._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            const ctx = this._audioCtx;
            const now = ctx.currentTime;

            const notes = type === 'success'
                ? [[523, 0], [659, 0.12], [784, 0.24]]   // Do-Mi-Sol ascendente
                : [[880, 0], [660, 0.18]];                // Ding-Dong descendente

            notes.forEach(([freq, delay]) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, now + delay);
                gain.gain.setValueAtTime(0.18, now + delay);
                gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.22);
                osc.start(now + delay);
                osc.stop(now + delay + 0.26);
            });
        } catch (e) {
            console.log('[Chat] Web Audio API unavailable:', e);
        }
    }

    handleNewMessage(data) {
        const emptyState = document.querySelector('.empty-chat-modern');
        if (emptyState) emptyState.remove();

        const isOwn = data.sender_id == this.currentUserId;

        if (!isOwn) {
            this._playTone('notification');
        }

        let contentHtml = '';

        // Image handling
        if (data.image_url) {
            contentHtml = `
                <div class="message-image-container">
                    <img src="${data.image_url}" class="message-img" onclick="showImageModal('${data.image_url}')" alt="Imagen adjunta">
                </div>
            `;

            // Receipt handling
            if (data.is_receipt) {
                let statusBadge = '';
                let actionButtons = '';

                if (data.receipt_status === 'pending') {
                    statusBadge = '<div class="receipt-status pending"><i class="bi bi-clock-history"></i> Revisando pago...</div>';

                    if (this.isEmpresa && !isOwn) {
                        actionButtons = `
                            <div class="receipt-actions" id="actions-${data.message_id}">
                                <button class="btn-approve" onclick="chatInterface.processReceipt(${data.message_id}, 'approve')">
                                    <i class="bi bi-check-lg"></i> Aprobar
                                </button>
                                <button class="btn-reject" onclick="chatInterface.processReceipt(${data.message_id}, 'reject')">
                                    <i class="bi bi-x-lg"></i>
                                </button>
                            </div>
                        `;
                    }
                } else if (data.receipt_status === 'approved') {
                    statusBadge = '<div class="receipt-status approved"><i class="bi bi-check-circle-fill"></i> Pago Aprobado</div>';
                } else if (data.receipt_status === 'rejected') {
                    statusBadge = '<div class="receipt-status rejected"><i class="bi bi-x-circle-fill"></i> Pago Rechazado</div>';
                }

                contentHtml += `<div class="receipt-card-modern">${statusBadge}${actionButtons}</div>`;
            }
        }

        // Add text message if not just an image
        if (data.message && data.message !== '[Imagen adjunta]') {
            contentHtml += `<div class="msg-text">${data.message.replace(/\n/g, '<br>')}</div>`;
        }

        const messageHtml = `
            <div class="msg-wrapper ${isOwn ? 'msg-sent' : 'msg-received'}" id="msg-${data.message_id}">
                <div class="message-bubble-modern">
                    ${!isOwn ? `<div class="msg-sender-name">${data.sender_username}</div>` : ''}
                    ${contentHtml}
                    <div class="msg-footer">
                        <span class="msg-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        ${isOwn ? '<i class="bi bi-check2-all"></i>' : ''}
                    </div>
                </div>
            </div>
        `;

        this.messagesContainer.insertAdjacentHTML('beforeend', messageHtml);
        // Scroll suave al nuevo mensaje (smooth: true)
        this.scrollToBottom(true);
    }

    handleReceiptUpdate(data) {
        const msgElement = document.getElementById(`msg-${data.message_id}`);
        if (!msgElement) return;

        // Remove action buttons
        const actionsDiv = msgElement.querySelector('.receipt-actions');
        if (actionsDiv) actionsDiv.remove();

        // Find the receipt card container
        const receiptCard = msgElement.querySelector('.receipt-card');
        if (receiptCard) {
            let newStatus = '';
            if (data.status === 'approved') {
                newStatus = '<div class="receipt-status approved"><i class="bi bi-check-circle-fill"></i> Pago Aprobado</div>';
                if (!this.isEmpresa) {
                    this._playTone('success');
                    alert('\u00a1Tu comprobante ha sido aprobado! Tu pedido est\u00e1 siendo procesado.');
                }
            } else {
                newStatus = '<div class="receipt-status rejected"><i class="bi bi-x-circle-fill"></i> Pago Rechazado</div>';
                if (!this.isEmpresa) {
                    this._playTone('notification');
                }
            }

            // Replace the old status with the new one
            const oldStatus = receiptCard.querySelector('.receipt-status');
            if (oldStatus) {
                oldStatus.outerHTML = newStatus;
            } else {
                receiptCard.innerHTML = newStatus;
            }
        }
    }

    sendMessage(message) {
        if (this.chatSocket.readyState === WebSocket.OPEN) {
            this.chatSocket.send(JSON.stringify({
                'type': 'chat_message',
                'message': message,
                'sender_id': this.currentUserId,
                'room_id': this.chatRoomId
            }));
        }
    }

    handleFileSelect(input) {
        if (input.files && input.files[0]) {
            this.selectedFile = input.files[0];
            const reader = new FileReader();

            reader.onload = (e) => {
                this.imagePreview.src = e.target.result;
                this.imagePreviewContainer.classList.remove('d-none');
                // Solo reset checkbox si existe y es checkbox
                if (this.isReceiptCheck && this.isReceiptCheck.type === 'checkbox') {
                    this.isReceiptCheck.checked = false;
                }
            };

            reader.readAsDataURL(this.selectedFile);
        }
    }

    toggleTotalInput() {
        // Solo funciona si es checkbox (empresa)
        if (!this.isReceiptCheck || this.isReceiptCheck.type !== 'checkbox') return;

        const isReceipt = this.isReceiptCheck.checked;
        const totalContainer = document.getElementById('total-input-container');
        if (!totalContainer) return;

        if (isReceipt) {
            totalContainer.classList.remove('d-none');
        } else {
            totalContainer.classList.add('d-none');
        }
    }

    cancelImageUpload() {
        this.selectedFile = null;
        this.fileInput.value = '';
        this.imagePreviewContainer.classList.add('d-none');
        // Solo reset si es checkbox
        if (this.isReceiptCheck && this.isReceiptCheck.type === 'checkbox') {
            this.isReceiptCheck.checked = false;
        }
        const totalContainer = document.getElementById('total-input-container');
        const totalInput = document.getElementById('receipt-total-input');
        if (totalContainer) totalContainer.classList.add('d-none');
        if (totalInput) totalInput.value = '';
    }

    uploadFile(file, isReceipt) {
        let receiptTotal = 0;

        // Solo pedir monto si es empresa Y marcó como comprobante
        if (isReceipt && this.isEmpresa) {
            const totalInput = document.getElementById('receipt-total-input');
            if (totalInput) {
                receiptTotal = parseFloat(totalInput.value) || 0;
            }
            // Empresa debe ingresar monto
            if (receiptTotal <= 0) {
                alert('Por favor ingresa el monto del comprobante');
                return;
            }
        }
        // Si es usuario, NO pedir monto, solo marcar como comprobante

        const formData = new FormData();
        formData.append('image', file);
        // IMPORTANTE: Enviar como string 'true' o 'false' para que Python lo reciba correctamente
        formData.append('is_receipt', isReceipt ? 'true' : 'false');
        formData.append('receipt_total', receiptTotal);
        formData.append('csrfmiddlewaretoken', this.csrfToken);

        console.log('[Upload] Sending image, is_receipt:', isReceipt, '-> sending as:', isReceipt ? 'true' : 'false');

        const originalBtnContent = this.submitBtn.innerHTML;
        this.submitBtn.disabled = true;
        this.submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';

        fetch(this.uploadUrl, {
            method: 'POST',
            body: formData
        })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    this.selectedFile = null;
                    this.fileInput.value = '';
                    this.imagePreviewContainer.classList.add('d-none');
                    if (this.isReceiptCheck && this.isReceiptCheck.type === 'checkbox') {
                        this.isReceiptCheck.checked = false;
                    }
                    const totalContainer = document.getElementById('total-input-container');
                    const totalInput = document.getElementById('receipt-total-input');
                    if (totalContainer) totalContainer.classList.add('d-none');
                    if (totalInput) totalInput.value = '';
                } else {
                    alert('Error al subir imagen: ' + data.error);
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert('Error al subir imagen');
            })
            .finally(() => {
                this.submitBtn.disabled = false;
                this.submitBtn.innerHTML = originalBtnContent;
            });
    }

    processReceipt(messageId, action) {
        // Confirmación de seguridad
        const actionText = action === 'approve' ? 'APROBAR' : 'RECHAZAR';
        const confirmMessage = action === 'approve'
            ? '¿Confirmas que el comprobante de pago es válido?\n\nEsto confirmará el pedido del cliente.'
            : '¿Estás seguro de rechazar este comprobante?\n\nEl cliente deberá enviar uno nuevo.';

        if (!confirm(confirmMessage)) {
            return; // Usuario canceló
        }

        // Deshabilitar botones mientras se procesa
        const actionsDiv = document.getElementById(`actions-${messageId}`);
        if (actionsDiv) {
            const buttons = actionsDiv.querySelectorAll('button');
            buttons.forEach(btn => {
                btn.disabled = true;
                if (btn.classList.contains('btn-approve') && action === 'approve') {
                    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
                }
            });
        }

        const formData = new FormData();
        formData.append('action', action);
        formData.append('csrfmiddlewaretoken', this.csrfToken);

        fetch(`/chat/api/receipt/${messageId}/`, {
            method: 'POST',
            body: formData
        })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // ✅ Actualizar la UI directamente, sin depender del WebSocket.
                    // Cuando la empresa entra al chat con el comprobante ya cargado
                    // (renderizado por Django), el WebSocket receipt_update llega bien
                    // al otro usuario pero puede no reflejarse en este DOM.
                    if (actionsDiv) {
                        const receiptCard = actionsDiv.closest('.receipt-card');
                        actionsDiv.remove(); // Quitar botones Aprobar/Rechazar
                        if (receiptCard) {
                            const statusEl = receiptCard.querySelector('.receipt-status');
                            const newHtml = action === 'approve'
                                ? '<div class="receipt-status approved"><i class="bi bi-check-circle-fill"></i> Pago Aprobado</div>'
                                : '<div class="receipt-status rejected"><i class="bi bi-x-circle-fill"></i> Pago Rechazado</div>';
                            if (statusEl) {
                                statusEl.outerHTML = newHtml;
                            } else {
                                receiptCard.insertAdjacentHTML('afterbegin', newHtml);
                            }
                        }
                    }
                } else {
                    alert('Error al procesar comprobante: ' + data.error);
                    // Rehabilitar botones si hay error del servidor
                    if (actionsDiv) {
                        const buttons = actionsDiv.querySelectorAll('button');
                        buttons.forEach(btn => btn.disabled = false);
                    }
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert('Error de conexión');
                // Rehabilitar botones si hay error de red
                if (actionsDiv) {
                    const buttons = actionsDiv.querySelectorAll('button');
                    buttons.forEach(btn => btn.disabled = false);
                }
            });
    }

    finalizarChat() {
        if (!confirm('¿Estás seguro de que deseas finalizar este chat? Se eliminarán todos los mensajes.')) return;

        // Deshabilitar el enlace del menú para evitar doble click
        const finalizeLink = document.querySelector('[onclick="finalizarChat()"]');
        if (finalizeLink) {
            finalizeLink.style.pointerEvents = 'none';
            finalizeLink.style.opacity = '0.6';
            finalizeLink.innerHTML = '<i class="bi bi-hourglass-split me-2"></i> Finalizando...';
        }

        fetch(this.finalizeUrl, {
            method: 'POST',
            headers: {
                'X-CSRFToken': this.csrfToken,
                'Content-Type': 'application/json'
            }
        })
            .then(response => {
                if (!response.ok) {
                    return response.json().catch(() => {
                        throw new Error(`Error del servidor: ${response.status}`);
                    }).then(data => {
                        throw new Error(data.error || `Error del servidor: ${response.status}`);
                    });
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    this.showFinalizedOverlay();
                } else {
                    throw new Error(data.error || 'Error al finalizar el chat');
                }
            })
            .catch(error => {
                console.error('[Chat] finalizarChat error:', error);
                alert('No se pudo finalizar el chat: ' + error.message);
                // Rehabilitar el enlace
                if (finalizeLink) {
                    finalizeLink.style.pointerEvents = '';
                    finalizeLink.style.opacity = '';
                    finalizeLink.innerHTML = '<i class="bi bi-x-circle me-2"></i> Finalizar chat';
                }
            });
    }

    showFinalizedOverlay() {
        if (this.messageInput) {
            this.messageInput.disabled = true;
            this.messageInput.placeholder = 'Chat finalizado';
        }
        if (this.submitBtn) this.submitBtn.disabled = true;

        const overlay = document.getElementById('chat-finalized-overlay');
        if (overlay) {
            overlay.classList.remove('d-none');
            overlay.classList.add('d-flex');
        }
    }

    /**
     * Desplaza el contenedor al último mensaje.
     * Usa requestAnimationFrame para ejecutar después del repintado del browser,
     * garantizando que el scroll sea correcto incluso cuando se añaden mensajes dinámicamente.
     * @param {boolean} smooth - Si true, usa scroll animado (para mensajes nuevos).
     *                           Si false, salta directo (para carga inicial de la página).
     */
    scrollToBottom(smooth = false) {
        requestAnimationFrame(() => {
            if (!this.messagesContainer) return;
            this.messagesContainer.scrollTo({
                top: this.messagesContainer.scrollHeight,
                behavior: smooth ? 'smooth' : 'instant'
            });
        });
    }

    /**
     * PUNTO 1 fix: Mide la altura REAL del navbar en px y la escribe como
     * variable CSS --navbar-h en :root. Esto hace que el cálculo
     * height: calc(100dvh - var(--navbar-h)) sea exacto en cualquier device.
     */
    _measureNavbarHeight() {
        const navbar = document.querySelector('.ff-navbar');
        if (!navbar) return;
        const h = navbar.getBoundingClientRect().height;
        document.documentElement.style.setProperty('--navbar-h', `${Math.ceil(h)}px`);
        console.log('[Chat] Navbar height measured:', Math.ceil(h) + 'px');
    }

    /**
     * PUNTO 4 fix: Mide la altura REAL del input area fijo y la aplica como
     * padding-bottom en el contenedor de mensajes. Usa .chat-input-modern
     * (nombre correcto del elemento en el HTML).
     */
    _adjustMessagesHeight() {
        // CORRECCIÓN: el elemento se llama .chat-input-modern, no .chat-input-area
        const inputArea = document.querySelector('.chat-input-modern');
        if (!inputArea || !this.messagesContainer) return;

        const isMobile = window.innerWidth <= 900;
        if (!isMobile) {
            this.messagesContainer.style.paddingBottom = '';
            return;
        }

        const inputHeight = inputArea.getBoundingClientRect().height;
        const padding = Math.ceil(inputHeight) + 8;
        this.messagesContainer.style.paddingBottom = padding + 'px';
        this.scrollToBottom();
    }

    attachEventListeners() {
        this.submitBtn.onclick = () => {
            const message = this.messageInput.value.trim();

            if (this.selectedFile) {
                // Determinar si es comprobante:
                // - Usuario: SIEMPRE es comprobante (hidden input con value="true")
                // - Empresa: solo si marcó el checkbox
                let isReceipt = false;
                if (this.isReceiptCheck) {
                    if (this.isReceiptCheck.type === 'checkbox') {
                        isReceipt = this.isReceiptCheck.checked;
                    } else {
                        // Hidden input - siempre es comprobante para usuario
                        isReceipt = this.isReceiptCheck.value === 'true';
                    }
                }

                this.uploadFile(this.selectedFile, isReceipt);
                if (message) {
                    this.sendMessage(message);
                    this.messageInput.value = '';
                }
            } else if (message) {
                this.sendMessage(message);
                this.messageInput.value = '';
                this.messageInput.focus();
            }
        };

        this.messageInput.onkeyup = (e) => {
            if (e.key === 'Enter' && !this.selectedFile) {
                this.submitBtn.click();
            }
        };
    }

    /**
     * PUNTO 4 — Visual Viewport API:
     * Mantiene el input visible cuando el teclado virtual se abre en Android/iOS.
     * El viewport se encoge pero el layout no sabe de eso sin esta API.
     * Patrón usado por WhatsApp Web, Telegram Web, etc.
     * CORRECCIÓN: usa .chat-input-modern (nombre real del elemento en el HTML).
     */
    _initVisualViewport() {
        if (!window.visualViewport) return;

        // CORRECCIÓN: .chat-input-modern existe, .chat-input-area no existe
        const inputArea = document.querySelector('.chat-input-modern');
        if (!inputArea) {
            console.warn('[Chat] .chat-input-modern not found — keyboard fix disabled');
            return;
        }

        const isMobile = () => window.innerWidth <= 768;

        const onViewportChange = () => {
            if (!isMobile()) {
                inputArea.style.transform = '';
                this._adjustMessagesHeight();
                return;
            }

            const viewport = window.visualViewport;
            const offsetBottom = window.innerHeight - viewport.height - viewport.offsetTop;

            if (offsetBottom > 10) {
                // Teclado abierto: elevar el input para que no quede tapado
                inputArea.style.transform = `translateY(-${offsetBottom}px)`;
            } else {
                // Teclado cerrado: restaurar posición
                inputArea.style.transform = '';
            }

            requestAnimationFrame(() => this._adjustMessagesHeight());
        };

        window.visualViewport.addEventListener('resize', onViewportChange);
        window.visualViewport.addEventListener('scroll', onViewportChange);
        window.addEventListener('resize', () => {
            requestAnimationFrame(() => this._adjustMessagesHeight());
        });
    }
}

// Utility function for image modal
function showImageModal(imageUrl) {
    const modal = new bootstrap.Modal(document.getElementById('imageZoomModal'));
    document.getElementById('zoomedImage').src = imageUrl;
    modal.show();
}

// Global instance (will be initialized from template)
let chatInterface = null;
