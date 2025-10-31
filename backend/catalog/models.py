# pyright: reportIncompatibleMethodOverride=false, reportIncompatibleVariableOverride=false
"""Catalog models derived from the platform schema design."""
from __future__ import annotations

import uuid
from decimal import Decimal
from typing import Any

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils.translation import gettext_lazy as _


class TimeStampedUUIDModel(models.Model):
    """Base model that provides a UUID primary key and timestamps."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Language(TimeStampedUUIDModel):
    code = models.CharField(max_length=10, unique=True)
    name = models.CharField(max_length=128)
    native_name = models.CharField(max_length=128, blank=True)
    is_supported = models.BooleanField(default=True)

    class Meta:
        ordering = ["code"]

    def __str__(self) -> str:
        return f"{self.code} ({self.name})"


class Currency(TimeStampedUUIDModel):
    code = models.CharField(max_length=3, unique=True)
    name = models.CharField(max_length=64)
    symbol = models.CharField(max_length=8, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["code"]

    def __str__(self) -> str:
        return self.code


class Brand(TimeStampedUUIDModel):
    class BrandStatus(models.TextChoices):
        ACTIVE = "active", _("Active")
        DISCONTINUED = "discontinued", _("Discontinued")
        HIATUS = "hiatus", _("Hiatus")

    slug = models.SlugField(max_length=255, unique=True)
    names = models.JSONField(default=dict, blank=True)
    descriptions = models.JSONField(default=dict, blank=True)
    country = models.CharField(max_length=2, blank=True)
    founded_year = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(1800), MaxValueValidator(2100)],
    )
    icon_url = models.URLField(blank=True)
    official_site_url = models.URLField(blank=True)
    status = models.CharField(
        max_length=16,
        choices=BrandStatus.choices,
        default=BrandStatus.ACTIVE,
    )

    class Meta:
        ordering = ["slug"]

    def __str__(self) -> str:
        return self.slug

    def display_name(self) -> str:
        """Return the most appropriate human-readable brand name."""
        if isinstance(self.names, dict):
            for key in ("en", "default"):
                value = self.names.get(key)
                if value:
                    return value
            for value in self.names.values():
                if value:
                    return value
        return self.slug.replace("-", " ").title()


class Collection(TimeStampedUUIDModel):
    class Season(models.TextChoices):
        SPRING = "spring", _("Spring")
        SUMMER = "summer", _("Summer")
        FALL = "fall", _("Fall")
        WINTER = "winter", _("Winter")
        RESORT = "resort", _("Resort")

    brand = models.ForeignKey(Brand, on_delete=models.CASCADE, related_name="collections")
    name = models.CharField(max_length=255)
    season = models.CharField(max_length=16, choices=Season.choices, blank=True)
    year = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(1900), MaxValueValidator(2100)],
    )
    description = models.TextField(blank=True)

    class Meta:
        ordering = ["brand__slug", "-year", "season", "name"]
        unique_together = ("brand", "name", "season", "year")

    def __str__(self) -> str:
        return f"{self.brand.slug}: {self.name}"


class Category(TimeStampedUUIDModel):
    name = models.CharField(max_length=128, unique=True)
    slug = models.SlugField(max_length=128, unique=True)
    description = models.TextField(blank=True)
    is_gendered = models.BooleanField(default=False)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class Subcategory(TimeStampedUUIDModel):
    category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name="subcategories")
    name = models.CharField(max_length=128)
    slug = models.SlugField(max_length=128, unique=True)
    description = models.TextField(blank=True)

    class Meta:
        ordering = ["category__name", "name"]
        unique_together = ("category", "name")

    def __str__(self) -> str:
        return f"{self.category.name} · {self.name}"


class Substyle(TimeStampedUUIDModel):
    name = models.CharField(max_length=128, unique=True)
    slug = models.SlugField(max_length=128, unique=True)
    description = models.TextField(blank=True)
    parent_substyle = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="child_substyles",
    )

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class Color(TimeStampedUUIDModel):
    name = models.CharField(max_length=64)
    hex_code = models.CharField(max_length=7, blank=True)
    lch_values = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["name"]
        unique_together = ("name", "hex_code")

    def __str__(self) -> str:
        return self.name


class Fabric(TimeStampedUUIDModel):
    name = models.CharField(max_length=64, unique=True)
    description = models.TextField(blank=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class Feature(TimeStampedUUIDModel):
    class FeatureCategory(models.TextChoices):
        CONSTRUCTION = "construction", _("Construction")
        ACCESSORY = "accessory", _("Accessory")
        TRIM = "trim", _("Trim")
        ATTACHMENT = "attachment", _("Attachment")

    name = models.CharField(max_length=128, unique=True)
    description = models.TextField(blank=True)
    synonyms = models.JSONField(default=dict, blank=True)
    category = models.CharField(
        max_length=16,
        choices=FeatureCategory.choices,
        default=FeatureCategory.CONSTRUCTION,
    )
    is_visible = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class Tag(TimeStampedUUIDModel):
    class TagType(models.TextChoices):
        STYLE = "style", _("Style")
        DETAIL = "detail", _("Detail")
        MATERIAL = "material", _("Material")
        MOTIF = "motif", _("Motif")
        CONSTRUCTION = "construction", _("Construction")

    name = models.CharField(max_length=128, unique=True)
    slug = models.SlugField(max_length=128, unique=True)
    description = models.TextField(blank=True)
    type = models.CharField(max_length=16, choices=TagType.choices, default=TagType.DETAIL)
    is_featured = models.BooleanField(default=False)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class TagTranslation(TimeStampedUUIDModel):
    class Source(models.TextChoices):
        OFFICIAL = "official", _("Official")
        AI = "ai", _("AI")
        USER = "user", _("User")

    class Quality(models.TextChoices):
        DRAFT = "draft", _("Draft")
        VERIFIED = "verified", _("Verified")

    tag = models.ForeignKey(Tag, on_delete=models.CASCADE, related_name="translations")
    language = models.ForeignKey(Language, on_delete=models.CASCADE)
    name = models.CharField(max_length=128)
    description = models.TextField(blank=True)
    source = models.CharField(max_length=16, choices=Source.choices, default=Source.USER)
    quality = models.CharField(max_length=16, choices=Quality.choices, default=Quality.DRAFT)
    auto_translated = models.BooleanField(default=False)

    class Meta:
        ordering = ["tag__name", "language__code"]
        unique_together = ("tag", "language")

    def __str__(self) -> str:
        return f"{self.tag.name} ({self.language.code})"


class Item(TimeStampedUUIDModel):
    class ItemStatus(models.TextChoices):
        DRAFT = "draft", _("Draft")
        PENDING_REVIEW = "pending_review", _("Pending Review")
        PUBLISHED = "published", _("Published")
        ARCHIVED = "archived", _("Archived")

    slug = models.SlugField(max_length=255, unique=True)
    brand = models.ForeignKey(Brand, on_delete=models.PROTECT, related_name="items")
    category = models.ForeignKey(
        Category,
        on_delete=models.PROTECT,
        related_name="items",
        null=True,
        blank=True,
    )
    subcategory = models.ForeignKey(
        Subcategory,
        on_delete=models.SET_NULL,
        related_name="items",
        null=True,
        blank=True,
    )
    origin_country = models.CharField(max_length=2, blank=True)
    default_language = models.ForeignKey(
        Language,
        on_delete=models.PROTECT,
        related_name="default_language_items",
        null=True,
        blank=True,
    )
    default_currency = models.ForeignKey(
        Currency,
        on_delete=models.PROTECT,
        related_name="default_currency_items",
        null=True,
        blank=True,
    )
    release_year = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(1970), MaxValueValidator(2100)],
    )
    release_date = models.DateField(null=True, blank=True)
    collaboration = models.CharField(max_length=255, blank=True)
    limited_edition = models.BooleanField(default=False)
    has_matching_set = models.BooleanField(default=False)
    verified_source = models.BooleanField(default=False)
    status = models.CharField(max_length=20, choices=ItemStatus.choices, default=ItemStatus.DRAFT)
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="submitted_items",
        null=True,
        blank=True,
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    extra_metadata = models.JSONField(default=dict, blank=True)

    tags = models.ManyToManyField(Tag, through="ItemTag", related_name="items", blank=True)
    colors = models.ManyToManyField(Color, through="ItemColor", related_name="items", blank=True)
    substyles = models.ManyToManyField(Substyle, through="ItemSubstyle", related_name="items", blank=True)
    fabrics = models.ManyToManyField(Fabric, through="ItemFabric", related_name="items", blank=True)
    features = models.ManyToManyField(Feature, through="ItemFeature", related_name="items", blank=True)
    collections = models.ManyToManyField(
        Collection,
        through="ItemCollection",
        related_name="items",
        blank=True,
    )

    class Meta:
        ordering = ["brand__slug", "slug"]

    def __str__(self) -> str:
        return f"{self.brand.slug}/{self.slug}"

    def display_name(self) -> str:
        """Return the best available translation name for display purposes."""
        translations_manager = getattr(self, "translations", None)
        if translations_manager is None:
            return self.slug
        translations = list(translations_manager.all())
        default_language_id = getattr(self, "default_language_id", None)
        if default_language_id:
            for translation in translations:
                if translation.language_id == default_language_id and translation.name:
                    return translation.name
        for translation in translations:
            if translation.name:
                return translation.name
        return self.slug


class ItemTranslation(TimeStampedUUIDModel):
    class Source(models.TextChoices):
        OFFICIAL = "official", _("Official")
        AI = "ai", _("AI")
        USER = "user", _("User")

    class Quality(models.TextChoices):
        DRAFT = "draft", _("Draft")
        VERIFIED = "verified", _("Verified")

    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name="translations")
    language = models.ForeignKey(Language, on_delete=models.CASCADE)
    dialect = models.CharField(max_length=32, blank=True)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    pattern = models.CharField(max_length=255, blank=True)
    fit = models.CharField(max_length=255, blank=True)
    length = models.CharField(max_length=255, blank=True)
    occasion = models.CharField(max_length=255, blank=True)
    season = models.CharField(max_length=255, blank=True)
    lining = models.CharField(max_length=255, blank=True)
    closure_type = models.CharField(max_length=255, blank=True)
    care_instructions = models.TextField(blank=True)
    source = models.CharField(max_length=16, choices=Source.choices, default=Source.USER)
    quality = models.CharField(max_length=16, choices=Quality.choices, default=Quality.DRAFT)
    auto_translated = models.BooleanField(default=False)

    class Meta:
        ordering = ["item__brand__slug", "item__slug", "language__code"]
        unique_together = ("item", "language", "dialect")

    def __str__(self) -> str:
        return f"{self.item} [{self.language.code}]"


class ItemPrice(TimeStampedUUIDModel):
    class Source(models.TextChoices):
        ORIGIN = "origin", _("Origin")
        CONVERTED = "converted", _("Converted")
        MANUAL = "manual", _("Manual")

    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name="prices")
    currency = models.ForeignKey(Currency, on_delete=models.CASCADE)
    amount = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    source = models.CharField(max_length=16, choices=Source.choices, default=Source.ORIGIN)
    rate_used = models.DecimalField(max_digits=12, decimal_places=6, null=True, blank=True)
    valid_from = models.DateField(null=True, blank=True)
    valid_to = models.DateField(null=True, blank=True)
    last_synced_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        unique_together = ("item", "currency", "source")

    def __str__(self) -> str:
        return f"{self.item}: {self.currency.code} {self.amount}"


class ItemVariant(TimeStampedUUIDModel):
    class StockStatus(models.TextChoices):
        AVAILABLE = "available", _("Available")
        LIMITED = "limited", _("Limited")
        SOLD_OUT = "sold_out", _("Sold Out")
        UNKNOWN = "unknown", _("Unknown")

    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name="variants")
    variant_label = models.CharField(max_length=255)
    sku = models.CharField(max_length=255, blank=True)
    color = models.ForeignKey(Color, on_delete=models.SET_NULL, null=True, blank=True)
    size_descriptor = models.CharField(max_length=128, blank=True)
    stock_status = models.CharField(max_length=16, choices=StockStatus.choices, default=StockStatus.UNKNOWN)
    notes = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["item__slug", "variant_label"]

    def __str__(self) -> str:
        return f"{self.item} · {self.variant_label}"


class ItemMeasurement(TimeStampedUUIDModel):
    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name="measurements")
    variant = models.ForeignKey(
        ItemVariant,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="measurements",
    )
    is_one_size = models.BooleanField(default=False)
    bust_cm = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    waist_cm = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    hip_cm = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    length_cm = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    sleeve_length_cm = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    hem_cm = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    heel_height_cm = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    bag_depth_cm = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    fit_notes = models.TextField(blank=True)

    class Meta:
        ordering = ["item__slug"]


class ItemMetadata(TimeStampedUUIDModel):
    item = models.OneToOneField(Item, on_delete=models.CASCADE, related_name="metadata")
    pattern = models.CharField(max_length=64, blank=True)
    sleeve_type = models.CharField(max_length=128, blank=True)
    occasion = models.CharField(max_length=128, blank=True)
    season = models.CharField(max_length=128, blank=True)
    fit = models.CharField(max_length=128, blank=True)
    length = models.CharField(max_length=128, blank=True)
    lining = models.CharField(max_length=128, blank=True)
    closure_type = models.CharField(max_length=128, blank=True)
    care_instructions = models.TextField(blank=True)
    inspiration = models.TextField(blank=True)
    ai_confidence = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)

    class Meta:
        ordering = ["item__slug"]


class Image(TimeStampedUUIDModel):
    class ImageType(models.TextChoices):
        COVER = "cover", _("Cover")
        GALLERY = "gallery", _("Gallery")
        DETAIL = "detail", _("Detail")
        BRAND_LOGO = "brand_logo", _("Brand Logo")
        LOOKBOOK = "lookbook", _("Lookbook")

    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name="images", null=True, blank=True)
    brand = models.ForeignKey(Brand, on_delete=models.CASCADE, related_name="images", null=True, blank=True)
    variant = models.ForeignKey(
        ItemVariant,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="images",
    )
    storage_path = models.CharField(max_length=512)
    type = models.CharField(max_length=16, choices=ImageType.choices, default=ImageType.GALLERY)
    caption = models.TextField(blank=True)
    is_cover = models.BooleanField(default=False)
    width = models.PositiveIntegerField(null=True, blank=True)
    height = models.PositiveIntegerField(null=True, blank=True)
    file_size_bytes = models.PositiveBigIntegerField(null=True, blank=True)
    hash_signature = models.CharField(max_length=255, blank=True)
    dominant_color = models.CharField(max_length=7, blank=True)
    source = models.CharField(max_length=32, blank=True)
    license = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["-created_at"]


class ItemTag(TimeStampedUUIDModel):
    class TagContext(models.TextChoices):
        PRIMARY = "primary", _("Primary")
        SECONDARY = "secondary", _("Secondary")

    item = models.ForeignKey(Item, on_delete=models.CASCADE)
    tag = models.ForeignKey(Tag, on_delete=models.CASCADE)
    context = models.CharField(max_length=16, choices=TagContext.choices, default=TagContext.PRIMARY)
    confidence = models.DecimalField(max_digits=4, decimal_places=2, null=True, blank=True)

    class Meta:
        ordering = ["item__slug", "tag__name"]
    unique_together = ("item", "tag")


class ItemColor(TimeStampedUUIDModel):
    item = models.ForeignKey(Item, on_delete=models.CASCADE)
    color = models.ForeignKey(Color, on_delete=models.CASCADE)
    is_primary = models.BooleanField(default=False)

    class Meta:
        ordering = ["item__slug", "color__name"]
        unique_together = ("item", "color")


class ItemSubstyle(TimeStampedUUIDModel):
    item = models.ForeignKey(Item, on_delete=models.CASCADE)
    substyle = models.ForeignKey(Substyle, on_delete=models.CASCADE)
    weight = models.DecimalField(max_digits=4, decimal_places=2, null=True, blank=True)

    class Meta:
        ordering = ["item__slug", "substyle__name"]
        unique_together = ("item", "substyle")


class ItemFabric(TimeStampedUUIDModel):
    item = models.ForeignKey(Item, on_delete=models.CASCADE)
    fabric = models.ForeignKey(Fabric, on_delete=models.CASCADE)
    percentage = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)

    class Meta:
        ordering = ["item__slug", "fabric__name"]
        unique_together = ("item", "fabric")


class ItemFeature(TimeStampedUUIDModel):
    item = models.ForeignKey(Item, on_delete=models.CASCADE)
    feature = models.ForeignKey(Feature, on_delete=models.CASCADE)
    is_prominent = models.BooleanField(default=False)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["item__slug", "feature__name"]
        unique_together = ("item", "feature")


class ItemCollection(TimeStampedUUIDModel):
    class CollectionRole(models.TextChoices):
        MAINLINE = "mainline", _("Mainline")
        SPECIAL = "special", _("Special")
        COLLABORATION = "collaboration", _("Collaboration")

    item = models.ForeignKey(Item, on_delete=models.CASCADE)
    collection = models.ForeignKey(Collection, on_delete=models.CASCADE)
    role = models.CharField(max_length=16, choices=CollectionRole.choices, default=CollectionRole.MAINLINE)

    class Meta:
        ordering = ["item__slug", "collection__name"]
        unique_together = ("item", "collection")


class BrandSubstyle(TimeStampedUUIDModel):
    brand = models.ForeignKey(Brand, on_delete=models.CASCADE)
    substyle = models.ForeignKey(Substyle, on_delete=models.CASCADE)

    class Meta:
        ordering = ["brand__slug", "substyle__name"]
        unique_together = ("brand", "substyle")
