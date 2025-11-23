from __future__ import annotations

from django.test import TestCase

from catalog import models, serializers


class ItemSerializerTests(TestCase):
    @classmethod
    def setUpTestData(cls) -> None:
        cls.language = models.Language.objects.create(code="en", name="English")
        cls.currency = models.Currency.objects.create(code="USD", name="US Dollar", symbol="$")
        cls.brand = models.Brand.objects.create(slug="atelier-boz", names={"en": "Atelier Boz"})
        cls.category = models.Category.objects.create(name="Coats", slug="coats")

    def _create_item(self, slug: str = "velvet-coat") -> models.Item:
        return models.Item.objects.create(
            slug=slug,
            brand=self.brand,
            category=self.category,
            default_language=self.language,
            default_currency=self.currency,
            status=models.Item.ItemStatus.PUBLISHED,
        )

    def test_image_serializer_falls_back_to_placeholder(self) -> None:
        item = self._create_item("placeholder-test")
        image = models.Image.objects.create(item=item)
        serializer = serializers.ImageSerializer(image)

        self.assertEqual(serializer.data["url"], serializers.PLACEHOLDER_IMAGE_URL)

    def test_item_summary_serializer_returns_cover_image_metadata(self) -> None:
        item = self._create_item("cover-test")
        models.Image.objects.create(
            item=item,
            storage_path="https://cdn.example.test/images/cover_test_gallery.jpg",
            is_cover=False,
        )
        cover = models.Image.objects.create(
            item=item,
            storage_path="https://cdn.example.test/images/cover_test_cover.jpg",
            is_cover=True,
        )

        data = serializers.ItemSummarySerializer(item).data

        self.assertEqual(data["cover_image"]["url"], "https://cdn.example.test/images/cover_test_cover.jpg")
        self.assertEqual(data["cover_image"]["id"], str(cover.id))
        self.assertTrue(data["cover_image"]["is_cover"])

    def test_item_detail_gallery_returns_placeholder_when_empty(self) -> None:
        item = self._create_item("gallery-placeholder")

        data = serializers.ItemDetailSerializer(item).data

        self.assertEqual(len(data["gallery"]), 1)
        self.assertEqual(data["gallery"][0]["url"], serializers.PLACEHOLDER_IMAGE_URL)
        self.assertTrue(data["gallery"][0]["is_cover"])
