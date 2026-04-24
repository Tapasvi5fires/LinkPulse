from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "worker", 
    broker="redis://localhost:6379/1", # Hardcoded default for safety
    backend="redis://localhost:6379/2"
)

# Optional: Try to load from settings if they are uncommented
try:
    if hasattr(settings, "CELERY_BROKER_URL") and settings.CELERY_BROKER_URL:
        celery_app.conf.broker_url = settings.CELERY_BROKER_URL
    if hasattr(settings, "CELERY_RESULT_BACKEND") and settings.CELERY_RESULT_BACKEND:
        celery_app.conf.result_backend = settings.CELERY_RESULT_BACKEND
except Exception:
    pass

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    broker_pool_limit=1,
    broker_connection_retry_on_startup=True,
    visibility_timeout=3600,
)

# Fix for Upstash/SSL Redis
try:
    broker_url = getattr(settings, "CELERY_BROKER_URL", "")
    if broker_url and "rediss://" in broker_url:
        celery_app.conf.broker_use_ssl = {'ssl_cert_reqs': 0}
        celery_app.conf.redis_backend_use_ssl = {'ssl_cert_reqs': 0}
except Exception:
    pass

celery_app.conf.task_routes = {
    "app.workers.*": "main-queue",
}
