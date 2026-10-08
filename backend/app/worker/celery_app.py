from celery import Celery
from app.core.config import settings
import urllib.parse

# Safely encode credentials
if settings.REDIS_URL:
    redis_url = settings.REDIS_URL
else:
    password = urllib.parse.quote_plus(settings.REDIS_PASSWORD) if settings.REDIS_PASSWORD else ""
    username = urllib.parse.quote_plus(settings.REDIS_USERNAME) if settings.REDIS_USERNAME else ""

    if username and password:
        redis_url = f"rediss://{username}:{password}@{settings.REDIS_HOST}:{settings.REDIS_PORT}/0"
    elif password:
        redis_url = f"rediss://:{password}@{settings.REDIS_HOST}:{settings.REDIS_PORT}/0"
    else:
        redis_url = f"redis://{settings.REDIS_HOST}:{settings.REDIS_PORT}/0"

celery_app = Celery("worker", broker=redis_url, backend=redis_url)

# Make sure tasks are discovered
celery_app.autodiscover_tasks(['app.worker.tasks'])

@celery_app.task
def dummy_task():
    return True
