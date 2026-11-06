# Environment Configuration Reference

SprintSync uses environment variables for all sensitive keys, runtime configurations, database connections, and external service credentials.

---

## 1. Backend Environment Variables (`backend/.env` / Docker `.env`)

### Django Core Settings

| Variable | Default Value | Description |
|---|---|---|
| `DJANGO_SECRET_KEY` | *(Django insecure key for dev)* | Secret key used for cryptographic signing. Generate 50+ random characters in production. |
| `DJANGO_DEBUG` / `DEBUG` | `True` | Set to `False` in all staging and production deployments. |
| `ALLOWED_HOSTS` | `*` | Comma-separated list of allowed host/domain names. |
| `CSRF_TRUSTED_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Comma-separated list of origins trusted for CSRF protection. |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Comma-separated list of browser origins permitted to make cross-site HTTP requests. |

### Database Configuration

| Variable | Default Value | Description |
|---|---|---|
| `DATABASE_URL` | *(None)* | Standard PostgreSQL connection URL (e.g. `postgresql://user:pass@host:5432/dbname`). If provided, overrides individual `DB_*` vars. |
| `DB_NAME` | `project_management_db` | PostgreSQL database name. |
| `DB_USER` | `postgres` | PostgreSQL username. |
| `DB_PASSWORD` | `postgres` | PostgreSQL password. |
| `DB_HOST` | `localhost` (`db` in Docker) | Hostname or IP address of the database server. |
| `DB_PORT` | `5432` | PostgreSQL port number. |

### Redis & Celery Configuration

| Variable | Default Value | Description |
|---|---|---|
| `REDIS_URL` | `redis://localhost:6379/0` (`redis://redis:6379/0` in Docker) | Redis connection URL used for caching. |
| `CELERY_BROKER_URL` | `redis://localhost:6379/0` (`redis://redis:6379/0` in Docker) | Message broker URL for Celery async tasks. |
| `CELERY_RESULT_BACKEND` | `redis://localhost:6379/0` | Result backend for task execution results. |

### Stripe Payments & Billing

| Variable | Default Value | Description |
|---|---|---|
| `STRIPE_PUBLIC_KEY` | `pk_test_placeholder` | Stripe publishable key for client-side Stripe Elements. |
| `STRIPE_SECRET_KEY` | `sk_test_placeholder` | Stripe secret key for backend API requests. |
| `STRIPE_WEBHOOK_SECRET` | `whsec_placeholder` | Stripe webhook signing secret for signature verification. |

### Production Security Flags

| Variable | Default Value | Description |
|---|---|---|
| `SECURE_SSL_REDIRECT` | `False` | Redirects all HTTP requests to HTTPS when `DEBUG=False`. |
| `SESSION_COOKIE_SECURE` | `False` | Ensures session cookies are only sent over HTTPS. |
| `CSRF_COOKIE_SECURE` | `False` | Ensures CSRF cookies are only sent over HTTPS. |
| `SECURE_HSTS_SECONDS` | `0` | Enables HTTP Strict Transport Security with the specified duration in seconds. |

---

## 2. Frontend Environment Variables (`frontend/.env`)

| Variable | Default Value | Description |
|---|---|---|
| `VITE_API_URL` | `http://localhost:8000/api` | Base URL for REST API endpoints. In Docker Compose production, set to `/api` to use the Nginx reverse proxy. |
| `VITE_STRIPE_PUBLIC_KEY` | `pk_test_placeholder` | Stripe publishable key loaded by `@stripe/stripe-js`. |

