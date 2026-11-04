# Multi-Tenant SaaS Project Management Platform

A production-style Multi-Tenant SaaS Project Management Platform built with React, Vite, Tailwind CSS, Django REST Framework, and PostgreSQL. Designed to support multiple organizations (workspaces), project planning, agile sprints, Kanban workflow boards, and subscription tiers.

---

## Technology Stack

### Frontend
- **Framework**: React 18
- **Build Tool**: Vite 6
- **Routing**: React Router DOM 6
- **Styling**: Tailwind CSS 4
- **HTTP Client**: Axios

### Backend
- **Language**: Python 3.12+
- **Framework**: Django 6
- **API Engine**: Django REST Framework (DRF)
- **Authentication (Future Stage)**: DRF Simple JWT
- **CORS Handling**: `django-cors-headers`
- **Database Driver**: `psycopg` (v3 with binary bindings)
- **Environment Management**: `python-dotenv`

### Database
- **Primary Database**: PostgreSQL 16
- **Database Name**: `project_management_db`
- **Host / Port**: `localhost:5432`

### Planned for Future Stages
- **Task Queue & Caching**: Celery + Redis
- **Interactivity**: `@dnd-kit` (Kanban drag-and-drop)
- **Billing**: Stripe Test Mode
- **DevOps**: Docker, Docker Compose, GitHub Actions CI/CD

---

## Prerequisites

Before running the project locally, verify the following installed tools:
- **Python**: 3.12+
- **Node.js**: v18+ (tested with v24)
- **npm**: v9+ (tested with v11)
- **PostgreSQL**: 16+ running on port `5432`
- **Git**: 2.x+

---

## Project Structure

```text
Multi-Tenant SaaS Project Management Platform/
│
├── backend/
│   ├── apps/
│   │   ├── __init__.py
│   │   └── core/
│   │       ├── __init__.py
│   │       ├── apps.py
│   │       ├── tests.py
│   │       ├── urls.py
│   │       └── views.py
│   ├── config/
│   │   ├── __init__.py
│   │   ├── asgi.py
│   │   ├── settings.py
│   │   ├── urls.py
│   │   └── wsgi.py
│   ├── venv/                       # Excluded via .gitignore
│   ├── requirements.txt
│   ├── manage.py
│   ├── .env.example
│   ├── .env                        # Excluded via .gitignore
│   └── .gitignore
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── assets/
│   │   ├── components/
│   │   │   └── Navbar.jsx
│   │   ├── context/
│   │   ├── hooks/
│   │   ├── layouts/
│   │   ├── pages/
│   │   │   └── Home.jsx
│   │   ├── services/
│   │   │   └── api.js
│   │   ├── App.jsx
│   │   ├── index.css
│   │   └── main.jsx
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   ├── .env.example
│   ├── .env                        # Excluded via .gitignore
│   └── .gitignore
│
├── docs/
│   └── database-setup.md
│
├── .gitignore
└── README.md
```

---

## Setup & Installation

### 1. Backend Setup

1. Open PowerShell and navigate to `backend/`:
   ```powershell
   cd backend
   ```

2. Activate the virtual environment:
   ```powershell
   .\venv\Scripts\Activate.ps1
   ```

3. Configure your local environment variables:
   - Copy `.env.example` to `.env` (if not already done).
   - Update database credentials (`DB_PASSWORD`):
   ```env
   SECRET_KEY=your_django_secret_key_here
   DEBUG=True
   ALLOWED_HOSTS=localhost,127.0.0.1

   DB_ENGINE=django.db.backends.postgresql
   DB_NAME=project_management_db
   DB_USER=postgres
   DB_PASSWORD=your_postgres_password
   DB_HOST=localhost
   DB_PORT=5432

   CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
   ```

4. Verify Django system checks:
   ```powershell
   .\venv\Scripts\python.exe manage.py check
   ```

5. Run database migrations:
   ```powershell
   .\venv\Scripts\python.exe manage.py migrate
   ```

6. Start the Django development server:
   ```powershell
   .\venv\Scripts\python.exe manage.py runserver 8000
   ```

The backend API will be accessible at `http://localhost:8000`.

---

### 2. Frontend Setup

1. Open a second PowerShell terminal and navigate to `frontend/`:
   ```powershell
   cd frontend
   ```

2. Confirm `.env` configuration:
   ```env
   VITE_API_URL=http://localhost:8000
   ```

3. Build the frontend for production:
   ```powershell
   npm run build
   ```

4. Start the Vite development server:
   ```powershell
   npm run dev
   ```

The client application will run at `http://localhost:5173`.

---

### 3. PostgreSQL Database Setup

Refer to [`docs/database-setup.md`](docs/database-setup.md) for full instructions on creating the database using `psql` or `pgAdmin 4`.

Quick psql command:
```sql
CREATE DATABASE project_management_db;
```

---

## Health Endpoint Verification

- **URL**: `GET http://localhost:8000/api/health/`
- **Response**:
  ```json
  {
    "status": "success",
    "message": "Project Management API is running"
  }
  ```

The landing page features an automated live health indicator card that pings this endpoint via Axios.

---

## Current Implementation Status (Stage 1)

| Area | Component | Status |
|---|---|---|
| Backend | Virtual Environment & Dependencies | Completed |
| Backend | DRF & JWT Configuration | Completed |
| Backend | CORS Middleware & Allowed Origins | Completed |
| Backend | Environment-Driven PostgreSQL Settings | Completed |
| Backend | Health Check API (`/api/health/`) | Completed & Verified |
| Frontend | React 18 + Vite Setup | Completed |
| Frontend | Tailwind CSS 4 Integration | Completed |
| Frontend | Axios Client with Environment Base URL | Completed |
| Frontend | Modern SaaS Landing Page & Navbar | Completed |
| Frontend | Live API Health Ping Component | Completed |
| DevOps & Git | Clean `.gitignore` & Repository Init | Completed |

