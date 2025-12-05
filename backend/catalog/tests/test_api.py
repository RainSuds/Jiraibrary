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

from catalog import models, serializers


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


class ItemSubmissionSerializerTests(APITestCase):
    def setUp(self) -> None:
        self.user = User.objects.create_user(
            username="submitter",
            email="submitter@example.com",
            password="password123",
        )

    def test_reference_urls_promote_primary_string(self) -> None:
        serializer = serializers.ItemSubmissionSerializer(
            data={
                "title": "Test Dress",
                "brand_name": "Demo Brand",
                "reference_url": "https://primary.example.com",
                "reference_urls": ["https://primary.example.com", "https://secondary.example.com"],
            }
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        submission = serializer.save(user=self.user)
        self.assertEqual(
            submission.reference_urls,
            ["https://primary.example.com", "https://secondary.example.com"],
        )
        self.assertEqual(submission.reference_url, "https://primary.example.com")

    def test_collection_proposal_clears_existing_reference(self) -> None:
        serializer = serializers.ItemSubmissionSerializer(
            data={
                "title": "Test Coat",
                "brand_name": "Demo Brand",
                "collection_reference": "existing-id",
                "collection_proposal": {
                    "name": "Winter Dream",
                    "season": "winter",
                    "year": 2024,
                    "notes": "Community submitted",
                    "brand_slug": "demo-brand",
                },
            }
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        submission = cast(models.ItemSubmission, serializer.save(user=self.user))
        proposal = cast(dict[str, Any], submission.collection_proposal)
        self.assertEqual(proposal["name"], "Winter Dream")
        self.assertEqual(proposal["year"], 2024)
        self.assertEqual(submission.collection_reference, "")

    def test_size_measurements_support_metric_and_imperial_inputs(self) -> None:
        serializer = serializers.ItemSubmissionSerializer(
            data={
                "title": "Measured Jacket",
                "brand_name": "Demo Brand",
                "size_measurements": [
                    {
                        "size_label": "S",
                        "size_category": "alpha",
                        "unit_system": "metric",
                        "bust": "80",
                        "waist": "67",
                    },
                    {
                        "size_label": "M",
                        "unit_system": "imperial",
                        "bust": "32",
                        "notes": "Runs small",
                    },
                ],
            }
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        submission = cast(models.ItemSubmission, serializer.save(user=self.user))
        entries = cast(list[dict[str, Any]], submission.size_measurements)
        self.assertEqual(len(entries), 2)
        first = entries[0]
        self.assertEqual(first["size_label"], "S")
        self.assertAlmostEqual(first["measurements"]["bust_cm"], 80.0)
        self.assertAlmostEqual(first["measurements"]["bust_in"], 31.5, places=1)
        second = entries[1]
        self.assertEqual(second["size_label"], "M")
        self.assertAlmostEqual(second["measurements"]["bust_cm"], 81.28, places=2)
        self.assertEqual(second["notes"], "Runs small")

    def test_one_size_entry_is_auto_labeled_and_unique(self) -> None:
        serializer = serializers.ItemSubmissionSerializer(
            data={
                "title": "One Size Dress",
                "brand_name": "Demo Brand",
                "size_measurements": [
                    {
                        "size_label": "",
                        "size_category": "one_size",
                        "unit_system": "metric",
                        "bust": "90",
                        "waist": "70",
                    }
                ],
            }
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        submission = cast(models.ItemSubmission, serializer.save(user=self.user))
        entries = cast(list[dict[str, Any]], submission.size_measurements)
        self.assertEqual(len(entries), 1)
        only_entry = entries[0]
        self.assertEqual(only_entry["size_label"], "One size")
        self.assertTrue(only_entry["is_one_size"])
        self.assertAlmostEqual(only_entry["measurements"]["bust_cm"], 90.0)

    def test_multiple_one_size_entries_not_allowed(self) -> None:
        serializer = serializers.ItemSubmissionSerializer(
            data={
                "title": "Conflicting Entry",
                "brand_name": "Demo Brand",
                "size_measurements": [
                    {
                        "size_label": "One",
                        "size_category": "one_size",
                        "unit_system": "metric",
                        "bust": "80",
                    },
                    {
                        "size_label": "Two",
                        "size_category": "one_size",
                        "unit_system": "metric",
                        "bust": "82",
                    },
                ],
            }
        )
        self.assertFalse(serializer.is_valid())
        self.assertIn("size_measurements", serializer.errors)


class ItemFavoriteViewSetTests(APITestCase):
    def setUp(self) -> None:
        self.user = User.objects.create_user(
            username="favorites",
            email="favorites@example.com",
            password="password123",
        )
        self.language = models.Language.objects.create(code="en", name="English")
        self.currency = models.Currency.objects.create(code="JPY", name="Yen", symbol="¥")
        self.category = models.Category.objects.create(name="Skirts", slug="skirts")
        self.brand = models.Brand.objects.create(slug="atelier-pierrot", names={"en": "Atelier Pierrot"})
        self.item = models.Item.objects.create(
            slug="sewing-bear-set-up",
            brand=self.brand,
            category=self.category,
            default_language=self.language,
            default_currency=self.currency,
            status=models.Item.ItemStatus.PUBLISHED,
        )
        models.ItemFavorite.objects.create(user=self.user, item=self.item)

    def test_filter_by_slug_does_not_require_uuid(self) -> None:
        client = cast(APIClient, self.client)
        client.force_authenticate(user=self.user)
        response = cast(
            Response,
            client.get(reverse("item-favorite-list"), {"item": self.item.slug}),
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        data = cast(list[dict[str, Any]], response.data)
        self.assertEqual(len(data), 1)
        entry = data[0]
        self.assertEqual(entry["item"], self.item.slug)


class WardrobeEntryViewSetTests(APITestCase):
    def setUp(self) -> None:
        self.user = User.objects.create_user(
            username="wardrobe",
            email="wardrobe@example.com",
            password="password123",
        )
        self.language = models.Language.objects.create(code="en", name="English")
        self.currency = models.Currency.objects.create(code="JPY", name="Yen", symbol="¥")
        self.category = models.Category.objects.create(name="Outerwear", slug="outerwear")
        self.brand = models.Brand.objects.create(slug="yoake", names={"en": "Yoake"})
        self.item = models.Item.objects.create(
            slug="moonlit-cape",
            brand=self.brand,
            category=self.category,
            default_language=self.language,
            default_currency=self.currency,
            status=models.Item.ItemStatus.PUBLISHED,
        )
        self.other_item = models.Item.objects.create(
            slug="sunrise-dress",
            brand=self.brand,
            category=self.category,
            default_language=self.language,
            default_currency=self.currency,
            status=models.Item.ItemStatus.PUBLISHED,
        )

    def test_create_entry_and_list(self) -> None:
        client = cast(APIClient, self.client)
        client.force_authenticate(user=self.user)
        response = cast(
            Response,
            client.post(reverse("wardrobe-entry-list"), {"item": self.item.slug, "note": "To style"}, format="json"),
        )
        self.assertIn(response.status_code, (status.HTTP_200_OK, status.HTTP_201_CREATED), response.data)

        list_response = cast(Response, client.get(reverse("wardrobe-entry-list")))
        self.assertEqual(list_response.status_code, status.HTTP_200_OK, list_response.data)
        data = cast(list[dict[str, Any]], list_response.data)
        self.assertEqual(len(data), 1)
        entry = data[0]
        self.assertEqual(entry["item"], self.item.slug)
        self.assertEqual(entry["note"], "To style")

    def test_filter_by_status(self) -> None:
        client = cast(APIClient, self.client)
        client.force_authenticate(user=self.user)
        models.WardrobeEntry.objects.create(
            user=self.user,
            item=self.item,
            status=models.WardrobeEntry.EntryStatus.OWNED,
        )
        models.WardrobeEntry.objects.create(
            user=self.user,
            item=self.other_item,
            status=models.WardrobeEntry.EntryStatus.WISHLIST,
        )

        response = cast(
            Response,
            client.get(
                reverse("wardrobe-entry-list"),
                {"status": models.WardrobeEntry.EntryStatus.WISHLIST},
            ),
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        data = cast(list[dict[str, Any]], response.data)
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["status"], models.WardrobeEntry.EntryStatus.WISHLIST)
        self.assertEqual(data[0]["item"], self.other_item.slug)

    def test_currency_required_when_price_provided(self) -> None:
        client = cast(APIClient, self.client)
        client.force_authenticate(user=self.user)
        response = cast(
            Response,
            client.post(
                reverse("wardrobe-entry-list"),
                {
                    "item": self.item.slug,
                    "price_paid": "250.00",
                },
                format="json",
            ),
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        error_data = cast(dict[str, Any], response.data)
        self.assertIn("currency", error_data)

    def test_wishlist_cannot_have_acquired_date(self) -> None:
        client = cast(APIClient, self.client)
        client.force_authenticate(user=self.user)
        response = cast(
            Response,
            client.post(
                reverse("wardrobe-entry-list"),
                {
                    "item": self.item.slug,
                    "status": models.WardrobeEntry.EntryStatus.WISHLIST,
                    "acquired_date": "2024-05-10",
                },
                format="json",
            ),
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        error_data = cast(dict[str, Any], response.data)
        self.assertIn("acquired_date", error_data)

    def test_requires_authentication(self) -> None:
        client = cast(APIClient, self.client)
        response = cast(Response, client.get(reverse("wardrobe-entry-list")))
        self.assertIn(response.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))