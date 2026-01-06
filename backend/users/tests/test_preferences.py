from __future__ import annotations

from typing import Any, cast

from django.urls import reverse
from rest_framework.authtoken.models import Token
from rest_framework.response import Response
from rest_framework.test import APIClient, APITestCase

from catalog import models as catalog_models
from users import models as user_models


class UserPreferenceViewTests(APITestCase):
    def setUp(self) -> None:
        self.language_en = catalog_models.Language.objects.create(code="en", name="English")
        self.language_ja = catalog_models.Language.objects.create(code="ja", name="Japanese")
        self.currency_usd = catalog_models.Currency.objects.create(code="USD", name="US Dollar", symbol="$")
        self.currency_jpy = catalog_models.Currency.objects.create(code="JPY", name="Yen", symbol="¥")
        self.user = user_models.User.objects.create_user(
            username="tester",
            email="tester@example.com",
            password="secret-pass",
        )
        self.profile = user_models.UserProfile.objects.get(user=self.user)
        self.token = Token.objects.create(user=self.user)
        self.url = reverse("api-current-user")

    def test_user_can_update_preferences(self) -> None:
        client = cast(APIClient, self.client)
        client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        response = cast(
            Response,
            client.patch(
                self.url,
                {
                    "preferred_language": "ja",
                    "preferred_currency": "jpy",
                    "share_owned_public": True,
                    "share_wishlist_public": False,
                },
                format="json",
            ),
        )
        self.assertEqual(response.status_code, 200)
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.preferred_languages, ["ja"])
        self.assertEqual(self.profile.preferred_currency, "JPY")
        self.user.refresh_from_db()
        self.assertTrue(self.user.share_owned_public)
        self.assertFalse(self.user.share_wishlist_public)
        data = cast(dict[str, Any], response.data)
        self.assertEqual(data["preferred_language"], "ja")
        self.assertEqual(data["preferred_currency"], "JPY")
        self.assertTrue(data["share_owned_public"])
        self.assertFalse(data["share_wishlist_public"])

    def test_invalid_codes_are_rejected(self) -> None:
        client = cast(APIClient, self.client)
        client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        response = cast(
            Response,
            client.patch(
            self.url,
            {"preferred_language": "xx", "preferred_currency": "zzz"},
            format="json",
            ),
        )
        self.assertEqual(response.status_code, 400)
        data = cast(dict[str, Any], response.data)
        self.assertIn("preferred_language", data)
        self.assertIn("preferred_currency", data)

    def test_user_can_toggle_share_visibility(self) -> None:
        self.user.share_owned_public = True
        self.user.share_wishlist_public = True
        self.user.save(update_fields=["share_owned_public", "share_wishlist_public"])

        client = cast(APIClient, self.client)
        client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        response = cast(
            Response,
            client.patch(
                self.url,
                {
                    "share_owned_public": False,
                    "share_wishlist_public": False,
                },
                format="json",
            ),
        )
        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertFalse(self.user.share_owned_public)
        self.assertFalse(self.user.share_wishlist_public)
        data = cast(dict[str, Any], response.data)
        self.assertFalse(data["share_owned_public"])
        self.assertFalse(data["share_wishlist_public"])
