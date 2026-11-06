# SprintSync – Windows Local Setup Guide (Without Docker)

This guide provides instructions to run the entire **SprintSync** application stack locally on Windows directly using native processes (PowerShell, Python, Node.js, PostgreSQL 16, and Redis), completely free of Docker.

---

## 1. System Requirements & Prerequisites

Ensure the following software packages are installed on your Windows machine:
- **Operating System**: Windows 10 / 11 (64-bit)
- **PowerShell**: Version 5.1 or PowerShell 7+
- **Python**: 3.12+ (added to System PATH)
- **Node.js**: v18+ or v20+ LTS (with npm)
- **PostgreSQL**: 16+ running on local port `5432`
- **Redis**: Local Redis for Windows (or via Memurai / Redis on WSL) running on port `6379`

---

## 2. PostgreSQL 16 Configuration

### Verify PostgreSQL Service Status
In an Administrator PowerShell terminal:
```powershell
Get-Service -Name postgresql*
```

If the service is stopped, start it:
```powershell
Start-Service -Name "postgresql-x64-16"
```

### Verify Database Connectivity & Create Database
Test connectivity using `psql` (adjust path if installed in standard directory):
```powershell
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -h localhost -p 5432 -c "SELECT version();"
```

If the database `project_management_db` does not exist yet:
```powershell
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -h localhost -p 5432 -c "CREATE DATABASE project_management_db;"
```

---

## 3. Redis Setup

SprintSync uses Redis for Celery asynchronous tasks, scheduled jobs, and caching.

### Verify Redis Availability
Verify that Redis is listening on port `6379`:
```powershell
Test-NetConnection -ComputerName localhost -Port 6379
```

If you are using Redis for Windows or Memurai:
```powershell
# If running as a Windows service:
Get-Service -Name *redis* # or memurai
Start-Service -Name redis

# Or test via redis-cli:
redis-cli ping
# Expected response: PONG
```

*(Note: In local development, if Redis is temporarily stopped, Django will still handle standard web traffic; asynchronous webhook deliveries or scheduled cleanup jobs will queue or run synchronously when `CELERY_TASK_ALWAYS_EAGER=True` is enabled in `backend/.env`.)*

---

## 4. Backend Setup (Django & DRF)

Open a PowerShell terminal and navigate to the project root:

```powershell
cd "c:\Users\sairo\Downloads\Desktop\Multi-Tenant SaaS Project Management Platform"

# 1. Activate the Python virtual environment
.\backend\venv\Scripts\Activate.ps1

# 2. Verify / Install backend dependencies
pip install -r backend\requirements.txt

# 3. Configure backend environment file
# If backend\.env does not exist:
Copy-Item backend\.env.example backend\.env
# Inspect and configure backend\.env with your database credentials if different from default.

# 4. Apply database migrations
python backend\manage.py migrate

# 5. Seed initial subscription plans (Free, Pro, Business)
python backend\manage.py seed_plans

# 6. Verify Django system checks
python backend\manage.py check

# 7. Start the Django development server
python backend\manage.py runserver 127.0.0.1:8000
```
The backend API is now running at: **http://127.0.0.1:8000/**

---

## 5. Celery Worker (Windows Compatible)

Open a **second** PowerShell terminal to run asynchronous tasks (e.g. webhook delivery, notifications):

```powershell
cd "c:\Users\sairo\Downloads\Desktop\Multi-Tenant SaaS Project Management Platform"

# Activate environment
.\backend\venv\Scripts\Activate.ps1

# Run Celery worker with the Windows-safe solo pool
celery -A config worker -l info --pool=solo --workdir=backend
```

> **Why `--pool=solo`?** Windows does not support Unix `fork()`. The `solo` execution pool executes tasks within the main worker thread safely without process-fork errors.

---

## 6. Celery Beat (Scheduled Jobs)

Open a **third** PowerShell terminal if you want periodic background jobs (e.g. daily webhook delivery cleanup, notification purge):

```powershell
cd "c:\Users\sairo\Downloads\Desktop\Multi-Tenant SaaS Project Management Platform"

# Activate environment
.\backend\venv\Scripts\Activate.ps1

# Start Celery Beat scheduler
celery -A config beat -l info --workdir=backend
```

---

## 7. Frontend Setup (React, Vite & Tailwind)

Open a **fourth** PowerShell terminal for the frontend user interface:

```powershell
cd "c:\Users\sairo\Downloads\Desktop\Multi-Tenant SaaS Project Management Platform\frontend"

# 1. Install dependencies
npm ci

# 2. Configure frontend environment
if (-not (Test-Path .env)) { Copy-Item .env.example .env }

# 3. Start the Vite development server
npm run dev
```

The frontend client will open at: **http://localhost:5173/**

To test the production build locally:
```powershell
npm run build
npm run preview
```

---

## 8. Application Access & URLs

| Service / Interface | Local URL | Description |
|---|---|---|
| **Frontend Application** | `http://localhost:5173/` | React SPA dashboard, Kanban boards, Sprints, Billing |
| **Backend REST API** | `http://localhost:8000/api/` | DRF endpoints (auth, workspaces, projects, billing) |
| **Health Check** | `http://localhost:8000/api/health/?detailed=true` | Detailed DB & Redis connection health |
| **Django Admin** | `http://localhost:8000/admin/` | Superuser management portal |
| **Pricing & Plans** | `http://localhost:5173/pricing` | Subscription tiers & feature comparison |

---

## 9. Stopping Local Services

To gracefully terminate services:
- Press `Ctrl + C` in each respective terminal window.
- If background processes persist:
  ```powershell
  Stop-Process -Name python -Force -ErrorAction SilentlyContinue
  Stop-Process -Name node -Force -ErrorAction SilentlyContinue
  ```

