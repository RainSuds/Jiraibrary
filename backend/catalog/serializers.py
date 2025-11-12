"""Serializers backing the REST API for catalog resources."""
from __future__ import annotations

from decimal import Decimal
from typing import Any, Dict, List, Optional, cast

PLACEHOLDER_IMAGE_URL = "https://placehold.co/600x800?text=Jiraibrary"

from django.db import transaction
from rest_framework import serializers

from . import models


class LanguageSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Language
        fields = ["id", "code", "name", "native_name", "is_supported"]


class CurrencySerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Currency
        fields = ["id", "code", "name", "symbol", "is_active"]


class StyleSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Style
        fields = [
            "id",
            "name",
            "slug",
            "description",
            "created_at",
            "updated_at",
        ]


class BrandTranslationSerializer(serializers.ModelSerializer):
    language = LanguageSerializer(read_only=True)
    language_id = serializers.PrimaryKeyRelatedField(
        source="language",
        queryset=models.Language.objects.all(),
        write_only=True,
    )

    class Meta:
        model = models.BrandTranslation
        fields = [
            "id",
            "language",
            "language_id",
            "name",
            "description",
            "created_at",
            "updated_at",
        ]


class BrandSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()
    item_count = serializers.IntegerField(read_only=True)
    styles = StyleSerializer(many=True, read_only=True)
    substyles = serializers.SerializerMethodField()
    translations = BrandTranslationSerializer(many=True, read_only=True)

    class Meta:
        model = models.Brand
        fields = [
            "id",
            "slug",
            "name",
            "names",
            "descriptions",
            "country",
            "founded_year",
            "icon_url",
            "official_site_url",
            "status",
            "styles",
            "substyles",
            "translations",
            "item_count",
            "created_at",
            "updated_at",
        ]

    def get_name(self, obj: models.Brand) -> str:
        return obj.display_name()

    def get_substyles(self, obj: models.Brand) -> list[dict[str, Any]]:
        substyles_manager = getattr(obj, "substyles", None)
        if substyles_manager is None:
            return []
        results: list[dict[str, Any]] = []
        for substyle in substyles_manager.all():
            style = substyle.style
            results.append(
                {
                    "id": str(substyle.id),
                    "name": substyle.name,
                    "slug": substyle.slug,
                    "style": {
                        "id": str(style.id),
                        "name": style.name,
                        "slug": style.slug,
                    }
                    if style
                    else None,
                }
            )
        return results


class BrandListSerializer(BrandSerializer):
    class Meta(BrandSerializer.Meta):
        fields = ["slug", "name", "icon_url", "country", "item_count", "styles", "substyles"]


class BrandReferenceSerializer(BrandSerializer):
    class Meta(BrandSerializer.Meta):
        fields = ["slug", "name", "icon_url", "country"]


class CollectionSerializer(serializers.ModelSerializer):
    brand = BrandReferenceSerializer(read_only=True)
    brand_id = serializers.PrimaryKeyRelatedField(
        source="brand",
        queryset=models.Brand.objects.all(),
        write_only=True,
    )

    class Meta:
        model = models.Collection
        fields = [
            "id",
            "name",
            "season",
            "year",
            "description",
            "brand",
            "brand_id",
            "created_at",
            "updated_at",
        ]


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Category
        fields = [
            "id",
            "name",
            "slug",
            "description",
            "created_at",
            "updated_at",
        ]


class SubcategorySerializer(serializers.ModelSerializer):
    category = CategorySerializer(read_only=True)
    category_id = serializers.PrimaryKeyRelatedField(
        source="category",
        queryset=models.Category.objects.all(),
        write_only=True,
    )

    class Meta:
        model = models.Subcategory
        fields = [
            "id",
            "name",
            "slug",
            "description",
            "category",
            "category_id",
            "created_at",
            "updated_at",
        ]


class SubstyleSerializer(serializers.ModelSerializer):
    style = StyleSerializer(read_only=True)
    style_id = serializers.PrimaryKeyRelatedField(
        source="style",
        queryset=models.Style.objects.all(),
        write_only=True,
    )

    class Meta:
        model = models.Substyle
        fields = [
            "id",
            "name",
            "slug",
            "description",
            "style",
            "style_id",
            "created_at",
            "updated_at",
        ]


class ColorSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Color
        fields = ["id", "name", "hex_code", "lch_values", "created_at", "updated_at"]


class FabricSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Fabric
        fields = ["id", "name", "description", "created_at", "updated_at"]


class FeatureSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Feature
        fields = [
            "id",
            "name",
            "description",
            "synonyms",
            "category",
            "is_visible",
            "created_at",
            "updated_at",
        ]


class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Tag
        fields = [
            "id",
            "name",
            "slug",
            "description",
            "type",
            "is_featured",
            "created_at",
            "updated_at",
        ]


class TagTranslationSerializer(serializers.ModelSerializer):
    tag = TagSerializer(read_only=True)
    tag_id = serializers.PrimaryKeyRelatedField(
        source="tag",
        queryset=models.Tag.objects.all(),
        write_only=True,
    )
    language = LanguageSerializer(read_only=True)
    language_id = serializers.PrimaryKeyRelatedField(
        source="language",
        queryset=models.Language.objects.all(),
        write_only=True,
    )

    class Meta:
        model = models.TagTranslation
        fields = [
            "id",
            "tag",
            "tag_id",
            "language",
            "language_id",
            "name",
            "description",
            "source",
            "quality",
            "auto_translated",
            "created_at",
            "updated_at",
        ]


class ImageSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = models.Image
        fields = [
            "id",
            "item",
            "brand",
            "variant",
            "storage_path",
            "type",
            "caption",
            "is_cover",
            "width",
            "height",
            "file_size_bytes",
            "hash_signature",
            "dominant_color",
            "source",
            "license",
            "created_at",
            "updated_at",
            "url",
        ]

    def get_url(self, obj: models.Image) -> str:
        media_url = obj.media_url
        if media_url:
            return media_url
        return PLACEHOLDER_IMAGE_URL


class ImageUploadSerializer(serializers.ModelSerializer):
    image_file = serializers.ImageField(write_only=True, required=False, allow_empty_file=False)

    class Meta:
        model = models.Image
        fields = [
            "id",
            "item",
            "brand",
            "variant",
            "type",
            "caption",
            "is_cover",
            "image_file",
            "source",
            "license",
        ]
        read_only_fields = ["id"]
        extra_kwargs = {
            "item": {"required": False, "allow_null": True},
            "brand": {"required": False, "allow_null": True},
            "variant": {"required": False, "allow_null": True},
            "type": {"required": False},
            "caption": {"required": False, "allow_blank": True},
            "is_cover": {"required": False},
            "source": {"required": False, "allow_blank": True},
            "license": {"required": False, "allow_blank": True},
        }

    def to_representation(self, instance: models.Image) -> Dict[str, Any]:  # type: ignore[override]
        return cast(Dict[str, Any], ImageSerializer(instance, context=self.context).data)

    def validate(self, attrs: Dict[str, Any]) -> Dict[str, Any]:  # type: ignore[override]
        if self.instance is None and not attrs.get("image_file"):
            raise serializers.ValidationError({"image_file": "This field is required."})
        return attrs


class ItemImageSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = models.Image
        fields = [
            "id",
            "url",
            "type",
            "is_cover",
            "width",
            "height",
        ]

    def get_url(self, obj: models.Image) -> str:
        media_url = obj.media_url
        if media_url:
            return media_url
        return PLACEHOLDER_IMAGE_URL


class ItemTranslationSerializer(serializers.ModelSerializer):
    language = serializers.SerializerMethodField()

    class Meta:
        model = models.ItemTranslation
        fields = [
            "language",
            "name",
            "description",
            "pattern",
            "fit",
            "length",
            "occasion",
            "season",
            "lining",
            "closure_type",
            "care_instructions",
        ]

    def get_language(self, obj: models.ItemTranslation) -> str | None:
        return obj.language.code if obj.language else None


class ItemPriceSerializer(serializers.ModelSerializer):
    currency = serializers.SerializerMethodField()

    class Meta:
        model = models.ItemPrice
        fields = ["currency", "amount", "source", "rate_used"]

    def get_currency(self, obj: models.ItemPrice) -> str:
        return obj.currency.code


class ItemVariantSerializer(serializers.ModelSerializer):
    label = serializers.CharField(source="variant_label")
    color = serializers.SerializerMethodField()

    class Meta:
        model = models.ItemVariant
        fields = ["label", "sku", "color", "size_descriptor", "stock_status", "notes"]

    def get_color(self, obj: models.ItemVariant) -> str | None:
        color_id = getattr(obj, "color_id", None)
        return str(color_id) if color_id else None


class ItemMeasurementSerializer(serializers.ModelSerializer):
    variant = ItemVariantSerializer(read_only=True)

    class Meta:
        model = models.ItemMeasurement
        fields = [
            "id",
            "variant",
            "is_one_size",
            "bust_cm",
            "waist_cm",
            "hip_cm",
            "length_cm",
            "sleeve_length_cm",
            "hem_cm",
            "heel_height_cm",
            "bag_depth_cm",
            "fit_notes",
            "created_at",
            "updated_at",
        ]


class ItemMetadataSerializer(serializers.ModelSerializer):
    ai_confidence = serializers.SerializerMethodField()

    class Meta:
        model = models.ItemMetadata
        fields = [
            "pattern",
            "sleeve_type",
            "occasion",
            "season",
            "fit",
            "length",
            "lining",
            "closure_type",
            "care_instructions",
            "inspiration",
            "ai_confidence",
        ]

    def get_ai_confidence(self, obj: models.ItemMetadata) -> str | None:
        return str(obj.ai_confidence) if obj.ai_confidence is not None else None


class ItemSummarySerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()
    brand = serializers.SerializerMethodField()
    category = serializers.SerializerMethodField()
    primary_price = serializers.SerializerMethodField()
    colors = serializers.SerializerMethodField()
    tags = serializers.SerializerMethodField()
    cover_image = serializers.SerializerMethodField()

    class Meta:
        model = models.Item
        fields = [
            "slug",
            "name",
            "brand",
            "category",
            "release_year",
            "has_matching_set",
            "verified_source",
            "primary_price",
            "colors",
            "tags",
            "status",
            "cover_image",
        ]

    def get_name(self, obj: models.Item) -> str:
        return obj.display_name()

    def get_brand(self, obj: models.Item) -> dict | None:
        brand = getattr(obj, "brand", None)
        if not brand:
            return None
        return cast(Dict[str, Any], BrandReferenceSerializer(brand).data)

    def get_category(self, obj: models.Item) -> dict | None:
        category = getattr(obj, "category", None)
        if not category:
            return None
        return {"id": str(category.pk), "name": category.name}

    def get_primary_price(self, obj: models.Item) -> dict | None:
        prices_manager: Any = getattr(obj, "prices", None)
        if prices_manager is None:
            return None
        prices = list(prices_manager.all())
        if not prices:
            return None
        primary = next(
            (price for price in prices if price.source == models.ItemPrice.Source.ORIGIN),
            prices[0],
        )
        return cast(Dict[str, Any], ItemPriceSerializer(primary).data)

    def get_colors(self, obj: models.Item) -> list[dict]:
        item_color_manager: Any = getattr(obj, "itemcolor_set", None)
        if item_color_manager is None:
            return []
        results: list[dict] = []
        for item_color in item_color_manager.all():
            color = item_color.color
            if not color:
                continue
            results.append(
                {
                    "id": str(color.id),
                    "name": color.name,
                    "hex": color.hex_code,
                    "is_primary": item_color.is_primary,
                }
            )
        return results

    def get_tags(self, obj: models.Item) -> list[dict]:
        tag_manager: Any = getattr(obj, "tags", None)
        if tag_manager is None:
            return []
        return [
            {
                "id": str(tag.id),
                "name": tag.name,
                "type": tag.type,
                "slug": tag.slug,
            }
            for tag in tag_manager.all()
        ]

    def get_cover_image(self, obj: models.Item) -> dict[str, Any]:
        images_manager: Any = getattr(obj, "images", None)
        if images_manager is None:
            return {"id": None, "url": PLACEHOLDER_IMAGE_URL, "is_cover": True}
        images = list(images_manager.all())
        if not images:
            return {"id": None, "url": PLACEHOLDER_IMAGE_URL, "is_cover": True}
        cover = next((image for image in images if image.is_cover), images[0])
        serializer = ItemImageSerializer(cover)
        data = cast(Dict[str, Any], serializer.data)
        return {
            "id": str(cover.id) if cover.id else None,
            "url": data.get("url", PLACEHOLDER_IMAGE_URL),
            "is_cover": cover.is_cover,
        }


class ItemDetailSerializer(ItemSummarySerializer):
    id = serializers.UUIDField(read_only=True)
    default_language = serializers.SerializerMethodField()
    default_currency = serializers.SerializerMethodField()
    release_date = serializers.DateField(required=False, allow_null=True)
    limited_edition = serializers.BooleanField()
    metadata = serializers.SerializerMethodField()
    extra_metadata = serializers.SerializerMethodField()
    translations = serializers.SerializerMethodField()
    prices = serializers.SerializerMethodField()
    variants = serializers.SerializerMethodField()
    collections = serializers.SerializerMethodField()
    substyles = serializers.SerializerMethodField()
    fabrics = serializers.SerializerMethodField()
    features = serializers.SerializerMethodField()
    gallery = serializers.SerializerMethodField()

    class Meta(ItemSummarySerializer.Meta):
        fields = ItemSummarySerializer.Meta.fields + [
            "id",
            "default_language",
            "default_currency",
            "release_date",
            "limited_edition",
            "metadata",
            "extra_metadata",
            "translations",
            "prices",
            "variants",
            "collections",
            "substyles",
            "fabrics",
            "features",
            "gallery",
        ]

    def get_default_language(self, obj: models.Item) -> str | None:
        return obj.default_language.code if obj.default_language else None

    def get_default_currency(self, obj: models.Item) -> str | None:
        return obj.default_currency.code if obj.default_currency else None

    def get_metadata(self, obj: models.Item) -> dict | None:
        metadata = getattr(obj, "metadata", None)
        if metadata is None:
            return None
        return cast(Dict[str, Any], ItemMetadataSerializer(metadata).data)

    def get_extra_metadata(self, obj: models.Item) -> dict:
        return obj.extra_metadata or {}

    def get_translations(self, obj: models.Item) -> list[dict]:
        translations_manager: Any = getattr(obj, "translations", None)
        if translations_manager is None:
            return []
        return cast(List[Dict[str, Any]], ItemTranslationSerializer(translations_manager.all(), many=True).data)

    def get_prices(self, obj: models.Item) -> list[dict]:
        prices_manager: Any = getattr(obj, "prices", None)
        if prices_manager is None:
            return []
        return cast(List[Dict[str, Any]], ItemPriceSerializer(prices_manager.all(), many=True).data)

    def get_variants(self, obj: models.Item) -> list[dict]:
        variants_manager: Any = getattr(obj, "variants", None)
        if variants_manager is None:
            return []
        return cast(List[Dict[str, Any]], ItemVariantSerializer(variants_manager.all(), many=True).data)

    def get_collections(self, obj: models.Item) -> list[dict]:
        collection_links: Any = getattr(obj, "itemcollection_set", None)
        if collection_links is None:
            return []
        results: list[dict] = []
        for link in collection_links.all():
            collection = getattr(link, "collection", None)
            if not collection:
                continue
            results.append(
                {
                    "id": str(collection.id),
                    "name": collection.name,
                    "season": collection.season,
                    "year": collection.year,
                    "brand_slug": collection.brand.slug if collection.brand else None,
                    "role": link.role,
                }
            )
        return results

    def get_substyles(self, obj: models.Item) -> list[dict]:
        substyle_links: Any = getattr(obj, "itemsubstyle_set", None)
        if substyle_links is None:
            return []
        results: list[dict] = []
        for link in substyle_links.all():
            substyle = getattr(link, "substyle", None)
            if not substyle:
                continue
            style = getattr(substyle, "style", None)
            results.append(
                {
                    "id": str(substyle.id),
                    "name": substyle.name,
                    "slug": substyle.slug,
                    "style": {
                        "id": str(style.id),
                        "name": style.name,
                        "slug": style.slug,
                    }
                    if style
                    else None,
                    "weight": str(link.weight) if link.weight is not None else None,
                }
            )
        return results

    def get_fabrics(self, obj: models.Item) -> list[dict]:
        fabric_links: Any = getattr(obj, "itemfabric_set", None)
        if fabric_links is None:
            return []
        results: list[dict] = []
        for link in fabric_links.all():
            fabric = getattr(link, "fabric", None)
            if not fabric:
                continue
            results.append(
                {
                    "id": str(fabric.id),
                    "name": fabric.name,
                    "percentage": str(link.percentage) if link.percentage is not None else None,
                }
            )
        return results

    def get_features(self, obj: models.Item) -> list[dict]:
        feature_links: Any = getattr(obj, "itemfeature_set", None)
        if feature_links is None:
            return []
        results: list[dict] = []
        for link in feature_links.all():
            feature = getattr(link, "feature", None)
            if not feature:
                continue
            results.append(
                {
                    "id": str(feature.id),
                    "name": feature.name,
                    "category": feature.category,
                    "is_prominent": link.is_prominent,
                    "notes": link.notes,
                }
            )
        return results

    def get_gallery(self, obj: models.Item) -> list[dict]:
        images_manager: Any = getattr(obj, "images", None)
        if images_manager is None:
            return [
                {
                    "id": None,
                    "url": PLACEHOLDER_IMAGE_URL,
                    "type": models.Image.ImageType.COVER,
                    "is_cover": True,
                    "width": None,
                    "height": None,
                }
            ]
        images = list(images_manager.all())
        if not images:
            return [
                {
                    "id": None,
                    "url": PLACEHOLDER_IMAGE_URL,
                    "type": models.Image.ImageType.COVER,
                    "is_cover": True,
                    "width": None,
                    "height": None,
                }
            ]
        return cast(List[Dict[str, Any]], ItemImageSerializer(images, many=True).data)


class ItemMetadataInputSerializer(serializers.Serializer):
    pattern = serializers.CharField(required=False, allow_blank=True)
    sleeve_type = serializers.CharField(required=False, allow_blank=True)
    occasion = serializers.CharField(required=False, allow_blank=True)
    season = serializers.CharField(required=False, allow_blank=True)
    fit = serializers.CharField(required=False, allow_blank=True)
    length = serializers.CharField(required=False, allow_blank=True)
    lining = serializers.CharField(required=False, allow_blank=True)
    closure_type = serializers.CharField(required=False, allow_blank=True)
    care_instructions = serializers.CharField(required=False, allow_blank=True)
    inspiration = serializers.CharField(required=False, allow_blank=True)
    ai_confidence = serializers.DecimalField(max_digits=5, decimal_places=2, required=False, allow_null=True)


class ItemTranslationInputSerializer(serializers.Serializer):
    language = serializers.CharField()
    dialect = serializers.CharField(required=False, allow_blank=True)
    name = serializers.CharField()
    description = serializers.CharField(required=False, allow_blank=True)
    pattern = serializers.CharField(required=False, allow_blank=True)
    fit = serializers.CharField(required=False, allow_blank=True)
    length = serializers.CharField(required=False, allow_blank=True)
    occasion = serializers.CharField(required=False, allow_blank=True)
    season = serializers.CharField(required=False, allow_blank=True)
    lining = serializers.CharField(required=False, allow_blank=True)
    closure_type = serializers.CharField(required=False, allow_blank=True)
    care_instructions = serializers.CharField(required=False, allow_blank=True)
    source = serializers.ChoiceField(choices=models.ItemTranslation.Source.choices, required=False)
    quality = serializers.ChoiceField(choices=models.ItemTranslation.Quality.choices, required=False)
    auto_translated = serializers.BooleanField(required=False)


class ItemPriceInputSerializer(serializers.Serializer):
    currency = serializers.CharField()
    amount = serializers.DecimalField(max_digits=10, decimal_places=2)
    source = serializers.ChoiceField(choices=models.ItemPrice.Source.choices, required=False)
    rate_used = serializers.DecimalField(max_digits=12, decimal_places=6, required=False, allow_null=True)
    valid_from = serializers.DateField(required=False, allow_null=True)
    valid_to = serializers.DateField(required=False, allow_null=True)


class ItemVariantInputSerializer(serializers.Serializer):
    label = serializers.CharField()
    sku = serializers.CharField(required=False, allow_blank=True)
    color = serializers.UUIDField(required=False, allow_null=True)
    size_descriptor = serializers.CharField(required=False, allow_blank=True)
    stock_status = serializers.ChoiceField(choices=models.ItemVariant.StockStatus.choices, required=False)
    notes = serializers.JSONField(required=False)


class ItemMeasurementInputSerializer(serializers.Serializer):
    variant_label = serializers.CharField(required=False, allow_blank=True)
    is_one_size = serializers.BooleanField(required=False)
    bust_cm = serializers.DecimalField(max_digits=6, decimal_places=2, required=False, allow_null=True)
    waist_cm = serializers.DecimalField(max_digits=6, decimal_places=2, required=False, allow_null=True)
    hip_cm = serializers.DecimalField(max_digits=6, decimal_places=2, required=False, allow_null=True)
    length_cm = serializers.DecimalField(max_digits=6, decimal_places=2, required=False, allow_null=True)
    sleeve_length_cm = serializers.DecimalField(max_digits=6, decimal_places=2, required=False, allow_null=True)
    hem_cm = serializers.DecimalField(max_digits=6, decimal_places=2, required=False, allow_null=True)
    heel_height_cm = serializers.DecimalField(max_digits=6, decimal_places=2, required=False, allow_null=True)
    bag_depth_cm = serializers.DecimalField(max_digits=6, decimal_places=2, required=False, allow_null=True)
    fit_notes = serializers.CharField(required=False, allow_blank=True)


class ItemTagInputSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    tag_context = serializers.ChoiceField(choices=models.ItemTag.TagContext.choices, required=False)
    confidence = serializers.DecimalField(max_digits=4, decimal_places=2, required=False, allow_null=True)


class ItemColorInputSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    is_primary = serializers.BooleanField(required=False)


class ItemSubstyleInputSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    weight = serializers.DecimalField(max_digits=4, decimal_places=2, required=False, allow_null=True)


class ItemFabricInputSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    percentage = serializers.DecimalField(max_digits=5, decimal_places=2, required=False, allow_null=True)


class ItemFeatureInputSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    is_prominent = serializers.BooleanField(required=False)
    notes = serializers.CharField(required=False, allow_blank=True)


class ItemCollectionInputSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    role = serializers.ChoiceField(choices=models.ItemCollection.CollectionRole.choices, required=False)


class ItemImageLinkSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    type = serializers.ChoiceField(choices=models.Image.ImageType.choices, required=False)
    is_cover = serializers.BooleanField(required=False)
    caption = serializers.CharField(required=False, allow_blank=True)
    variant_label = serializers.CharField(required=False, allow_blank=True)


class ItemWriteSerializer(serializers.Serializer):
    slug = serializers.SlugField()
    brand_slug = serializers.SlugField()
    category_id = serializers.UUIDField(required=False, allow_null=True)
    subcategory_id = serializers.UUIDField(required=False, allow_null=True)
    origin_country = serializers.CharField(required=False, allow_blank=True, max_length=2)
    default_language = serializers.CharField(required=False, allow_blank=True)
    default_currency = serializers.CharField(required=False, allow_blank=True)
    release_year = serializers.IntegerField(required=False, allow_null=True)
    release_date = serializers.DateField(required=False, allow_null=True)
    collaboration = serializers.CharField(required=False, allow_blank=True)
    limited_edition = serializers.BooleanField(required=False)
    has_matching_set = serializers.BooleanField(required=False)
    verified_source = serializers.BooleanField(required=False)
    status = serializers.ChoiceField(choices=models.Item.ItemStatus.choices, required=False)
    extra_metadata = serializers.JSONField(required=False)
    metadata = ItemMetadataInputSerializer(required=False)
    translations = ItemTranslationInputSerializer(many=True)
    tags = ItemTagInputSerializer(many=True, required=False)
    colors = ItemColorInputSerializer(many=True, required=False)
    substyles = ItemSubstyleInputSerializer(many=True, required=False)
    fabrics = ItemFabricInputSerializer(many=True, required=False)
    features = ItemFeatureInputSerializer(many=True, required=False)
    collections = ItemCollectionInputSerializer(many=True, required=False)
    prices = ItemPriceInputSerializer(many=True, required=False)
    variants = ItemVariantInputSerializer(many=True, required=False)
    measurements = ItemMeasurementInputSerializer(many=True, required=False)
    images = ItemImageLinkSerializer(many=True, required=False)

    def validate_translations(self, value: List[dict]) -> List[dict]:  # type: ignore[override]
        if not value:
            raise serializers.ValidationError("At least one translation entry is required.")
        return value

    def create(self, validated_data: Dict[str, Any]) -> models.Item:  # type: ignore[override]
        return self._save(validated_data)

    def update(self, instance: models.Item, validated_data: Dict[str, Any]) -> models.Item:  # type: ignore[override]
        return self._save(validated_data, instance=instance)

    def to_representation(self, instance: models.Item) -> Dict[str, Any]:  # type: ignore[override]
        instance.refresh_from_db()
        return cast(Dict[str, Any], ItemDetailSerializer(instance, context=self.context).data)

    def _save(self, validated_data: Dict[str, Any], instance: Optional[models.Item] = None) -> models.Item:
        translations_data = validated_data.pop("translations", [])
        metadata_data = validated_data.pop("metadata", None)
        tags_data = validated_data.pop("tags", [])
        colors_data = validated_data.pop("colors", [])
        substyles_data = validated_data.pop("substyles", [])
        fabrics_data = validated_data.pop("fabrics", [])
        features_data = validated_data.pop("features", [])
        collections_data = validated_data.pop("collections", [])
        prices_data = validated_data.pop("prices", [])
        variants_data = validated_data.pop("variants", [])
        measurements_data = validated_data.pop("measurements", [])
        images_data = validated_data.pop("images", [])

        brand_slug = validated_data.pop("brand_slug")
        try:
            brand = models.Brand.objects.get(slug=brand_slug)
        except models.Brand.DoesNotExist as exc:  # pragma: no cover - defensive
            raise serializers.ValidationError({"brand_slug": f"Unknown brand slug '{brand_slug}'."}) from exc
        validated_data["brand"] = brand

        category = self._resolve_category(validated_data.pop("category_id", None))
        subcategory = self._resolve_subcategory(validated_data.pop("subcategory_id", None))
        validated_data["category"] = category
        validated_data["subcategory"] = subcategory

        validated_data["default_language"] = self._resolve_language(validated_data.pop("default_language", None))
        validated_data["default_currency"] = self._resolve_currency(validated_data.pop("default_currency", None))

        extra_metadata = validated_data.pop("extra_metadata", None)
        if extra_metadata is not None and not isinstance(extra_metadata, dict):
            raise serializers.ValidationError({"extra_metadata": "Expected a mapping object."})
        validated_data["extra_metadata"] = extra_metadata or {}

        validated_data.setdefault("limited_edition", False)
        validated_data.setdefault("has_matching_set", False)
        validated_data.setdefault("verified_source", False)

        request = self.context.get("request")

        with transaction.atomic():
            if instance is None:
                item = models.Item.objects.create(**validated_data)
                if request and hasattr(request, "user") and request.user.is_authenticated:
                    item.submitted_by = request.user
                    item.save(update_fields=["submitted_by"])
            else:
                for attr, value in validated_data.items():
                    setattr(instance, attr, value)
                instance.save()
                item = instance

            self._sync_metadata(item, metadata_data)
            self._sync_translations(item, translations_data)
            self._sync_tags(item, tags_data)
            self._sync_colors(item, colors_data)
            self._sync_substyles(item, substyles_data)
            self._sync_fabrics(item, fabrics_data)
            self._sync_features(item, features_data)
            self._sync_collections(item, collections_data)
            self._sync_prices(item, prices_data)
            variant_map = self._sync_variants(item, variants_data)
            self._sync_measurements(item, measurements_data, variant_map)
            self._sync_images(item, images_data, variant_map)

        item.refresh_from_db()
        return item

    def _resolve_category(self, category_id: Optional[Any]) -> Optional[models.Category]:
        if not category_id:
            return None
        try:
            return models.Category.objects.get(id=category_id)
        except models.Category.DoesNotExist as exc:  # pragma: no cover - defensive
            raise serializers.ValidationError({"category_id": f"Unknown category id '{category_id}'."}) from exc

    def _resolve_subcategory(self, subcategory_id: Optional[Any]) -> Optional[models.Subcategory]:
        if not subcategory_id:
            return None
        try:
            return models.Subcategory.objects.get(id=subcategory_id)
        except models.Subcategory.DoesNotExist as exc:  # pragma: no cover - defensive
            raise serializers.ValidationError({"subcategory_id": f"Unknown subcategory id '{subcategory_id}'."}) from exc

    def _resolve_language(self, language_code: Optional[str]) -> Optional[models.Language]:
        if not language_code:
            return None
        try:
            return models.Language.objects.get(code=language_code)
        except models.Language.DoesNotExist as exc:  # pragma: no cover - defensive
            raise serializers.ValidationError({"default_language": f"Unknown language code '{language_code}'."}) from exc

    def _resolve_currency(self, currency_code: Optional[str]) -> Optional[models.Currency]:
        if not currency_code:
            return None
        try:
            return models.Currency.objects.get(code=currency_code)
        except models.Currency.DoesNotExist as exc:  # pragma: no cover - defensive
            raise serializers.ValidationError({"default_currency": f"Unknown currency code '{currency_code}'."}) from exc

    def _sync_metadata(self, item: models.Item, metadata_data: Optional[Dict[str, Any]]) -> None:
        if metadata_data:
            models.ItemMetadata.objects.update_or_create(item=item, defaults=metadata_data)
        else:
            models.ItemMetadata.objects.filter(item=item).delete()

    def _sync_translations(self, item: models.Item, entries: List[Dict[str, Any]]) -> None:
        models.ItemTranslation.objects.filter(item=item).delete()
        for entry in entries:
            language_code = entry.get("language")
            language = self._resolve_language(language_code)
            if language is None:
                raise serializers.ValidationError({"translations": f"Unknown language code '{language_code}'."})
            models.ItemTranslation.objects.create(
                item=item,
                language=language,
                dialect=entry.get("dialect", ""),
                name=entry.get("name", ""),
                description=entry.get("description", ""),
                pattern=entry.get("pattern", ""),
                fit=entry.get("fit", ""),
                length=entry.get("length", ""),
                occasion=entry.get("occasion", ""),
                season=entry.get("season", ""),
                lining=entry.get("lining", ""),
                closure_type=entry.get("closure_type", ""),
                care_instructions=entry.get("care_instructions", ""),
                source=entry.get("source", models.ItemTranslation.Source.USER),
                quality=entry.get("quality", models.ItemTranslation.Quality.DRAFT),
                auto_translated=entry.get("auto_translated", False),
            )

    def _sync_tags(self, item: models.Item, entries: List[Dict[str, Any]]) -> None:
        models.ItemTag.objects.filter(item=item).delete()
        for entry in entries:
            tag_id = entry.get("id")
            try:
                tag = models.Tag.objects.get(id=tag_id)
            except models.Tag.DoesNotExist as exc:  # pragma: no cover - defensive
                raise serializers.ValidationError({"tags": f"Unknown tag id '{tag_id}'."}) from exc
            models.ItemTag.objects.create(
                item=item,
                tag=tag,
                context=entry.get("tag_context", models.ItemTag.TagContext.PRIMARY),
                confidence=entry.get("confidence"),
            )

    def _sync_colors(self, item: models.Item, entries: List[Dict[str, Any]]) -> None:
        models.ItemColor.objects.filter(item=item).delete()
        for entry in entries:
            color_id = entry.get("id")
            try:
                color = models.Color.objects.get(id=color_id)
            except models.Color.DoesNotExist as exc:  # pragma: no cover - defensive
                raise serializers.ValidationError({"colors": f"Unknown color id '{color_id}'."}) from exc
            models.ItemColor.objects.create(
                item=item,
                color=color,
                is_primary=entry.get("is_primary", False),
            )

    def _sync_substyles(self, item: models.Item, entries: List[Dict[str, Any]]) -> None:
        models.ItemSubstyle.objects.filter(item=item).delete()
        for entry in entries:
            substyle_id = entry.get("id")
            try:
                substyle = models.Substyle.objects.get(id=substyle_id)
            except models.Substyle.DoesNotExist as exc:  # pragma: no cover - defensive
                raise serializers.ValidationError({"substyles": f"Unknown substyle id '{substyle_id}'."}) from exc
            models.ItemSubstyle.objects.create(
                item=item,
                substyle=substyle,
                weight=entry.get("weight"),
            )

    def _sync_fabrics(self, item: models.Item, entries: List[Dict[str, Any]]) -> None:
        models.ItemFabric.objects.filter(item=item).delete()
        for entry in entries:
            fabric_id = entry.get("id")
            try:
                fabric = models.Fabric.objects.get(id=fabric_id)
            except models.Fabric.DoesNotExist as exc:  # pragma: no cover - defensive
                raise serializers.ValidationError({"fabrics": f"Unknown fabric id '{fabric_id}'."}) from exc
            models.ItemFabric.objects.create(
                item=item,
                fabric=fabric,
                percentage=entry.get("percentage"),
            )

    def _sync_features(self, item: models.Item, entries: List[Dict[str, Any]]) -> None:
        models.ItemFeature.objects.filter(item=item).delete()
        for entry in entries:
            feature_id = entry.get("id")
            try:
                feature = models.Feature.objects.get(id=feature_id)
            except models.Feature.DoesNotExist as exc:  # pragma: no cover - defensive
                raise serializers.ValidationError({"features": f"Unknown feature id '{feature_id}'."}) from exc
            models.ItemFeature.objects.create(
                item=item,
                feature=feature,
                is_prominent=entry.get("is_prominent", False),
                notes=entry.get("notes", ""),
            )

    def _sync_collections(self, item: models.Item, entries: List[Dict[str, Any]]) -> None:
        models.ItemCollection.objects.filter(item=item).delete()
        for entry in entries:
            collection_id = entry.get("id")
            try:
                collection = models.Collection.objects.get(id=collection_id)
            except models.Collection.DoesNotExist as exc:  # pragma: no cover - defensive
                raise serializers.ValidationError({"collections": f"Unknown collection id '{collection_id}'."}) from exc
            models.ItemCollection.objects.create(
                item=item,
                collection=collection,
                role=entry.get("role", models.ItemCollection.CollectionRole.MAINLINE),
            )

    def _sync_prices(self, item: models.Item, entries: List[Dict[str, Any]]) -> None:
        models.ItemPrice.objects.filter(item=item).delete()
        for entry in entries:
            currency_code = entry.get("currency")
            currency = self._resolve_currency(currency_code)
            if currency is None:
                raise serializers.ValidationError({"prices": f"Unknown currency code '{currency_code}'."})
            models.ItemPrice.objects.create(
                item=item,
                currency=currency,
                amount=entry.get("amount", Decimal("0.00")),
                source=entry.get("source", models.ItemPrice.Source.ORIGIN),
                rate_used=entry.get("rate_used"),
                valid_from=entry.get("valid_from"),
                valid_to=entry.get("valid_to"),
            )

    def _sync_variants(self, item: models.Item, entries: List[Dict[str, Any]]) -> Dict[str, models.ItemVariant]:
        models.ItemVariant.objects.filter(item=item).delete()
        variant_map: Dict[str, models.ItemVariant] = {}
        for entry in entries:
            color_id = entry.get("color")
            color = None
            if color_id:
                try:
                    color = models.Color.objects.get(id=color_id)
                except models.Color.DoesNotExist as exc:  # pragma: no cover - defensive
                    raise serializers.ValidationError({"variants": f"Unknown color id '{color_id}'."}) from exc
            variant = models.ItemVariant.objects.create(
                item=item,
                variant_label=entry.get("label", ""),
                sku=entry.get("sku", ""),
                color=color,
                size_descriptor=entry.get("size_descriptor", ""),
                stock_status=entry.get("stock_status", models.ItemVariant.StockStatus.UNKNOWN),
                notes=entry.get("notes") or {},
            )
            variant_map[variant.variant_label.lower()] = variant
        return variant_map

    def _sync_measurements(
        self,
        item: models.Item,
        entries: List[Dict[str, Any]],
        variant_map: Dict[str, models.ItemVariant],
    ) -> None:
        models.ItemMeasurement.objects.filter(item=item).delete()
        for entry in entries:
            variant_label_raw = entry.get("variant_label", "") or ""
            variant_key = variant_label_raw.strip().lower()
            variant = None
            if variant_key:
                variant = variant_map.get(variant_key)
                if variant is None:
                    raise serializers.ValidationError(
                        {"measurements": f"Unknown variant label '{variant_label_raw}' referenced by measurements."}
                    )
            models.ItemMeasurement.objects.create(
                item=item,
                variant=variant,
                is_one_size=entry.get("is_one_size", False),
                bust_cm=entry.get("bust_cm"),
                waist_cm=entry.get("waist_cm"),
                hip_cm=entry.get("hip_cm"),
                length_cm=entry.get("length_cm"),
                sleeve_length_cm=entry.get("sleeve_length_cm"),
                hem_cm=entry.get("hem_cm"),
                heel_height_cm=entry.get("heel_height_cm"),
                bag_depth_cm=entry.get("bag_depth_cm"),
                fit_notes=entry.get("fit_notes", ""),
            )

    def _sync_images(
        self,
        item: models.Item,
        entries: List[Dict[str, Any]],
        variant_map: Dict[str, models.ItemVariant],
    ) -> None:
        provided_ids: list[Any] = []
        cover_assigned = False
        for entry in entries:
            image_id = entry.get("id")
            try:
                image = models.Image.objects.get(id=image_id)
            except models.Image.DoesNotExist as exc:  # pragma: no cover - defensive
                raise serializers.ValidationError({"images": f"Unknown image id '{image_id}'."}) from exc
            if image.item and image.item != item:
                raise serializers.ValidationError({"images": f"Image '{image_id}' is already attached to another item."})
            variant_label_raw = entry.get("variant_label", "") or ""
            variant_key = variant_label_raw.strip().lower()
            variant = None
            if variant_key:
                variant = variant_map.get(variant_key)
                if variant is None:
                    raise serializers.ValidationError(
                        {"images": f"Unknown variant label '{variant_label_raw}' referenced by image '{image_id}'."}
                    )
            image.item = item
            image.variant = variant
            image.type = entry.get("type", models.Image.ImageType.GALLERY)
            image.caption = entry.get("caption", "")
            is_cover = bool(entry.get("is_cover", False))
            if is_cover and not cover_assigned:
                image.is_cover = True
                cover_assigned = True
            else:
                image.is_cover = False
            image.save()
            provided_ids.append(image.id)

        if entries and not cover_assigned and provided_ids:
            models.Image.objects.filter(id=provided_ids[0]).update(is_cover=True)

        if provided_ids:
            models.Image.objects.filter(item=item).exclude(id__in=provided_ids).update(item=None, variant=None, is_cover=False)


class ItemFavoriteSerializer(serializers.ModelSerializer):
    item = serializers.SlugRelatedField(slug_field="slug", queryset=models.Item.objects.all())
    item_detail = ItemSummarySerializer(source="item", read_only=True)

    class Meta:
        model = models.ItemFavorite
        fields = ["id", "item", "item_detail", "created_at"]
        read_only_fields = ["id", "item_detail", "created_at"]


class ItemSubmissionNameSerializer(serializers.Serializer):
    language = serializers.CharField()
    value = serializers.CharField()

    def validate_language(self, value: str) -> str:  # type: ignore[override]
        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError("Language code is required.")
        return cleaned

    def validate_value(self, value: str) -> str:  # type: ignore[override]
        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError("Name value cannot be empty.")
        return cleaned


class ItemSubmissionDescriptionSerializer(serializers.Serializer):
    language = serializers.CharField()
    value = serializers.CharField()

    def validate_language(self, value: str) -> str:  # type: ignore[override]
        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError("Language code is required.")
        return cleaned

    def validate_value(self, value: str) -> str:  # type: ignore[override]
        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError("Description value cannot be empty.")
        return cleaned


class ItemSubmissionFabricSerializer(serializers.Serializer):
    fabric = serializers.CharField()
    percentage = serializers.DecimalField(max_digits=6, decimal_places=2, required=False, allow_null=True)

    def validate_fabric(self, value: str) -> str:  # type: ignore[override]
        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError("Fabric slug is required.")
        return cleaned


class ItemSubmissionPriceSerializer(serializers.Serializer):
    currency = serializers.CharField()
    amount = serializers.DecimalField(max_digits=12, decimal_places=2)

    def validate_currency(self, value: str) -> str:  # type: ignore[override]
        cleaned = value.strip().upper()
        if len(cleaned) != 3:
            raise serializers.ValidationError("Currency codes must be ISO-4217 (3 characters).")
        return cleaned


class ItemSubmissionSerializer(serializers.ModelSerializer):
    user = serializers.PrimaryKeyRelatedField(read_only=True)
    status = serializers.CharField(read_only=True)
    moderator_notes = serializers.CharField(read_only=True)
    linked_item = serializers.SlugRelatedField(
        slug_field="slug",
        queryset=models.Item.objects.all(),
        required=False,
        allow_null=True,
    )
    name_translations = ItemSubmissionNameSerializer(many=True, required=False)
    description_translations = ItemSubmissionDescriptionSerializer(many=True, required=False)
    style_slugs = serializers.ListField(child=serializers.CharField(), required=False)
    substyle_slugs = serializers.ListField(child=serializers.CharField(), required=False)
    color_slugs = serializers.ListField(child=serializers.CharField(), required=False)
    feature_slugs = serializers.ListField(child=serializers.CharField(), required=False)
    fabric_breakdown = ItemSubmissionFabricSerializer(many=True, required=False)
    price_amounts = ItemSubmissionPriceSerializer(many=True, required=False)
    tags = serializers.ListField(child=serializers.CharField(), required=False)

    class Meta:
        model = models.ItemSubmission
        fields = [
            "id",
            "user",
            "item_slug",
            "title",
            "brand_name",
            "description",
            "reference_url",
            "image_url",
            "tags",
            "name_translations",
            "description_translations",
            "release_year",
            "category_slug",
            "subcategory_slug",
            "style_slugs",
            "substyle_slugs",
            "color_slugs",
            "fabric_breakdown",
            "feature_slugs",
            "collection_reference",
            "price_amounts",
            "origin_country",
            "production_country",
            "limited_edition",
            "has_matching_set",
            "verified_source",
            "status",
            "moderator_notes",
            "linked_item",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "user",
            "status",
            "moderator_notes",
            "linked_item",
            "created_at",
            "updated_at",
        ]

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:  # type: ignore[override]
        name_entries = attrs.get("name_translations")
        if name_entries is None:
            initial_translations = None
            raw_initial = getattr(self, "initial_data", None)
            if isinstance(raw_initial, dict):
                initial_translations = raw_initial.get("name_translations")
            if isinstance(initial_translations, list) and initial_translations:
                serializer = ItemSubmissionNameSerializer(data=initial_translations, many=True)
                serializer.is_valid(raise_exception=True)
                name_entries = serializer.validated_data  # type: ignore[assignment]
            elif self.instance and self.instance.name_translations:
                name_entries = list(self.instance.name_translations)
            elif attrs.get("title"):
                name_entries = [{"language": "en", "value": attrs["title"]}]
            else:
                name_entries = []

        if isinstance(name_entries, tuple):
            name_entries = list(name_entries)
        if not isinstance(name_entries, list):
            raise serializers.ValidationError({"name_translations": "Invalid name translation payload."})
        if not name_entries:
            raise serializers.ValidationError({"name_translations": "Provide at least one name entry."})

        sanitized_names: list[dict[str, str]] = []
        for entry in name_entries:
            language = entry.get("language", "").strip()
            value = entry.get("value", "").strip()
            if not language or not value:
                raise serializers.ValidationError({"name_translations": "Each name requires a language and value."})
            sanitized_names.append({"language": language, "value": value})
        attrs["name_translations"] = sanitized_names

        if not attrs.get("title"):
            english = next((entry["value"] for entry in sanitized_names if entry["language"].lower() == "en"), None)
            attrs["title"] = english or sanitized_names[0]["value"]

        description_entries = attrs.get("description_translations")
        if description_entries is None:
            initial_descriptions = None
            raw_initial = getattr(self, "initial_data", None)
            if isinstance(raw_initial, dict):
                initial_descriptions = raw_initial.get("description_translations")
            if isinstance(initial_descriptions, list) and initial_descriptions:
                serializer = ItemSubmissionDescriptionSerializer(data=initial_descriptions, many=True)
                serializer.is_valid(raise_exception=True)
                description_entries = serializer.validated_data  # type: ignore[assignment]
            elif self.instance and self.instance.description_translations:
                description_entries = list(self.instance.description_translations)
            elif attrs.get("description"):
                description_entries = [{"language": "en", "value": attrs["description"]}]
            else:
                description_entries = []

        if isinstance(description_entries, tuple):
            description_entries = list(description_entries)
        if not isinstance(description_entries, list):
            raise serializers.ValidationError(
                {"description_translations": "Invalid description translation payload."}
            )
        sanitized_descriptions: list[dict[str, str]] = []
        for entry in description_entries:
            language = entry.get("language", "").strip()
            value = entry.get("value", "").strip()
            if not language or not value:
                raise serializers.ValidationError(
                    {"description_translations": "Each description entry requires a language and value."}
                )
            sanitized_descriptions.append({"language": language, "value": value})
        attrs["description_translations"] = sanitized_descriptions

        if not attrs.get("description") and sanitized_descriptions:
            english_description = next(
                (entry["value"] for entry in sanitized_descriptions if entry["language"].lower() == "en"),
                None,
            )
            attrs["description"] = english_description or sanitized_descriptions[0]["value"]

        fabrics_payload: list[dict[str, Any]] = []
        for fabric in attrs.get("fabric_breakdown") or []:
            fabric_slug = fabric.get("fabric", "").strip()
            if not fabric_slug:
                continue
            entry: dict[str, Any] = {"fabric": fabric_slug}
            percentage = fabric.get("percentage")
            if percentage is not None:
                entry["percentage"] = str(percentage)
            fabrics_payload.append(entry)
        attrs["fabric_breakdown"] = fabrics_payload

        prices_payload: list[dict[str, str]] = []
        for price in attrs.get("price_amounts") or []:
            currency = price.get("currency", "").strip().upper()
            amount = price.get("amount")
            if not currency or amount is None:
                continue
            prices_payload.append({"currency": currency, "amount": str(amount)})
        attrs["price_amounts"] = prices_payload

        attrs["style_slugs"] = self._dedupe(self._sanitize_slug_list(attrs.get("style_slugs")))
        attrs["substyle_slugs"] = self._dedupe(self._sanitize_slug_list(attrs.get("substyle_slugs")))
        attrs["color_slugs"] = self._dedupe(self._sanitize_slug_list(attrs.get("color_slugs")))
        attrs["feature_slugs"] = self._dedupe(self._sanitize_slug_list(attrs.get("feature_slugs")))
        attrs["tags"] = self._dedupe(self._sanitize_slug_list(attrs.get("tags")))

        for key in ("item_slug", "category_slug", "subcategory_slug", "collection_reference"):
            value = attrs.get(key)
            if isinstance(value, str):
                attrs[key] = value.strip()

        for key in ("origin_country", "production_country"):
            value = attrs.get(key)
            if isinstance(value, str):
                attrs[key] = self._sanitize_country_code(value)

        return attrs

    def to_representation(self, instance: models.ItemSubmission) -> dict[str, Any]:  # type: ignore[override]
        data = super().to_representation(instance)
        translations = instance.name_translations or []
        if not translations and instance.title:
            translations = [{"language": "en", "value": instance.title}]
        data["name_translations"] = translations
        descriptions = instance.description_translations or []
        if not descriptions and instance.description:
            descriptions = [{"language": "en", "value": instance.description}]
        data["description_translations"] = descriptions
        data["fabric_breakdown"] = instance.fabric_breakdown or []
        data["price_amounts"] = instance.price_amounts or []
        return data

    def _sanitize_slug_list(self, entries: Any) -> list[str]:
        if entries is None:
            return []
        if not isinstance(entries, (list, tuple)):
            raise serializers.ValidationError("Expected a list of identifiers.")
        sanitized: list[str] = []
        for entry in entries:
            value = str(entry).strip()
            if not value:
                continue
            sanitized.append(value)
        return sanitized

    def _sanitize_country_code(self, value: str) -> str:
        cleaned = value.strip().upper()
        if cleaned and len(cleaned) != 2:
            raise serializers.ValidationError("Country codes must be ISO-3166 alpha-2 values.")
        return cleaned

    def _dedupe(self, entries: list[str]) -> list[str]:
        seen: set[str] = set()
        ordered: list[str] = []
        for entry in entries:
            key = entry.strip()
            if not key or key in seen:
                continue
            seen.add(key)
            ordered.append(key)
        return ordered
