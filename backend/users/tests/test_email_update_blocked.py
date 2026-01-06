from __future__ import annotations

from rest_framework import status
from rest_framework.test import APITestCase

from users.models import User


class EmailUpdateBlockedTests(APITestCase):
    def test_email_update_is_rejected(self) -> None:
        user = User.objects.create_user(username="emailtest", email="old@example.com", password="password123")
        self.client.force_authenticate(user=user)

        response = self.client.patch("/api/auth/me/", {"email": "new@example.com"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", str(response.data).lower())
