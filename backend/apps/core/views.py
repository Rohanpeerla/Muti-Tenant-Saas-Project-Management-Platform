from django.db import connection
from django.conf import settings
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
import redis


@api_view(['GET'])
@permission_classes([AllowAny])
def health_check(request):
    """
    Health check endpoint to verify backend service status.
    Supports granular service diagnostics via ?detailed=true query param.
    """
    detailed = request.query_params.get('detailed', '').lower() in ('true', '1')
    data = {
        "status": "success",
        "message": "Project Management API is running"
    }

    if detailed:
        services = {
            "database": "unknown",
            "redis": "unknown"
        }

        # Check PostgreSQL database connectivity
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1;")
                cursor.fetchone()
            services["database"] = "healthy"
        except Exception:
            services["database"] = "unhealthy"

        # Check Redis connectivity
        try:
            redis_url = getattr(settings, 'REDIS_URL', 'redis://localhost:6379/0')
            r = redis.from_url(redis_url, socket_timeout=2)
            services["redis"] = "healthy" if r.ping() else "unhealthy"
        except Exception:
            services["redis"] = "unhealthy"

        data["services"] = services

    return Response(data, status=status.HTTP_200_OK)

