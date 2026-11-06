import os
from celery import Celery
from django.conf import settings

# Set default Django settings module for Celery
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

app = Celery('sprintsync')

# Read config from Django settings with namespace 'CELERY'
app.config_from_object('django.conf:settings', namespace='CELERY')

# Auto-discover tasks in installed apps
app.autodiscover_tasks(['apps.notifications', 'apps.webhooks'])


@app.task(bind=True, ignore_result=True)
def debug_task(self):
    print(f'Celery Debug Request: {self.request!r}')
