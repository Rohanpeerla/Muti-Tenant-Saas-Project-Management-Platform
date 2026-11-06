import uuid
from django.contrib.auth import get_user_model
from django.db import IntegrityError
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()


class UserModelTests(TestCase):
    def test_user_creation_with_email(self):
        user = User.objects.create_user(
            email='alice@example.com',
            username='alice',
            password='SecurePassword123!',
            first_name='Alice',
            last_name='Smith'
        )
        self.assertIsInstance(user.id, uuid.UUID)
        self.assertEqual(user.email, 'alice@example.com')
        self.assertEqual(user.username, 'alice')
        self.assertTrue(user.is_active)
        self.assertFalse(user.is_staff)
        self.assertFalse(user.is_superuser)
        self.assertEqual(user.get_full_name(), 'Alice Smith')
        self.assertEqual(user.get_short_name(), 'Alice')
        self.assertEqual(str(user), 'alice (alice@example.com)')

    def test_password_hashing(self):
        user = User.objects.create_user(
            email='bob@example.com',
            username='bob',
            password='MySecretPassword!'
        )
        self.assertNotEqual(user.password, 'MySecretPassword!')
        self.assertTrue(user.check_password('MySecretPassword!'))
        self.assertFalse(user.check_password('WrongPassword!'))

    def test_email_normalization(self):
        user = User.objects.create_user(
            email='charlie@EXAMPLE.COM',
            username='charlie',
            password='Password123!'
        )
        self.assertEqual(user.email, 'charlie@example.com')

    def test_duplicate_email_prevention(self):
        User.objects.create_user(
            email='david@example.com',
            username='david1',
            password='Password123!'
        )
        with self.assertRaises(IntegrityError):
            User.objects.create_user(
                email='david@example.com',
                username='david2',
                password='Password123!'
            )

    def test_duplicate_username_prevention(self):
        User.objects.create_user(
            email='eva1@example.com',
            username='eva',
            password='Password123!'
        )
        with self.assertRaises(IntegrityError):
            User.objects.create_user(
                email='eva2@example.com',
                username='eva',
                password='Password123!'
            )

    def test_missing_email_raises_value_error(self):
        with self.assertRaises(ValueError):
            User.objects.create_user(
                email='',
                username='noemail',
                password='Password123!'
            )

    def test_missing_username_raises_value_error(self):
        with self.assertRaises(ValueError):
            User.objects.create_user(
                email='valid@example.com',
                username='',
                password='Password123!'
            )

    def test_superuser_creation(self):
        admin = User.objects.create_superuser(
            email='admin@example.com',
            username='admin',
            password='AdminPassword123!'
        )
        self.assertTrue(admin.is_staff)
        self.assertTrue(admin.is_superuser)
        self.assertTrue(admin.is_active)


class AuthenticationAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email='existing@sprintsync.com',
            username='existinguser',
            password='ExistingPassword123!',
            first_name='Existing',
            last_name='User'
        )

    def test_successful_registration(self):
        payload = {
            'email': 'newuser@sprintsync.com',
            'username': 'newuser',
            'first_name': 'New',
            'last_name': 'User',
            'password': 'SecurePassword123!',
            'password_confirm': 'SecurePassword123!'
        }
        response = self.client.post('/api/auth/register/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['status'], 'success')
        self.assertEqual(response.data['user']['email'], 'newuser@sprintsync.com')
        self.assertNotIn('password', response.data['user'])

    def test_duplicate_email_registration_rejected(self):
        payload = {
            'email': 'existing@sprintsync.com',
            'username': 'uniqueuser',
            'password': 'Password123!',
            'password_confirm': 'Password123!'
        }
        response = self.client.post('/api/auth/register/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('email', response.data)

    def test_duplicate_username_registration_rejected(self):
        payload = {
            'email': 'different@sprintsync.com',
            'username': 'existinguser',
            'password': 'Password123!',
            'password_confirm': 'Password123!'
        }
        response = self.client.post('/api/auth/register/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('username', response.data)

    def test_password_mismatch_registration_rejected(self):
        payload = {
            'email': 'mismatch@sprintsync.com',
            'username': 'mismatch',
            'password': 'Password123!',
            'password_confirm': 'DifferentPassword123!'
        }
        response = self.client.post('/api/auth/register/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('password_confirm', response.data)

    def test_weak_password_registration_rejected(self):
        payload = {
            'email': 'weak@sprintsync.com',
            'username': 'weakuser',
            'password': '123',
            'password_confirm': '123'
        }
        response = self.client.post('/api/auth/register/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_successful_login(self):
        payload = {
            'email': 'existing@sprintsync.com',
            'password': 'ExistingPassword123!'
        }
        response = self.client.post('/api/auth/login/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)
        self.assertEqual(response.data['user']['email'], 'existing@sprintsync.com')

    def test_invalid_login_credentials_rejected(self):
        payload = {
            'email': 'existing@sprintsync.com',
            'password': 'WrongPassword999!'
        }
        response = self.client.post('/api/auth/login/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('non_field_errors', response.data)

    def test_nonexistent_email_login_rejected_with_generic_error(self):
        payload = {
            'email': 'nonexistent@sprintsync.com',
            'password': 'AnyPassword123!'
        }
        response = self.client.post('/api/auth/login/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Invalid email or password.', str(response.data['non_field_errors']))

    def test_inactive_user_login_rejected(self):
        self.user.is_active = False
        self.user.save()

        payload = {
            'email': 'existing@sprintsync.com',
            'password': 'ExistingPassword123!'
        }
        response = self.client.post('/api/auth/login/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('inactive', str(response.data['non_field_errors']).lower())

    def test_access_token_authentication_to_protected_me_endpoint(self):
        refresh = RefreshToken.for_user(self.user)
        access_token = str(refresh.access_token)

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        response = self.client.get('/api/auth/me/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['email'], self.user.email)

    def test_unauthenticated_request_to_protected_endpoint_rejected(self):
        self.client.credentials()  # Clear auth
        response = self.client.get('/api/auth/me/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_token_refresh_and_rotation(self):
        refresh = RefreshToken.for_user(self.user)
        old_refresh = str(refresh)

        response = self.client.post('/api/auth/token/refresh/', {'refresh': old_refresh}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)
        new_refresh = response.data['refresh']

        # Old refresh token is blacklisted; using it again must fail
        replay_response = self.client.post('/api/auth/token/refresh/', {'refresh': old_refresh}, format='json')
        self.assertEqual(replay_response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_logout_blacklists_refresh_token(self):
        refresh = RefreshToken.for_user(self.user)
        access_token = str(refresh.access_token)
        refresh_str = str(refresh)

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        response = self.client.post('/api/auth/logout/', {'refresh': refresh_str}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # After logout, using refresh token to obtain access must fail
        refresh_response = self.client.post('/api/auth/token/refresh/', {'refresh': refresh_str}, format='json')
        self.assertEqual(refresh_response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_profile_update(self):
        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {refresh.access_token}')

        payload = {
            'first_name': 'UpdatedFirst',
            'last_name': 'UpdatedLast',
            'username': 'updateduser'
        }
        response = self.client.patch('/api/auth/me/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['user']['first_name'], 'UpdatedFirst')
        self.assertEqual(response.data['user']['username'], 'updateduser')

        self.user.refresh_from_db()
        self.assertEqual(self.user.first_name, 'UpdatedFirst')
        self.assertEqual(self.user.username, 'updateduser')

    def test_change_password(self):
        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {refresh.access_token}')

        payload = {
            'current_password': 'ExistingPassword123!',
            'new_password': 'BrandNewPassword123!',
            'new_password_confirm': 'BrandNewPassword123!'
        }
        response = self.client.post('/api/auth/change-password/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verify old password no longer works
        self.user.refresh_from_db()
        self.assertFalse(self.user.check_password('ExistingPassword123!'))
        self.assertTrue(self.user.check_password('BrandNewPassword123!'))

    def test_change_password_with_incorrect_current_password(self):
        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {refresh.access_token}')

        payload = {
            'current_password': 'WrongCurrentPassword!',
            'new_password': 'BrandNewPassword123!',
            'new_password_confirm': 'BrandNewPassword123!'
        }
        response = self.client.post('/api/auth/change-password/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('current_password', response.data)
