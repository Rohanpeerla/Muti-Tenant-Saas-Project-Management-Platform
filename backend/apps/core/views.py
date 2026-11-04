from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status


@api_view(['GET'])
@permission_classes([AllowAny])
def health_check(request):
    """
    Health check endpoint to verify backend service status.
    Expected response:
    {
        "status": "success",
        "message": "Project Management API is running"
    }
    """
    return Response(
        {
            "status": "success",
            "message": "Project Management API is running"
        },
        status=status.HTTP_200_OK
    )
