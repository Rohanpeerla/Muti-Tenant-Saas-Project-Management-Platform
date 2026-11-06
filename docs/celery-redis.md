# Celery & Redis Background Task Architecture

## 1. Overview
SprintSync utilizes **Celery** backed by **Redis** for asynchronous job processing, non-blocking email delivery, scheduled reminders, and webhook event dispatches.

---

## 2. Configuration Settings

### `backend/config/celery.py`
```python
import os
from celery import Celery
from django.conf import settings

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
app = Celery('sprintsync')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks(['apps.notifications', 'apps.webhooks'])
```

### Environment Variables
```env
REDIS_URL=redis://localhost:6379/0
CELERY_TASK_ALWAYS_EAGER=False
```

### Django Settings (`backend/config/settings.py`)
- `CELERY_BROKER_URL`: Configured via `REDIS_URL` (default `redis://localhost:6379/0`).
- `CELERY_RESULT_BACKEND`: Same Redis database.
- `CELERY_ACCEPT_CONTENT`: Restricted strictly to `['json']`.
- `CELERY_TASK_SERIALIZER`: `'json'`.
- `CELERY_RESULT_SERIALIZER`: `'json'`.
- `CELERY_TIMEZONE`: Synchronized with Django's `TIME_ZONE` (`UTC`).
- `CELERY_TASK_TIME_LIMIT`: 1,800 seconds (30 minutes).
- `CELERY_RESULT_EXPIRES`: 86,400 seconds (24 hours).

---

## 3. Local Development on Windows

### 1. Starting Redis
Redis can be run on Windows via any of the following local mechanisms (no external paid cloud service required):
- **WSL (Recommended)**:
  ```bash
  wsl sudo service redis-server start
  ```
- **Docker**:
  ```powershell
  docker run -d --name sprintsync-redis -p 6379:6379 redis:alpine
  ```
- **Native Windows / Memurai**:
  Download and run Memurai Developer Edition or Redis for Windows on port 6379.

### 2. Starting Celery Worker on Windows
On Windows, standard `prefork` pool is not supported by billiard. Use the `solo` pool:
```powershell
cd backend
.\venv\Scripts\celery.exe -A config worker -l info -P solo
```

### 3. Starting Celery Beat Scheduler
In a separate terminal:
```powershell
cd backend
.\venv\Scripts\celery.exe -A config beat -l info
```

---

## 4. Testing Strategy
Automated unit tests use `@override_settings(CELERY_TASK_ALWAYS_EAGER=True, CELERY_TASK_EAGER_PROPAGATES=True)`.
This executes background tasks synchronously during tests without requiring an active external Redis service.

