from __future__ import annotations

from typing import Any
from unittest.mock import patch

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase


class CognitoLoginTests(APITestCase):
    def test_allows_federated_login_even_if_email_not_verified(self) -> None:
        url = reverse("api-cognito-login")
        claims: dict[str, Any] = {
            "email": "federated@example.com",
            "email_verified": False,
            "cognito:username": "Google_1234567890",
            "sub": "abc",
            "name": "Federated User",
            "picture": "https://example.com/avatar.png",
        }

        with patch("users.views._verify_cognito_id_token", return_value=claims):
            response = self.client.post(url, {"id_token": "fake"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertIn("token", response.data)
        self.assertEqual(response.data["user"]["email"], "federated@example.com")
        self.assertEqual(response.data["user"]["avatar_url"], "https://example.com/avatar.png")

    def test_rejects_non_federated_login_when_email_not_verified(self) -> None:
        url = reverse("api-cognito-login")
        claims: dict[str, Any] = {
            "email": "native@example.com",
            "email_verified": False,
            "cognito:username": "nativeuser",
            "sub": "abc",
            "name": "Native User",
        }

        with patch("users.views._verify_cognito_id_token", return_value=claims):
            response = self.client.post(url, {"id_token": "fake"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("not verified", str(response.data).lower())

    def test_rejects_missing_email(self) -> None:
        url = reverse("api-cognito-login")
        claims: dict[str, Any] = {
            "email_verified": True,
            "cognito:username": "Google_1234567890",
            "sub": "abc",
        }

        with patch("users.views._verify_cognito_id_token", return_value=claims):
            response = self.client.post(url, {"id_token": "fake"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("missing email", str(response.data).lower())
