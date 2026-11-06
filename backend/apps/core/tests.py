from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status


class HealthCheckTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_health_check_endpoint(self):
        response = self.client.get('/api/health/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.json(),
            {
                "status": "success",
                "message": "Project Management API is running"
            }
        )

    def test_detailed_health_check_endpoint(self):
        response = self.client.get('/api/health/?detailed=true')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data["status"], "success")
        self.assertIn("services", data)
        self.assertIn("database", data["services"])
        self.assertIn("redis", data["services"])

