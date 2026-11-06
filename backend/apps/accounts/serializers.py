from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    """
    Public-safe representation of the User model.
    """
    class Meta:
        model = User
        fields = [
            'id',
            'email',
            'username',
            'first_name',
            'last_name',
            'is_active',
            'date_joined',
            'updated_at',
        ]
        read_only_fields = ['id', 'is_active', 'date_joined', 'updated_at']


class RegisterSerializer(serializers.ModelSerializer):
    """
    Serializer for new user registration.
    """
    password = serializers.CharField(
        write_only=True,
        required=True,
        style={'input_type': 'password'},
        min_length=8
    )
    password_confirm = serializers.CharField(
        write_only=True,
        required=True,
        style={'input_type': 'password'},
        min_length=8
    )

    class Meta:
        model = User
        fields = [
            'id',
            'email',
            'username',
            'first_name',
            'last_name',
            'password',
            'password_confirm',
        ]
        read_only_fields = ['id']

    def validate_email(self, value):
        normalized = value.strip().lower()
        if User.objects.filter(email__iexact=normalized).exists():
            raise serializers.ValidationError('A user with this email already exists.')
        return normalized

    def validate_username(self, value):
        username = value.strip()
        if User.objects.filter(username__iexact=username).exists():
            raise serializers.ValidationError('A user with this username already exists.')
        return username

    def validate(self, attrs):
        password = attrs.get('password')
        password_confirm = attrs.get('password_confirm')

        if password != password_confirm:
            raise serializers.ValidationError({'password_confirm': 'Passwords do not match.'})

        # Validate password strength against configured Django validators
        temp_user = User(
            email=attrs.get('email', ''),
            username=attrs.get('username', ''),
            first_name=attrs.get('first_name', ''),
            last_name=attrs.get('last_name', '')
        )
        validate_password(password, user=temp_user)

        return attrs

    def create(self, validated_data):
        validated_data.pop('password_confirm')
        password = validated_data.pop('password')
        user = User.objects.create_user(
            password=password,
            **validated_data
        )
        return user


class LoginSerializer(serializers.Serializer):
    """
    Serializer for user login via email and password.
    Returns access, refresh tokens and user profile upon success.
    """
    email = serializers.EmailField(required=True)
    password = serializers.CharField(
        required=True,
        write_only=True,
        style={'input_type': 'password'}
    )

    def validate(self, attrs):
        email = attrs.get('email', '').strip().lower()
        password = attrs.get('password', '')

        # Lookup user by normalized email
        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            # Generic error to prevent email enumeration
            raise serializers.ValidationError({'non_field_errors': 'Invalid email or password.'})

        if not user.check_password(password):
            raise serializers.ValidationError({'non_field_errors': 'Invalid email or password.'})

        if not user.is_active:
            raise serializers.ValidationError({'non_field_errors': 'Account is inactive. Please contact support.'})

        refresh = RefreshToken.for_user(user)

        return {
            'user': user,
            'access': str(refresh.access_token),
            'refresh': str(refresh),
        }


class UserProfileUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer for updating the authenticated user's own profile.
    """
    class Meta:
        model = User
        fields = ['username', 'first_name', 'last_name']

    def validate_username(self, value):
        username = value.strip()
        user = self.context['request'].user
        if User.objects.filter(username__iexact=username).exclude(id=user.id).exists():
            raise serializers.ValidationError('This username is already taken.')
        return username


class ChangePasswordSerializer(serializers.Serializer):
    """
    Serializer for authenticated password change.
    """
    current_password = serializers.CharField(
        required=True,
        write_only=True,
        style={'input_type': 'password'}
    )
    new_password = serializers.CharField(
        required=True,
        write_only=True,
        style={'input_type': 'password'},
        min_length=8
    )
    new_password_confirm = serializers.CharField(
        required=True,
        write_only=True,
        style={'input_type': 'password'},
        min_length=8
    )

    def validate_current_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError('Current password is incorrect.')
        return value

    def validate(self, attrs):
        new_password = attrs.get('new_password')
        new_password_confirm = attrs.get('new_password_confirm')

        if new_password != new_password_confirm:
            raise serializers.ValidationError({'new_password_confirm': 'New passwords do not match.'})

        user = self.context['request'].user
        validate_password(new_password, user=user)

        return attrs

    def save(self, **kwargs):
        user = self.context['request'].user
        new_password = self.validated_data['new_password']
        user.set_password(new_password)
        user.save()
        return user

