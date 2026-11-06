#!/bin/sh
set -e

# Function to wait for PostgreSQL
wait_for_db() {
    echo "Checking database connectivity..."
    python << END
import os
import sys
import socket
import time
import urllib.parse as urlparse

db_url = os.environ.get('DATABASE_URL')
if db_url:
    url = urlparse.urlparse(db_url)
    host = url.hostname or 'db'
    port = url.port or 5432
else:
    host = os.environ.get('DB_HOST', 'db')
    port = int(os.environ.get('DB_PORT', 5432))

start_time = time.time()
while True:
    try:
        s = socket.create_connection((host, port), timeout=3)
        s.close()
        print(f"PostgreSQL is available at {host}:{port}")
        sys.exit(0)
    except (socket.error, OSError) as err:
        if time.time() - start_time > 60:
            print(f"Timed out waiting for PostgreSQL at {host}:{port}: {err}", file=sys.stderr)
            sys.exit(1)
        time.sleep(1)
END
}

# Wait for DB if database environment variables are configured
if [ "$SKIP_DB_WAIT" != "true" ]; then
    wait_for_db
fi

# Apply database migrations if primary backend process
if [ "$RUN_MIGRATIONS" = "true" ]; then
    echo "Applying database migrations..."
    python manage.py migrate --noinput

    echo "Ensuring subscription plans are seeded..."
    python manage.py seed_plans || true

    echo "Collecting static files..."
    python manage.py collectstatic --noinput || true
fi

# Execute the CMD container command
exec "$@"

