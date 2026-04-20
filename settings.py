import os
from pathlib import Path
from decouple import config

BASE_DIR = Path(__file__).resolve().parent.parent


SECRET_KEY = config('SECRET_KEY')  # No default - must be set in .env

DEBUG = config('DEBUG', default=False, cast=bool)  # Default to False for security

# =============================================================================
# SENTRY ERROR TRACKING
# =============================================================================
# Sentry captures errors, exceptions, and performance data in production.
# Set SENTRY_DSN in .env to enable. Leave empty to disable.
SENTRY_DSN = config('SENTRY_DSN', default='')

if SENTRY_DSN and not DEBUG:
    import sentry_sdk
    from sentry_sdk.integrations.django import DjangoIntegration
    from sentry_sdk.integrations.redis import RedisIntegration
    from sentry_sdk.integrations.celery import CeleryIntegration
    
    sentry_sdk.init(
        dsn=SENTRY_DSN,
        integrations=[
            DjangoIntegration(),
            RedisIntegration(),
            CeleryIntegration(),
        ],
        # Set traces_sample_rate to capture performance data
        traces_sample_rate=0.1,  # 10% of transactions
        # Don't send PII
        send_default_pii=False,
        # Environment name
        environment=config('SENTRY_ENVIRONMENT', default='production'),
    )

# ALLOWED_HOSTS - Domains allowed to serve this Django application
# Read from environment variable for security (prevents Host Header Injection)
ALLOWED_HOSTS = config(
    'ALLOWED_HOSTS',
    default='localhost,127.0.0.1',
    cast=lambda v: [s.strip() for s in v.split(',')]
)

# CSRF Trusted Origins - Domains allowed to make POST requests
CSRF_TRUSTED_ORIGINS = [
    'http://localhost:8000',
    'http://127.0.0.1:8000',
    'https://yisus.fastfoodmaicao.com',
    'http://yisus.fastfoodmaicao.com',
    'https://chat.netdroidsystem.xyz',
    'http://chat.netdroidsystem.xyz',
    'https://www.chat.netdroidsystem.xyz',
    'http://www.chat.netdroidsystem.xyz',

    # Nuevos dominios agregados
    'https://maicao.netdroidsystem.xyz',
    'http://maicao.netdroidsystem.xyz',
    'https://yisus.netdroidsystem.xyz',
    'http://yisus.netdroidsystem.xyz',


        # Dominio de producción actual
        'https://netdroid.fastfoodmaicao.com',
        'http://netdroid.fastfoodmaicao.com',
    ]


import pymysql

pymysql.install_as_MySQLdb()

INSTALLED_APPS = [
    'daphne',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'django.contrib.humanize',
    
    # Our apps
    'apps.accounts',
    'apps.restaurants',
    'apps.orders',
    'apps.chat',
    'apps.core',
    'apps.admin_panel',
    'notifications',
    
    # Third party
    'channels',
    'django_celery_results',  # Celery task result storage
    'django_prometheus',  # Prometheus metrics endpoint
]

MIDDLEWARE = [
    'django_prometheus.middleware.PrometheusBeforeMiddleware',  # FIRST: Start timing
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'apps.core.middleware.security.SessionSecurityMiddleware',  # Custom security middleware
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'django_prometheus.middleware.PrometheusAfterMiddleware',  # LAST: Record metrics
]

ROOT_URLCONF = 'fastfood.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'fastfood.wsgi.application'
ASGI_APPLICATION = 'fastfood.asgi.application'

# Database Configuration - Load from environment variables
# CRITICAL: Database credentials should never be hardcoded
# NOTE: For connection pooling on production servers, consider installing
# django-db-connection-pool (requires mysqlclient compilation)
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.mysql',
        'NAME': config('DB_NAME'),
        'USER': config('DB_USER'),
        'PASSWORD': config('DB_PASSWORD'),
        'HOST': config('DB_HOST', default='127.0.0.1'),
        'PORT': config('DB_PORT', default='3306'),
        'OPTIONS': {
            'charset': 'utf8mb4',
        },
        # CONN_MAX_AGE: reutilizar conexiones para reducir overhead
        # CONN_HEALTH_CHECKS: verifica que la conexión sigue viva antes de reutilizarla
        # Esto soluciona el error de PyMySQL: "Packet sequence number wrong"
        # que ocurre cuando MySQL cierra una conexión inactiva y Django intenta reutilizarla.
        'CONN_MAX_AGE': 60,  # Reducido a 1 min para minimizar conexiones muertas
        'CONN_HEALTH_CHECKS': True,  # ✅ Django 4.1+: ping antes de reutilizar
    }
}

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
        'OPTIONS': {
            'min_length': 8,
        }
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

# Internationalization
LANGUAGE_CODE = 'es-co'

TIME_ZONE = 'America/Bogota'

USE_I18N = True
USE_TZ = True



# Static files (CSS, JavaScript, Images)
STATIC_URL = '/static/'

# STATICFILES_DIRS: carpeta fuente en desarrollo (no usar en producción con collectstatic)
STATICFILES_DIRS = [
    BASE_DIR / 'static',
]

# STATIC_ROOT: destino de 'python manage.py collectstatic'
# Nginx sirve los archivos desde esta carpeta en producción
STATIC_ROOT = BASE_DIR / 'staticfiles'

# WhiteNoise: sirve estáticos comprimidos y con cache busting
# (fallback si Nginx no está configurado para /static/)
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

# Media files
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# File Upload Limits (7MB)
FILE_UPLOAD_MAX_MEMORY_SIZE = 7 * 1024 * 1024  # 7 MB
DATA_UPLOAD_MAX_MEMORY_SIZE = 7 * 1024 * 1024  # 7 MB

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.AutoField'

# Channels configuration
# fastfood/settings.py

# Redis Configuration (from environment)
REDIS_HOST = config('REDIS_HOST', default='127.0.0.1')
REDIS_PORT = config('REDIS_PORT', default=6379, cast=int)

# Channels configuration
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [(REDIS_HOST, REDIS_PORT)],
            "capacity": 1500,
            "expiry": 10,
        },
    },
}

# =============================================================================
# CELERY CONFIGURATION
# =============================================================================
# Celery is used for async task processing to avoid blocking Django workers.
# Tasks include: WebSocket notifications, FCM push, email sending.

CELERY_BROKER_URL = f'redis://{REDIS_HOST}:{REDIS_PORT}/2'
CELERY_RESULT_BACKEND = 'django-db'
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = TIME_ZONE
CELERY_TASK_TRACK_STARTED = True
CELERY_TASK_TIME_LIMIT = 30 * 60  # 30 minutes max per task

# =============================================================================
# CACHE CONFIGURATION
# =============================================================================
# Uses Redis in production, falls back to local memory in development
# if Redis is not available.

# Check if Redis is available
REDIS_AVAILABLE = False
if not DEBUG:
    # In production, always require Redis
    REDIS_AVAILABLE = True
else:
    # In development, check if Redis is running
    try:
        import socket
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(1)
        result = sock.connect_ex((REDIS_HOST, REDIS_PORT))
        REDIS_AVAILABLE = (result == 0)
        sock.close()
    except Exception:
        REDIS_AVAILABLE = False

if REDIS_AVAILABLE:
    # Use Redis cache (production or when Redis is running)
    # OPTIMIZED: Separate Redis DBs for better isolation
    CACHES = {
        'default': {
            'BACKEND': 'django_redis.cache.RedisCache',
            'LOCATION': f'redis://{REDIS_HOST}:{REDIS_PORT}/1',  # DB 1 for cache
            'OPTIONS': {
                'CLIENT_CLASS': 'django_redis.client.DefaultClient',
                'CONNECTION_POOL_KWARGS': {
                    'max_connections': 50,
                    'retry_on_timeout': True,
                },
            },
            'KEY_PREFIX': 'fastfood_cache',
            'TIMEOUT': 300,
        },
        # Separate database for sessions (DB 2)
        'sessions': {
            'BACKEND': 'django_redis.cache.RedisCache',
            'LOCATION': f'redis://{REDIS_HOST}:{REDIS_PORT}/2',  # DB 2 for sessions
            'OPTIONS': {
                'CLIENT_CLASS': 'django_redis.client.DefaultClient',
            },
            'KEY_PREFIX': 'fastfood_session',
            'TIMEOUT': 3600,  # 1 hour session TTL
        },
    }
    # Session backend using dedicated Redis DB
    SESSION_ENGINE = 'django.contrib.sessions.backends.cache'
    SESSION_CACHE_ALIAS = 'sessions'  # Use separate sessions cache
else:
    # Fallback to local memory cache (development without Redis)
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
            'LOCATION': 'unique-snowflake',
            'TIMEOUT': 300,
        }
    }
    # Use database sessions when Redis is not available
    SESSION_ENGINE = 'django.contrib.sessions.backends.db'



# Firebase Cloud Messaging Configuration
FIREBASE_CREDENTIALS_PATH = os.path.join(BASE_DIR, 'fastfood', 'fast-food-maicao-firebase-adminsdk-fbsvc-3033f8181b.json')
FIREBASE_VAPID_KEY = config('FIREBASE_VAPID_KEY', default='')

# URL base del sitio — usada para construir URLs absolutas en notificaciones push
# Configurar en .env: SITE_URL=https://tudominio.com (sin barra final)
#SITE_URL = config('SITE_URL', default='https://yisus.fastfoodmaicao.com')

# =============================================================================
# CLOUDFLARE TURNSTILE CAPTCHA
# =============================================================================
# Configurar en .env: CF_TURNSTILE_SITE_KEY y CF_TURNSTILE_SECRET_KEY
CF_TURNSTILE_SITE_KEY   = config('CF_TURNSTILE_SITE_KEY',   default='')
CF_TURNSTILE_SECRET_KEY = config('CF_TURNSTILE_SECRET_KEY', default='')

# =============================================================================
# SECURITY SETTINGS - Account Lockout (anti fuerza bruta)
# =============================================================================
ACCOUNT_LOCKOUT_ENABLED  = config('ACCOUNT_LOCKOUT_ENABLED',  default=True,  cast=bool)
ACCOUNT_LOCKOUT_ATTEMPTS = config('ACCOUNT_LOCKOUT_ATTEMPTS', default=5,     cast=int)
ACCOUNT_LOCKOUT_DURATION = config('ACCOUNT_LOCKOUT_DURATION', default=900,   cast=int)


# Logging Configuration
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {process:d} {thread:d} {message}',
            'style': '{',
        },
        'simple': {
            'format': '{levelname} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'level': 'INFO',
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
        'security_file': {
            'level': 'INFO',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': BASE_DIR / 'logs' / 'security.log',
            'maxBytes': 10485760,  # 10MB
            'backupCount': 5,
            'formatter': 'verbose',
        },
    },
    'loggers': {
        'django': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': True,
        },
        'apps': {  # Custom logger for our apps
            'handlers': ['console'],
            'level': 'DEBUG',
            'propagate': True,
        },
        'daphne': {
            'handlers': ['console'],
            'level': 'INFO',
        },
        'security': {
            'handlers': ['security_file', 'console'],
            'level': 'INFO',
            'propagate': False,
        },
    },
}


# Authentication
LOGIN_URL = '/accounts/'
LOGIN_REDIRECT_URL = '/accounts/dashboard/'
LOGOUT_REDIRECT_URL = '/accounts/'

# Custom user model (if needed)
AUTH_USER_MODEL = 'auth.User'

# Email configuration (for production)
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'

# ===================== SESSION SECURITY CONFIGURATION =====================
# Comprehensive session security settings to protect user sessions

# Session Cookie Settings
SESSION_COOKIE_AGE = 3600  # 1 hour (3600 seconds)
SESSION_SAVE_EVERY_REQUEST = True  # Refresh session expiry on each request
SESSION_EXPIRE_AT_BROWSER_CLOSE = True  # Clear session when browser closes
SESSION_COOKIE_HTTPONLY = True  # Prevent JavaScript access to session cookie
SESSION_COOKIE_SAMESITE = 'Lax'  # CSRF protection (Lax allows normal navigation)
SESSION_COOKIE_SECURE = not DEBUG  # Automatic: HTTPS only when DEBUG=False

# CSRF Cookie Settings
CSRF_COOKIE_HTTPONLY = False  # Allow JavaScript to read CSRF token for AJAX requests
CSRF_COOKIE_SAMESITE = 'Lax'  # CSRF protection
CSRF_COOKIE_SECURE = not DEBUG  # Automatic: HTTPS only when DEBUG=False


# Security Headers (additional protection)
SECURE_BROWSER_XSS_FILTER = True  # Enable browser XSS filtering
SECURE_CONTENT_TYPE_NOSNIFF = True  # Prevent MIME type sniffing
X_FRAME_OPTIONS = 'DENY'  # Prevent clickjacking

# Production HTTPS Security (active when DEBUG=False)
if not DEBUG:
    SECURE_SSL_REDIRECT = True  # Redirect all HTTP to HTTPS
    SECURE_HSTS_SECONDS = 31536000  # HTTP Strict Transport Security (1 year)
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    # CRÍTICO: le dice a Django que confíe en el header X-Forwarded-Proto de Nginx.
    # Sin esto, Django ve el tráfico interno de Nginx como HTTP y lo redirige
    # en bucle, devolviendo 301 en cada petición desde el proxy.
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

# =============================================================================
# PHASE 2 SECURITY HARDENING (Production Ready)
# =============================================================================
# These settings are configured for production but some are commented for 
# development. Uncomment when deploying to production.

# -----------------------------------------------------------------------------
# Redis Authentication (PRODUCTION)
# -----------------------------------------------------------------------------
# Uncomment and set REDIS_PASSWORD in .env for production
# REDIS_PASSWORD = config('REDIS_PASSWORD', default='')
# 
# When enabled, update all Redis URLs to include password:
# Example: redis://:password@127.0.0.1:6379/1

# -----------------------------------------------------------------------------
# Content Security Policy (CSP)
# -----------------------------------------------------------------------------
# Controls which resources browsers can load, preventing XSS attacks.
# Uncomment for production after testing.

# CSP_DEFAULT_SRC = ("'self'",)
# CSP_SCRIPT_SRC = (
#     "'self'",
#     "'unsafe-inline'",  # Required for inline scripts (consider nonce in future)
#     "https://cdn.jsdelivr.net",
#     "https://www.gstatic.com",
#     "https://www.googletagmanager.com",
# )
# CSP_STYLE_SRC = (
#     "'self'",
#     "'unsafe-inline'",  # Required for inline styles
#     "https://cdn.jsdelivr.net",
#     "https://fonts.googleapis.com",
# )
# CSP_FONT_SRC = (
#     "'self'",
#     "https://fonts.gstatic.com",
#     "https://cdn.jsdelivr.net",
# )
# CSP_IMG_SRC = ("'self'", "data:", "https:", "blob:")
# CSP_CONNECT_SRC = (
#     "'self'",
#     "wss:",  # WebSocket connections
#     "https://fcm.googleapis.com",
#     "https://firebaseinstallations.googleapis.com",
# )
# CSP_FRAME_ANCESTORS = ("'none'",)
# CSP_FORM_ACTION = ("'self'",)

# -----------------------------------------------------------------------------
# Account Lockout Configuration
# -----------------------------------------------------------------------------
# After X failed login attempts, temporarily lock the account.
# Implemented in apps/accounts/views.py login logic.

ACCOUNT_LOCKOUT_ENABLED = True
ACCOUNT_LOCKOUT_ATTEMPTS = 5  # Lock after 5 failed attempts
ACCOUNT_LOCKOUT_DURATION = 15 * 60  # Lock for 15 minutes (in seconds)
ACCOUNT_LOCKOUT_CACHE_PREFIX = 'account_lockout_'

# -----------------------------------------------------------------------------
# Rate Limiting Configuration
# -----------------------------------------------------------------------------
# Global rate limiting thresholds (implemented via cache)

RATE_LIMIT_LOGIN = '10/m'  # 10 login attempts per minute per IP
RATE_LIMIT_REGISTER = '5/m'  # 5 registration attempts per minute per IP
RATE_LIMIT_API = '100/m'  # 100 API calls per minute per user
RATE_LIMIT_ADMIN = '30/m'  # 30 admin actions per minute

# -----------------------------------------------------------------------------
# Referrer Policy
# -----------------------------------------------------------------------------
# Controls how much referrer information is included with requests
SECURE_REFERRER_POLICY = 'strict-origin-when-cross-origin'

# -----------------------------------------------------------------------------
# Additional Security Headers (active when DEBUG=False)
# -----------------------------------------------------------------------------
if not DEBUG:
    # Permissions Policy (formerly Feature-Policy)
    # Restricts access to browser features
    SECURE_PERMISSIONS_POLICY = {
        'geolocation': ['self'],
        'microphone': [],
        'camera': [],
    }

# -----------------------------------------------------------------------------
# Media File Security
# -----------------------------------------------------------------------------
# Sensitive media files (like payment receipts) should require authentication.
# This is implemented in apps/core/views.py with @login_required

PROTECTED_MEDIA_PATHS = [
    'comprobantes/',  # Payment receipts - require login
    'documentos/',    # Documents - require login
]

# =============================================================================
# END SECURITY CONFIGURATION
# =============================================================================
