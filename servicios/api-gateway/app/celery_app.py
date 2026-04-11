from celery import Celery
from app.config import settings

celery_app = Celery(
    "asm",
    broker=settings.celery_broker_url,
    backend=None,
)

celery_app.conf.task_routes = {
    "worker_scanner.tasks.*": {"queue": "scanner"},
    "worker_report.tasks.*": {"queue": "report"},
}
