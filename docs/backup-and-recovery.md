# Database & Media Backup and Recovery

This document provides operational procedures for backing up and restoring SprintSync's PostgreSQL database and user-uploaded media files.

---

## 1. Automated PostgreSQL Backups

### Docker Compose Backup Command

To generate a compressed backup of the running PostgreSQL database container:

```bash
# Set timestamp variable
BACKUP_DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p ./backups/postgres

# Dump database using pg_dump inside the db container
docker compose exec -t db pg_dump -U postgres -d sprintsync_db -Fc > ./backups/postgres/sprintsync_db_${BACKUP_DATE}.dump
```

### Bare-Metal / Local PostgreSQL Backup

```powershell
# Windows PowerShell
$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
New-Item -ItemType Directory -Force -Path "./backups/postgres"
& "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe" -U postgres -h localhost -p 5432 -F c -b -v -f "./backups/postgres/db_$Timestamp.dump" project_management_db
```

---

## 2. PostgreSQL Disaster Recovery

### Restoring from a Custom Dump File (`.dump`)

1. Stop services writing to the database:
   ```bash
   docker compose stop backend celery_worker celery_beat
   ```

2. Drop and recreate the target database:
   ```bash
   docker compose exec -t db dropdb -U postgres --if-exists sprintsync_db
   docker compose exec -t db createdb -U postgres sprintsync_db
   ```

3. Restore the dump using `pg_restore`:
   ```bash
   docker compose exec -i db pg_restore -U postgres -d sprintsync_db --clean --no-owner < ./backups/postgres/sprintsync_db_20261105_120000.dump
   ```

4. Restart backend and worker services:
   ```bash
   docker compose up -d backend celery_worker celery_beat
   ```

---

## 3. Media Files Backup & Restore

User attachments (issue files, avatars) are saved in the `media_data` volume or local `backend/media/` folder.

### Backing Up Media Volume in Docker
```bash
docker run --rm -v sprintsync_media_data:/media -v $(pwd)/backups:/backup alpine tar czf /backup/media_backup_$(date +%Y%m%d).tar.gz -C /media .
```

### Restoring Media Volume in Docker
```bash
docker run --rm -v sprintsync_media_data:/media -v $(pwd)/backups:/backup alpine tar xzf /backup/media_backup_20261105.tar.gz -C /media
```

---

## 4. Disaster Recovery Checklist

- [ ] Verify that backup file size is greater than 0 bytes and uncorrupted.
- [ ] Ensure all Celery workers are halted before performing database restores.
- [ ] Run `python manage.py check` and `python manage.py migrate --check` after restoring.
- [ ] Verify health check at `GET /api/health/?detailed=true` returns `"status": "ok"` and `"database": "connected"`.
- [ ] Validate Stripe webhook idempotency: webhook events previously processed remain safe due to unique Stripe event IDs.

