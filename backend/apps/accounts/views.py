from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError

from .serializers import (
    UserSerializer,
    RegisterSerializer,
    LoginSerializer,
    UserProfileUpdateSerializer,
    ChangePasswordSerializer,
)


class RegisterView(APIView):
    """
    POST /api/auth/register/
    Registers a new user and returns their profile without passwords.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            return Response(
                {
                    'status': 'success',
                    'message': 'User registered successfully.',
                    'user': UserSerializer(user).data
                },
                status=status.HTTP_201_CREATED
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LoginView(APIView):
    """
    POST /api/auth/login/
    Authenticates user via email and password, returning JWT access & refresh tokens.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if serializer.is_valid():
            data = serializer.validated_data
            return Response(
                {
                    'status': 'success',
                    'access': data['access'],
                    'refresh': data['refresh'],
                    'user': UserSerializer(data['user']).data
                },
                status=status.HTTP_200_OK
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LogoutView(APIView):
    """
    POST /api/auth/logout/
    Blacklists the provided refresh token to securely terminate the session.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        refresh_token = request.data.get('refresh')
        if not refresh_token:
            return Response(
                {'error': 'Refresh token is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response(
                {
                    'status': 'success',
                    'message': 'Successfully logged out.'
                },
                status=status.HTTP_200_OK
            )
        except TokenError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


class UserProfileView(APIView):
    """
    GET /api/auth/me/ - Retrieve authenticated user profile
    PATCH /api/auth/me/ - Update authenticated user's personal details
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request):
        serializer = UserProfileUpdateSerializer(
            request.user,
            data=request.data,
            partial=True,
            context={'request': request}
        )
        if serializer.is_valid():
            user = serializer.save()
            return Response(
                {
                    'status': 'success',
                    'message': 'Profile updated successfully.',
                    'user': UserSerializer(user).data
                },
                status=status.HTTP_200_OK
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ChangePasswordView(APIView):
    """
    POST /api/auth/change-password/
    Updates user password after verifying the current password and strength.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(
            data=request.data,
            context={'request': request}
        )
        if serializer.is_valid():
            serializer.save()
            return Response(
                {
                    'status': 'success',
                    'message': 'Password changed successfully.'
                },
                status=status.HTTP_200_OK
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
