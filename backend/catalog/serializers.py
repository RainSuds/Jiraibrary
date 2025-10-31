"""Serializers backing the REST API for catalog resources."""
from __future__ import annotations

from typing import Any, Dict, List, cast

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


class BrandSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()
    item_count = serializers.IntegerField(read_only=True)

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
            "item_count",
            "created_at",
            "updated_at",
        ]

    def get_name(self, obj: models.Brand) -> str:
        return obj.display_name()


class BrandListSerializer(BrandSerializer):
    class Meta(BrandSerializer.Meta):
        fields = ["slug", "name", "icon_url", "country", "item_count"]


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
            "is_gendered",
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
    parent_substyle = serializers.SerializerMethodField()

    class Meta:
        model = models.Substyle
        fields = [
            "id",
            "name",
            "slug",
            "description",
            "parent_substyle",
            "created_at",
            "updated_at",
        ]

    def get_parent_substyle(self, obj: models.Substyle) -> dict[str, str] | None:
        parent = obj.parent_substyle
        if parent:
            return {"id": str(parent.pk), "name": parent.name, "slug": parent.slug}
        return None


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
        ]


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
