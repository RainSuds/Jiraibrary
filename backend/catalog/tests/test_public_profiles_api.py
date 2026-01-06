from __future__ import annotations

from typing import cast

from django.urls import reverse
from rest_framework.test import APITestCase, APIClient
from rest_framework.response import Response
from rest_framework import status

from users.models import User, UserProfile
from catalog import models


class PublicProfilesApiTests(APITestCase):
    def setUp(self) -> None:
        self.user = User.objects.create_user(username="alice", email="alice@example.com", password="password123")
        profile, _ = UserProfile.objects.get_or_create(user=self.user)
        profile.display_name = "Alice"
        profile.pronouns = "she/her"
        profile.bio = "Hello world"
        profile.save(update_fields=["display_name", "pronouns", "bio", "updated_at"])

        self.other = User.objects.create_user(username="bob", email="bob@example.com", password="password123")

        self.brand = models.Brand.objects.create(slug="test-brand", names={"en": "Test"})
        self.category = models.Category.objects.create(name="Dresses", slug="dresses")
        self.language = models.Language.objects.create(code="en", name="English", native_name="English")
        self.currency = models.Currency.objects.create(code="USD", name="US Dollar", symbol="$", is_active=True)
        self.item = models.Item.objects.create(
            slug="test-item",
            brand=self.brand,
            category=self.category,
            default_language=self.language,
            default_currency=self.currency,
            status=models.Item.ItemStatus.PUBLISHED,
        )

    def test_public_user_profile_returns_safe_fields(self) -> None:
        client = cast(APIClient, self.client)
        url = reverse("public-user-profile", kwargs={"username": "alice"})
        response = cast(Response, client.get(url))
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data["username"], "alice")
        self.assertEqual(response.data["display_name"], "Alice")
        self.assertNotIn("email", response.data)
        self.assertNotIn("is_staff", response.data)

    def test_public_user_reviews_only_returns_approved(self) -> None:
        models.ItemReview.objects.create(
            item=self.item,
            author=self.user,
            recommendation=models.ItemReview.Recommendation.RECOMMEND,
            body="Approved",
            status=models.ItemReview.ModerationStatus.APPROVED,
        )
        other_item = models.Item.objects.create(
            slug="test-item-pending-review",
            brand=self.brand,
            category=self.category,
            default_language=self.language,
            default_currency=self.currency,
            status=models.Item.ItemStatus.PUBLISHED,
        )
        models.ItemReview.objects.create(
            item=other_item,
            author=self.user,
            recommendation=models.ItemReview.Recommendation.MIXED,
            body="Pending",
            status=models.ItemReview.ModerationStatus.PENDING,
        )

        client = cast(APIClient, self.client)
        url = reverse("public-user-reviews", kwargs={"username": "alice"})
        response = cast(Response, client.get(url))
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        bodies = [entry.get("body") for entry in cast(list[dict], response.data)]
        self.assertIn("Approved", bodies)
        self.assertNotIn("Pending", bodies)

    def test_public_user_submissions_only_returns_approved(self) -> None:
        models.ItemSubmission.objects.create(
            user=self.user,
            title="Pending Submission",
            brand_name="Test Brand",
            status=models.ItemSubmission.SubmissionStatus.PENDING,
        )
        models.ItemSubmission.objects.create(
            user=self.user,
            title="Approved Submission",
            brand_name="Test Brand",
            status=models.ItemSubmission.SubmissionStatus.APPROVED,
            item_slug="test-item",
            linked_item=self.item,
        )

        client = cast(APIClient, self.client)
        url = reverse("public-user-submissions", kwargs={"username": "alice"})
        response = cast(Response, client.get(url))
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        titles = [entry.get("title") for entry in cast(list[dict], response.data)]
        self.assertIn("Approved Submission", titles)
        self.assertNotIn("Pending Submission", titles)
