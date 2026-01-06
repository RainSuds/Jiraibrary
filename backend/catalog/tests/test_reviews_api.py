from __future__ import annotations

from io import BytesIO
from typing import Any, cast

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from PIL import Image as PILImage
from rest_framework import status
from rest_framework.response import Response
from rest_framework.test import APIClient, APITestCase

from catalog import models


User = get_user_model()


class ItemReviewAPITests(APITestCase):
    def setUp(self) -> None:
        self.user = User.objects.create_user(username="reviewer", email="reviewer@example.com", password="password123")
        self.staff = User.objects.create_user(username="moderator", email="mod@example.com", password="password123", is_staff=True)
        self.language = models.Language.objects.create(code="en", name="English")
        self.currency = models.Currency.objects.create(code="USD", name="US Dollar", symbol="$")
        self.brand = models.Brand.objects.create(slug="brand-test", names={"en": "Brand Test"})
        self.category = models.Category.objects.create(name="Dresses", slug="dresses")
        self.item = models.Item.objects.create(
            slug="test-item",
            brand=self.brand,
            category=self.category,
            default_language=self.language,
            default_currency=self.currency,
            status=models.Item.ItemStatus.PUBLISHED,
        )

    def _make_image(self) -> SimpleUploadedFile:
        buffer = BytesIO()
        PILImage.new("RGB", (2, 2), color=(120, 10, 10)).save(buffer, format="PNG")
        buffer.seek(0)
        return SimpleUploadedFile("review.png", buffer.getvalue(), content_type="image/png")

    def test_list_only_returns_approved_reviews(self) -> None:
        approved = models.ItemReview.objects.create(
            item=self.item,
            author=self.user,
            recommendation=models.ItemReview.Recommendation.RECOMMEND,
            body="Looks great",
            status=models.ItemReview.ModerationStatus.APPROVED,
        )
        models.ReviewImage.objects.create(review=approved, image_file=self._make_image(), uploaded_by=self.user)

        other_user = User.objects.create_user(username="other", email="other@example.com", password="password123")
        pending = models.ItemReview.objects.create(
            item=self.item,
            author=other_user,
            recommendation=models.ItemReview.Recommendation.MIXED,
            body="Pending",
            status=models.ItemReview.ModerationStatus.PENDING,
        )
        models.ReviewImage.objects.create(review=pending, image_file=self._make_image(), uploaded_by=other_user)

        url = reverse("item-review-list-create", kwargs={"slug": self.item.slug})
        response = cast(Response, self.client.get(url))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = cast(list[dict[str, Any]], response.data)
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["id"], str(approved.id))
        self.assertEqual(data[0]["status"], "approved")
        self.assertEqual(data[0]["recommendation"], "recommend")
        self.assertTrue(len(data[0]["images"]) >= 1)

    def test_create_requires_authentication(self) -> None:
        url = reverse("item-review-list-create", kwargs={"slug": self.item.slug})
        response = cast(
            Response,
            self.client.post(
                url,
                {"recommendation": "recommend", "body": "Nice", "images": self._make_image()},
                format="multipart",
            ),
        )
        self.assertIn(response.status_code, {status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN})

    def test_create_requires_at_least_one_image(self) -> None:
        client = cast(APIClient, self.client)
        client.force_authenticate(user=self.user)
        url = reverse("item-review-list-create", kwargs={"slug": self.item.slug})
        response = cast(Response, client.post(url, {"recommendation": "mixed", "body": "Ok"}, format="multipart"))
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("picture", str(response.data).lower())

    def test_create_prevents_duplicate_reviews(self) -> None:
        client = cast(APIClient, self.client)
        client.force_authenticate(user=self.user)
        url = reverse("item-review-list-create", kwargs={"slug": self.item.slug})

        response = cast(
            Response,
            client.post(
                url,
                {"recommendation": "recommend", "body": "Nice", "images": self._make_image()},
                format="multipart",
            ),
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)

        second = cast(
            Response,
            client.post(
                url,
                {"recommendation": "mixed", "body": "Second", "images": self._make_image()},
                format="multipart",
            ),
        )
        self.assertEqual(second.status_code, status.HTTP_409_CONFLICT)

    def test_create_blocks_when_user_has_pending_review_for_any_item(self) -> None:
        client = cast(APIClient, self.client)
        client.force_authenticate(user=self.user)

        first_url = reverse("item-review-list-create", kwargs={"slug": self.item.slug})
        first = cast(
            Response,
            client.post(
                first_url,
                {"recommendation": "recommend", "body": "First", "images": self._make_image()},
                format="multipart",
            ),
        )
        self.assertEqual(first.status_code, status.HTTP_201_CREATED, first.data)

        second_item = models.Item.objects.create(
            slug="test-item-pending-block",
            brand=self.brand,
            category=self.category,
            default_language=self.language,
            default_currency=self.currency,
            status=models.Item.ItemStatus.PUBLISHED,
        )
        second_url = reverse("item-review-list-create", kwargs={"slug": second_item.slug})
        second = cast(
            Response,
            client.post(
                second_url,
                {"recommendation": "mixed", "body": "Second", "images": self._make_image()},
                format="multipart",
            ),
        )
        self.assertEqual(second.status_code, status.HTTP_409_CONFLICT)
        self.assertIn("pending", str(second.data).lower())

    def test_staff_can_moderate_review(self) -> None:
        review = models.ItemReview.objects.create(
            item=self.item,
            author=self.user,
            recommendation=models.ItemReview.Recommendation.RECOMMEND,
            body="Test",
        )
        models.ReviewImage.objects.create(review=review, image_file=self._make_image(), uploaded_by=self.user)

        client = cast(APIClient, self.client)
        client.force_authenticate(user=self.staff)
        url = reverse("item-review-moderate", args=[review.id])
        response = cast(Response, client.patch(url, {"status": "approved"}, format="json"))

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        review.refresh_from_db()
        self.assertEqual(review.status, models.ItemReview.ModerationStatus.APPROVED)
        self.assertIsNotNone(review.moderated_at)
        self.assertEqual(review.moderated_by_id, self.staff.id)

    def test_user_can_list_their_reviews_with_status_filter(self) -> None:
        pending = models.ItemReview.objects.create(
            item=self.item,
            author=self.user,
            recommendation=models.ItemReview.Recommendation.MIXED,
            body="Pending",
            status=models.ItemReview.ModerationStatus.PENDING,
        )
        models.ReviewImage.objects.create(review=pending, image_file=self._make_image(), uploaded_by=self.user)

        second_item = models.Item.objects.create(
            slug="test-item-2",
            brand=self.brand,
            category=self.category,
            default_language=self.language,
            default_currency=self.currency,
            status=models.Item.ItemStatus.PUBLISHED,
        )

        approved = models.ItemReview.objects.create(
            item=second_item,
            author=self.user,
            recommendation=models.ItemReview.Recommendation.RECOMMEND,
            body="Approved",
            status=models.ItemReview.ModerationStatus.APPROVED,
        )
        models.ReviewImage.objects.create(review=approved, image_file=self._make_image(), uploaded_by=self.user)

        other_user = User.objects.create_user(username="review-other", email="review-other@example.com", password="password123")
        other_review = models.ItemReview.objects.create(
            item=self.item,
            author=other_user,
            recommendation=models.ItemReview.Recommendation.NOT_RECOMMEND,
            body="Other",
            status=models.ItemReview.ModerationStatus.PENDING,
        )
        models.ReviewImage.objects.create(review=other_review, image_file=self._make_image(), uploaded_by=other_user)

        client = cast(APIClient, self.client)
        client.force_authenticate(user=self.user)
        url = reverse("my-review-list")

        response = cast(Response, client.get(url))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = cast(list[dict[str, Any]], response.data)
        ids = {entry["id"] for entry in data}
        self.assertIn(str(pending.id), ids)
        self.assertIn(str(approved.id), ids)
        self.assertNotIn(str(other_review.id), ids)

        filtered = cast(Response, client.get(url, {"status": "pending"}))
        self.assertEqual(filtered.status_code, status.HTTP_200_OK)
        filtered_data = cast(list[dict[str, Any]], filtered.data)
        self.assertEqual(len(filtered_data), 1)
        self.assertEqual(filtered_data[0]["id"], str(pending.id))
