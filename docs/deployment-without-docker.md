# SprintSync – Production Deployment Without Docker

This guide details how to deploy SprintSync directly onto cloud hosting providers or Virtual Private Servers (VPS) without relying on Docker containers.

---

## 1. Architecture Overview (Bare-Metal / Host-Native)

```mermaid
flowchart TD
    Users[Users / Web Browsers] --> CDN[Cloudflare / DNS / SSL]
    CDN --> StaticHost[Vercel / Netlify / Cloudflare Pages: Frontend SPA]
    CDN --> ReverseProxy[Nginx Host Reverse Proxy: Port 80/443]
    
    subgraph "Application Host (Ubuntu 22.04 LTS / 24.04 LTS)"
        ReverseProxy -->|Proxy /api/ & /admin/| Gunicorn[Gunicorn WSGI: 127.0.0.1:8000]
        Gunicorn --> DjangoCore[Django 6 + DRF Core Engine]
        WhiteNoise[WhiteNoise Static Handler] -.-> Gunicorn
        
        SystemdWorker[systemd: sprintsync-worker] --> CeleryWorker[Celery Worker Service]
        SystemdBeat[systemd: sprintsync-beat] --> CeleryBeat[Celery Beat Scheduler]
    end

    subgraph "Managed Data Tier"
        DjangoCore --> Postgres[(Managed PostgreSQL 16: Supabase / RDS / Neon)]
        DjangoCore --> Redis[(Managed Redis 7: Upstash / Redis Cloud)]
        CeleryWorker --> Postgres
        CeleryWorker --> Redis
        CeleryBeat --> Redis
    end

    subgraph "Third-Party APIs"
        DjangoCore <--> StripeAPI[Stripe Payments & Webhooks]
        CeleryWorker --> WebhookEndpoints[Customer Webhook URLs]
    end
```

---

## 2. Cloud Hosting Provider Comparison

| Tier / Category | Frontend Options | Backend Options | Database & Redis Options |
|---|---|---|---|
| **Free / Hobby Tier** | **Vercel**, **Netlify**, **Cloudflare Pages** (Free SSL, global CDN) | **Render Free Web Service**, **Fly.io** (free allowance), **Railway** ($5 credit) | **Neon.tech** (PostgreSQL free tier), **Supabase** (Postgres free), **Upstash** (Redis free tier) |
| **Paid / Production VPS** | **Hetzner Cloud** (~€4/mo), **DigitalOcean Droplet** ($6/mo), **Linode/Akamai** ($5/mo) | Same VPS hosting Nginx + Gunicorn + Celery | Local PostgreSQL 16 + Redis 7 on the same VPS, or managed DB |
| **Enterprise / Managed** | **AWS CloudFront + S3** | **AWS Elastic Beanstalk** / **Render Pro** | **AWS RDS PostgreSQL** + **AWS ElastiCache Redis** |

---

## 3. Frontend Deployment (Vercel / Netlify / Cloudflare Pages)

1. Connect your GitHub repository to **Vercel** or **Netlify**.
2. Set configuration:
   - **Framework Preset**: Vite
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
3. Add Environment Variables:
   - `VITE_API_URL`: `https://api.yourdomain.com/api`
   - `VITE_STRIPE_PUBLIC_KEY`: `pk_test_...` (or production key)
4. Configure SPA fallback rewriting:
   - For Netlify: create `frontend/public/_redirects` containing: `/* /index.html 200`
   - For Vercel: create `vercel.json` containing rewrites to `/index.html`.

---

## 4. Backend Host Deployment (Ubuntu 22.04 LTS VPS)

### Step 1: System Packages & Dependencies
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3-pip python3-venv postgresql postgresql-contrib redis-server nginx git curl
```

### Step 2: Clone and Virtual Environment Setup
```bash
sudo mkdir -p /var/www/sprintsync
sudo chown -R ubuntu:ubuntu /var/www/sprintsync
git clone https://github.com/your-org/sprintsync.git /var/www/sprintsync
cd /var/www/sprintsync/backend

python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

### Step 3: Production Environment File
Create `/var/www/sprintsync/backend/.env`:
```ini
DEBUG=False
SECRET_KEY=generate_strong_64_char_cryptographic_key
ALLOWED_HOSTS=api.yourdomain.com,127.0.0.1
CSRF_TRUSTED_ORIGINS=https://api.yourdomain.com,https://app.yourdomain.com
CORS_ALLOWED_ORIGINS=https://app.yourdomain.com

# PostgreSQL
DATABASE_URL=postgresql://sprintsync_user:your_secure_password@localhost:5432/project_management_db

# Redis & Celery
REDIS_URL=redis://localhost:6379/0
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0

# Stripe
STRIPE_PUBLIC_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Security Flags
SECURE_SSL_REDIRECT=True
SESSION_COOKIE_SECURE=True
CSRF_COOKIE_SECURE=True
SECURE_HSTS_SECONDS=31536000
```

### Step 4: Run Migrations and Collect Static Files
```bash
python manage.py migrate --noinput
python manage.py seed_plans
python manage.py collectstatic --noinput
```

---

## 5. Systemd Service Configurations

### 1. Gunicorn WSGI Service (`/etc/systemd/system/sprintsync-backend.service`)
```ini
[Unit]
Description=Gunicorn instance serving SprintSync Backend
After=network.target

[Service]
User=ubuntu
Group=www-data
WorkingDirectory=/var/www/sprintsync/backend
EnvironmentFile=/var/www/sprintsync/backend/.env
ExecStart=/var/www/sprintsync/backend/venv/bin/gunicorn \
          --workers 3 \
          --bind 127.0.0.1:8000 \
          --access-logfile /var/log/sprintsync/gunicorn_access.log \
          --error-logfile /var/log/sprintsync/gunicorn_error.log \
          config.wsgi:application

Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

### 2. Celery Worker Service (`/etc/systemd/system/sprintsync-worker.service`)
```ini
[Unit]
Description=SprintSync Celery Worker
After=network.target redis.service

[Service]
User=ubuntu
Group=ubuntu
WorkingDirectory=/var/www/sprintsync/backend
EnvironmentFile=/var/www/sprintsync/backend/.env
ExecStart=/var/www/sprintsync/backend/venv/bin/celery -A config worker -l info --concurrency=2
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### 3. Celery Beat Scheduler Service (`/etc/systemd/system/sprintsync-beat.service`)
```ini
[Unit]
Description=SprintSync Celery Beat Scheduler
After=network.target redis.service

[Service]
User=ubuntu
Group=ubuntu
WorkingDirectory=/var/www/sprintsync/backend
EnvironmentFile=/var/www/sprintsync/backend/.env
ExecStart=/var/www/sprintsync/backend/venv/bin/celery -A config beat -l info --pidfile=/tmp/celerybeat.pid
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start all services:
```bash
sudo mkdir -p /var/log/sprintsync
sudo chown -R ubuntu:www-data /var/log/sprintsync
sudo systemctl daemon-reload
sudo systemctl enable --now sprintsync-backend sprintsync-worker sprintsync-beat
```

---

## 6. Nginx Host Configuration & Let's Encrypt SSL

Create `/etc/nginx/sites-available/sprintsync`:
```nginx
server {
    server_name api.yourdomain.com;

    client_max_body_size 25M;

    # Media attachments
    location /media/ {
        alias /var/www/sprintsync/backend/media/;
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }

    # Static assets (handled by WhiteNoise or Nginx)
    location /static/ {
        alias /var/www/sprintsync/backend/staticfiles/;
        expires 365d;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    # Proxy API & Admin traffic to Gunicorn
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_redirect off;
    }
}
```

Enable site and install free SSL certificate:
```bash
sudo ln -s /etc/nginx/sites-available/sprintsync /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.yourdomain.com
```

---

## 7. Verification & Health Monitoring

Verify the live deployment:
```bash
curl -I https://api.yourdomain.com/api/health/?detailed=true
```

Expected output:
```json
{
  "status": "ok",
  "version": "1.0.0",
  "database": "connected",
  "redis": "connected"
}
```

