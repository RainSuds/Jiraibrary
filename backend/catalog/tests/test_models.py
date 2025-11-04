from __future__ import annotations

from django.test import TestCase, override_settings

from catalog import models


class BrandDisplayNameTests(TestCase):
    def test_prefers_english_name(self) -> None:
        brand = models.Brand.objects.create(
            slug="angelic-pretty",
            names={"en": "Angelic Pretty", "jp": "アンジェリックプリティ"},
        )

        self.assertEqual(brand.display_name(), "Angelic Pretty")

    def test_falls_back_to_first_available_name(self) -> None:
        brand = models.Brand.objects.create(
            slug="metamorphose",
            names={"jp": "メタモルフォーゼ"},
        )

        self.assertEqual(brand.display_name(), "メタモルフォーゼ")

    def test_uses_title_case_slug_when_names_missing(self) -> None:
        brand = models.Brand.objects.create(slug="baby-the-stars")

        self.assertEqual(brand.display_name(), "Baby The Stars")


class ItemDisplayNameTests(TestCase):
    @classmethod
    def setUpTestData(cls) -> None:
        cls.language = models.Language.objects.create(code="en", name="English")
        cls.brand = models.Brand.objects.create(slug="innocent-world", names={"en": "Innocent World"})

    def test_prefers_default_language_translation(self) -> None:
        item = models.Item.objects.create(
            slug="classic-jsk",
            brand=self.brand,
            default_language=self.language,
        )
        models.ItemTranslation.objects.create(
            item=item,
            language=self.language,
            name="Classic Jumper Skirt",
        )

        self.assertEqual(item.display_name(), "Classic Jumper Skirt")

    def test_falls_back_to_any_available_translation(self) -> None:
        other_language = models.Language.objects.create(code="jp", name="Japanese")
        item = models.Item.objects.create(
            slug="cat-skirt",
            brand=self.brand,
            default_language=self.language,
        )
        models.ItemTranslation.objects.create(
            item=item,
            language=other_language,
            name="ねこスカート",
        )

        self.assertEqual(item.display_name(), "ねこスカート")

    def test_falls_back_to_slug_when_no_translations(self) -> None:
        item = models.Item.objects.create(
            slug="plain-cutsew",
            brand=self.brand,
            default_language=self.language,
        )

        self.assertEqual(item.display_name(), "plain-cutsew")


@override_settings(AWS_S3_MEDIA_LOCATION="media")
class ImageUploadPathTests(TestCase):
    @classmethod
    def setUpTestData(cls) -> None:
        cls.language = models.Language.objects.create(code="en", name="English")
        cls.brand = models.Brand.objects.create(slug="baby-stars", names={"en": "Baby, the Stars"})
        cls.item = models.Item.objects.create(
            slug="sugar-jsk",
            brand=cls.brand,
            default_language=cls.language,
        )

    def test_item_image_path_uses_brand_and_item(self) -> None:
        image = models.Image(item=self.item)

        path = models.image_upload_to(image, "sample.JPG")

        self.assertEqual(path, "media/catalog/baby-stars/sugar-jsk/baby-stars_sugar-jsk_001.jpg")

    def test_brand_image_path_falls_back_to_type(self) -> None:
        image = models.Image(brand=self.brand, type=models.Image.ImageType.BRAND_LOGO)

        path = models.image_upload_to(image, "logo.PNG")

        self.assertEqual(path, "media/catalog/baby-stars/brand-logo/baby-stars_brand-logo_001.png")

    def test_sequence_increments_with_existing_images(self) -> None:
        models.Image.objects.create(
            item=self.item,
            storage_path="media/catalog/baby-stars/sugar-jsk/baby-stars_sugar-jsk_001.jpg",
        )

        image = models.Image(item=self.item)

        path = models.image_upload_to(image, "another.jpg")

        self.assertEqual(path, "media/catalog/baby-stars/sugar-jsk/baby-stars_sugar-jsk_002.jpg")

    @override_settings(MEDIA_URL="https://cdn.jiraibrary.test/media/")
    def test_media_url_resolves_relative_storage_path(self) -> None:
        image = models.Image(item=self.item)
        image.storage_path = "media/catalog/sample.jpg"

        self.assertEqual(image.media_url, "https://cdn.jiraibrary.test/media/catalog/sample.jpg")

    @override_settings(MEDIA_URL="/media/")
    def test_media_url_handles_site_relative_media_prefix(self) -> None:
        image = models.Image(item=self.item)
        image.storage_path = "media/catalog/relative.jpg"

        self.assertEqual(image.media_url, "/media/catalog/relative.jpg")
