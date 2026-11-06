# Multi-Tenant SaaS Project Management Platform (SprintSync)
# Production Backend Dockerfile
FROM python:3.12-slim

# Prevent Python from writing .pyc files and enable unbuffered container logging
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000

# Install required system packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Create dedicated non-root application user
RUN groupadd -g 1000 appgroup && \
    useradd -u 1000 -g appgroup -m -s /bin/bash appuser

WORKDIR /app

# Install Python dependencies
COPY requirements.txt /app/
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy project files
COPY . /app/

# Set up static and media directories and fix permissions
RUN mkdir -p /app/staticfiles /app/media && \
    chown -R appuser:appgroup /app && \
    chmod +x /app/entrypoint.sh

# Run as non-root user
USER appuser

EXPOSE 8000

ENTRYPOINT ["/app/entrypoint.sh"]

CMD ["gunicorn", "--bind", "0.0.0.0:8000", "--workers", "3", "--threads", "2", "--timeout", "60", "--access-logfile", "-", "--error-logfile", "-", "config.wsgi:application"]

