from __future__ import annotations

from decimal import Decimal
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


class ItemAPITests(APITestCase):
    @classmethod
    def setUpTestData(cls) -> None:
        cls.language = models.Language.objects.create(code="en", name="English")
        cls.currency = models.Currency.objects.create(code="USD", name="US Dollar", symbol="$")
        cls.brand = models.Brand.objects.create(slug="brand-alpha", names={"en": "Brand Alpha"})
        cls.category = models.Category.objects.create(name="Dresses", slug="dresses")

        for index, year in enumerate((2001, 2005, 2010), start=1):
            item = models.Item.objects.create(
                slug=f"alpha-{index}",
                brand=cls.brand,
                category=cls.category,
                default_language=cls.language,
                default_currency=cls.currency,
                release_year=year,
                status=models.Item.ItemStatus.PUBLISHED,
            )
            models.ItemTranslation.objects.create(
                item=item,
                language=cls.language,
                name=f"Alpha Item {index}",
            )
            if index == 1:
                models.ItemPrice.objects.create(
                    item=item,
                    currency=cls.currency,
                    amount=Decimal("120.00"),
                )

    def test_list_respects_limit_but_reports_full_count(self) -> None:
        url = reverse("item-list")
        response = cast(Response, self.client.get(url, {"limit": 2}))

        self.assertEqual(response.status_code, 200)
        data = cast(dict[str, Any], response.data)
        self.assertEqual(data["result_count"], 3)
        self.assertEqual(len(data["results"]), 2)

    def test_selected_filters_echo_back_request_values(self) -> None:
        url = reverse("item-list")
        params = {
            "limit": 1,
            "release_year_range": "2000:2006",
            "price_range": "USD:0:500",
        }
        response = cast(Response, self.client.get(url, params))

        self.assertEqual(response.status_code, 200)
        data = cast(dict[str, Any], response.data)
        selected = data["selected"]

        self.assertEqual(selected["release_year_ranges"], [{"min": 2000, "max": 2006, "value_key": "2000:2006"}])
        self.assertEqual(
            selected["price_ranges"],
            [{"currency": "USD", "min": 0.0, "max": 500.0, "value_key": "USD:0:500"}],
        )
        self.assertEqual(selected["price_currency"], "USD")
        self.assertEqual(len(data["results"]), 1)


class ImageUploadPermissionTests(APITestCase):
    def setUp(self) -> None:
        self.user = User.objects.create_user(
            username="submitter",
            email="submitter@example.com",
            password="password123",
        )
        self.other_user = User.objects.create_user(
            username="bystander",
            email="bystander@example.com",
            password="password123",
        )
        self.language = models.Language.objects.create(code="en", name="English")
        self.currency = models.Currency.objects.create(code="USD", name="US Dollar", symbol="$")
        self.category = models.Category.objects.create(name="Outerwear", slug="outerwear")
        self.brand = models.Brand.objects.create(slug="test-brand", names={"en": "Test Brand"})
        self.item = models.Item.objects.create(
            slug="test-item",
            brand=self.brand,
            category=self.category,
            default_language=self.language,
            default_currency=self.currency,
        )

    def _make_image(self) -> SimpleUploadedFile:
        buffer = BytesIO()
        PILImage.new("RGB", (2, 2), color=(255, 0, 0)).save(buffer, format="PNG")
        buffer.seek(0)
        return SimpleUploadedFile("tiny.png", buffer.getvalue(), content_type="image/png")

    def test_user_can_upload_update_and_delete_own_unlinked_image(self) -> None:
        client = cast(APIClient, self.client)
        client.force_authenticate(user=self.user)
        response = cast(
            Response,
            client.post(
                reverse("image-list"),
                {"image_file": self._make_image(), "caption": "Initial"},
                format="multipart",
            ),
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        data = cast(dict[str, Any], response.data)
        image_id = data["id"]
        self.assertIsNone(data["item"])
        self.assertEqual(data["uploaded_by"], str(self.user.pk))

        patch_response = cast(
            Response,
            client.patch(
                reverse("image-detail", args=[image_id]),
                {"is_cover": True, "caption": "Updated"},
                format="multipart",
            ),
        )
        self.assertEqual(patch_response.status_code, status.HTTP_200_OK)
        patch_data = cast(dict[str, Any], patch_response.data)
        self.assertTrue(patch_data["is_cover"])
        self.assertEqual(patch_data["caption"], "Updated")

        delete_response = cast(Response, client.delete(reverse("image-detail", args=[image_id])))
        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(models.Image.objects.filter(pk=image_id).exists())

    def test_user_cannot_force_linking_to_catalog_entities(self) -> None:
        client = cast(APIClient, self.client)
        client.force_authenticate(user=self.user)
        response = cast(
            Response,
            client.post(
                reverse("image-list"),
                {"image_file": self._make_image(), "item": str(self.item.id)},
                format="multipart",
            ),
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        data = cast(dict[str, Any], response.data)
        self.assertIsNone(data["item"])
        image = models.Image.objects.get(pk=data["id"])
        self.assertIsNone(image.item)

    def test_other_users_cannot_delete_submission_images(self) -> None:
        client = cast(APIClient, self.client)
        client.force_authenticate(user=self.user)
        response = cast(
            Response,
            client.post(
                reverse("image-list"),
                {"image_file": self._make_image()},
                format="multipart",
            ),
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        data = cast(dict[str, Any], response.data)
        image_id = data["id"]

        client.force_authenticate(user=self.other_user)
        delete_response = cast(Response, client.delete(reverse("image-detail", args=[image_id])))
        self.assertEqual(delete_response.status_code, status.HTTP_403_FORBIDDEN)