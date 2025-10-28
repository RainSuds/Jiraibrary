import uuid

from django.conf import settings
from django.db import models


class TimeStampedModel(models.Model):
    """Abstract base model that tracks creation and modification times."""

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class SoftDeleteModel(models.Model):
    """Optional soft delete support for entities that may be retired."""

    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        abstract = True


class Language(TimeStampedModel):
    code = models.CharField(primary_key=True, max_length=10)
    english_name = models.CharField(max_length=120)
    native_name = models.CharField(max_length=120, blank=True)
    display_order = models.PositiveSmallIntegerField(default=0)
    is_supported = models.BooleanField(default=True)

    class Meta(TimeStampedModel.Meta):
        db_table = "core_language"
        ordering = ["display_order", "code"]

    def __str__(self) -> str:
        return self.english_name or self.code


class Currency(TimeStampedModel):
    code = models.CharField(primary_key=True, max_length=3)
    name = models.CharField(max_length=80)
    symbol = models.CharField(max_length=8, blank=True)
    decimal_places = models.PositiveSmallIntegerField(default=2)
    is_active = models.BooleanField(default=True)

    class Meta(TimeStampedModel.Meta):
        db_table = "core_currency"
        ordering = ["code"]

    def __str__(self) -> str:
        return self.code


class BrandStatus(models.TextChoices):
    ACTIVE = "active", "Active"
    DISCONTINUED = "discontinued", "Discontinued"
    HIATUS = "hiatus", "Hiatus"


class Brand(TimeStampedModel, SoftDeleteModel):
    brand_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    slug = models.SlugField(unique=True, max_length=140)
    names = models.JSONField(default=dict, blank=True)
    descriptions = models.JSONField(default=dict, blank=True)
    country = models.CharField(max_length=2, blank=True)
    founded_year = models.PositiveSmallIntegerField(null=True, blank=True)
    icon_url = models.URLField(blank=True)
    official_site_url = models.URLField(blank=True)
    status = models.CharField(
        max_length=20,
        choices=BrandStatus.choices,
        default=BrandStatus.ACTIVE,
    )

    class Meta(TimeStampedModel.Meta, SoftDeleteModel.Meta):
        db_table = "brand_brand"

    def __str__(self) -> str:
        return self.names.get("en") or self.names.get("default") or self.slug


class BrandLinkType(models.TextChoices):
    WEBSITE = "website", "Website"
    SHOP = "shop", "Shop"
    SOCIAL = "social", "Social"
    OTHER = "other", "Other"


class BrandLink(TimeStampedModel):
    brand = models.ForeignKey(Brand, on_delete=models.CASCADE, related_name="links")
    link_type = models.CharField(
        max_length=20, choices=BrandLinkType.choices, default=BrandLinkType.OTHER
    )
    url = models.URLField()
    is_primary = models.BooleanField(default=False)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta(TimeStampedModel.Meta):
        db_table = "brand_link"
        unique_together = ("brand", "link_type", "url")

    def __str__(self) -> str:
        return f"{self.brand.slug}: {self.link_type}"


class Collection(TimeStampedModel):
    collection_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    brand = models.ForeignKey(
        Brand, on_delete=models.CASCADE, related_name="collections"
    )
    name = models.CharField(max_length=200)
    season = models.CharField(max_length=20, blank=True)
    year = models.PositiveSmallIntegerField(null=True, blank=True)
    description = models.TextField(blank=True)

    class Meta(TimeStampedModel.Meta):
        db_table = "brand_collection"
        unique_together = ("brand", "name", "year")

    def __str__(self) -> str:
        return f"{self.brand.slug} - {self.name}"


class Category(TimeStampedModel):
    category_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=120, unique=True)
    description = models.TextField(blank=True)
    is_gendered = models.BooleanField(default=False)

    class Meta(TimeStampedModel.Meta):
        db_table = "catalog_category"

    def __str__(self) -> str:
        return self.name


class Subcategory(TimeStampedModel):
    subcategory_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    category = models.ForeignKey(
        Category, on_delete=models.CASCADE, related_name="subcategories"
    )
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True)

    class Meta(TimeStampedModel.Meta):
        db_table = "catalog_subcategory"
        unique_together = ("category", "name")

    def __str__(self) -> str:
        return f"{self.category.name} / {self.name}"


class Substyle(TimeStampedModel):
    substyle_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=120, unique=True)
    description = models.TextField(blank=True)
    parent_substyle = models.ForeignKey(
        "self", on_delete=models.SET_NULL, null=True, blank=True, related_name="children"
    )

    class Meta(TimeStampedModel.Meta):
        db_table = "catalog_substyle"

    def __str__(self) -> str:
        return self.name


class Color(TimeStampedModel):
    color_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=80)
    hex_code = models.CharField(max_length=7)
    lch_values = models.JSONField(default=dict, blank=True)

    class Meta(TimeStampedModel.Meta):
        db_table = "catalog_color"
        unique_together = ("name", "hex_code")

    def __str__(self) -> str:
        return self.name


class Fabric(TimeStampedModel):
    fabric_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=120, unique=True)
    description = models.TextField(blank=True)

    class Meta(TimeStampedModel.Meta):
        db_table = "catalog_fabric"

    def __str__(self) -> str:
        return self.name


class FeatureCategory(models.TextChoices):
    CONSTRUCTION = "construction", "Construction"
    ACCESSORY = "accessory", "Accessory"
    TRIM = "trim", "Trim"
    ATTACHMENT = "attachment", "Attachment"


class Feature(TimeStampedModel):
    feature_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=120, unique=True)
    description = models.TextField(blank=True)
    synonyms = models.JSONField(default=list, blank=True)
    category = models.CharField(
        max_length=20, choices=FeatureCategory.choices, default=FeatureCategory.CONSTRUCTION
    )
    is_visible = models.BooleanField(default=True)

    class Meta(TimeStampedModel.Meta):
        db_table = "catalog_feature"

    def __str__(self) -> str:
        return self.name


class TagType(models.TextChoices):
    STYLE = "style", "Style"
    DETAIL = "detail", "Detail"
    MATERIAL = "material", "Material"
    MOTIF = "motif", "Motif"
    CONSTRUCTION = "construction", "Construction"


class Tag(TimeStampedModel):
    tag_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    type = models.CharField(max_length=20, choices=TagType.choices)
    is_featured = models.BooleanField(default=False)

    class Meta(TimeStampedModel.Meta):
        db_table = "catalog_tag"
        unique_together = ("name", "type")

    def __str__(self) -> str:
        return self.name


class TranslationSource(models.TextChoices):
    OFFICIAL = "official", "Official"
    AI = "ai", "AI"
    USER = "user", "User"


class TranslationQuality(models.TextChoices):
    DRAFT = "draft", "Draft"
    VERIFIED = "verified", "Verified"


class TagTranslation(TimeStampedModel):
    tag = models.ForeignKey(Tag, on_delete=models.CASCADE, related_name="translations")
    language = models.ForeignKey(
        Language, to_field="code", on_delete=models.CASCADE, related_name="tag_translations"
    )
    localized_name = models.CharField(max_length=120)
    localized_description = models.TextField(blank=True)
    source = models.CharField(max_length=20, choices=TranslationSource.choices)
    quality = models.CharField(
        max_length=20, choices=TranslationQuality.choices, default=TranslationQuality.DRAFT
    )

    class Meta(TimeStampedModel.Meta):
        db_table = "catalog_tag_translation"
        unique_together = ("tag", "language")

    def __str__(self) -> str:
        return f"{self.tag.name} ({self.language.pk})"


class ItemStatus(models.TextChoices):
    DRAFT = "draft", "Draft"
    PENDING_REVIEW = "pending_review", "Pending Review"
    PUBLISHED = "published", "Published"
    ARCHIVED = "archived", "Archived"


class Item(TimeStampedModel, SoftDeleteModel):
    item_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    slug = models.SlugField(max_length=200)
    brand = models.ForeignKey(
        Brand, on_delete=models.PROTECT, related_name="items", null=True, blank=True
    )
    category = models.ForeignKey(
        Category, on_delete=models.PROTECT, related_name="items", null=True, blank=True
    )
    origin_country = models.CharField(max_length=2, blank=True)
    default_language = models.ForeignKey(
        Language,
        to_field="code",
        on_delete=models.PROTECT,
        related_name="items_default_language",
    )
    default_currency = models.ForeignKey(
        Currency,
        to_field="code",
        on_delete=models.PROTECT,
        related_name="items_default_currency",
    )
    release_year = models.PositiveSmallIntegerField(null=True, blank=True)
    release_date = models.DateField(null=True, blank=True)
    collaboration = models.CharField(max_length=255, blank=True)
    limited_edition = models.BooleanField(default=False)
    has_matching_set = models.BooleanField(default=False)
    verified_source = models.BooleanField(default=False)
    status = models.CharField(
        max_length=20, choices=ItemStatus.choices, default=ItemStatus.DRAFT
    )
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="submitted_items",
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    extra_metadata = models.JSONField(default=dict, blank=True)

    class Meta(TimeStampedModel.Meta, SoftDeleteModel.Meta):
        db_table = "catalog_item"
        unique_together = ("brand", "slug")
        indexes = [
            models.Index(fields=["brand", "release_year"], name="item_brand_year_idx"),
        ]

    def __str__(self) -> str:
        return self.slug


class ItemTranslation(TimeStampedModel):
    translation_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name="translations")
    language = models.ForeignKey(
        Language, to_field="code", on_delete=models.CASCADE, related_name="item_translations"
    )
    dialect = models.CharField(max_length=10, blank=True)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    pattern = models.CharField(max_length=120, blank=True)
    fit = models.CharField(max_length=120, blank=True)
    length = models.CharField(max_length=120, blank=True)
    occasion = models.CharField(max_length=120, blank=True)
    season = models.CharField(max_length=120, blank=True)
    lining = models.CharField(max_length=120, blank=True)
    closure_type = models.CharField(max_length=120, blank=True)
    care_instructions = models.TextField(blank=True)
    source = models.CharField(max_length=20, choices=TranslationSource.choices)
    quality = models.CharField(
        max_length=20, choices=TranslationQuality.choices, default=TranslationQuality.DRAFT
    )
    auto_translated = models.BooleanField(default=False)

    class Meta(TimeStampedModel.Meta):
        db_table = "catalog_item_translation"
        unique_together = ("item", "language", "dialect")

    def __str__(self) -> str:
        return f"{self.item.slug} ({self.language.pk})"


class ItemPriceSource(models.TextChoices):
    ORIGIN = "origin", "Origin"
    CONVERTED = "converted", "Converted"
    MANUAL = "manual", "Manual"


class ItemPrice(TimeStampedModel):
    price_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name="prices")
    currency = models.ForeignKey(
        Currency, to_field="code", on_delete=models.CASCADE, related_name="item_prices"
    )
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    source = models.CharField(max_length=20, choices=ItemPriceSource.choices)
    rate_used = models.DecimalField(max_digits=12, decimal_places=6, null=True, blank=True)
    valid_from = models.DateField(null=True, blank=True)
    valid_to = models.DateField(null=True, blank=True)
    last_synced_at = models.DateTimeField(null=True, blank=True)

    class Meta(TimeStampedModel.Meta):
        db_table = "catalog_item_price"
        unique_together = ("item", "currency", "source")


class StockStatus(models.TextChoices):
    AVAILABLE = "available", "Available"
    LIMITED = "limited", "Limited"
    SOLD_OUT = "sold_out", "Sold Out"
    UNKNOWN = "unknown", "Unknown"


class ItemVariant(TimeStampedModel):
    variant_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name="variants")
    variant_label = models.CharField(max_length=200)
    sku = models.CharField(max_length=120, blank=True)
    color = models.ForeignKey(
        Color, on_delete=models.SET_NULL, null=True, blank=True, related_name="variants"
    )
    size_descriptor = models.CharField(max_length=100, blank=True)
    stock_status = models.CharField(
        max_length=20, choices=StockStatus.choices, default=StockStatus.UNKNOWN
    )
    notes = models.JSONField(default=dict, blank=True)

    class Meta(TimeStampedModel.Meta):
        db_table = "catalog_item_variant"


class ItemMeasurement(TimeStampedModel):
    measurement_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name="measurements")
    variant = models.ForeignKey(
        ItemVariant,
        on_delete=models.CASCADE,
        related_name="measurements",
        null=True,
        blank=True,
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

    class Meta(TimeStampedModel.Meta):
        db_table = "catalog_item_measurement"


class ItemMetadata(TimeStampedModel):
    metadata_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    item = models.OneToOneField(
        Item, on_delete=models.CASCADE, related_name="metadata"
    )
    pattern = models.CharField(max_length=120, blank=True)
    sleeve_type = models.CharField(max_length=120, blank=True)
    occasion = models.CharField(max_length=120, blank=True)
    season = models.CharField(max_length=120, blank=True)
    fit = models.CharField(max_length=120, blank=True)
    length = models.CharField(max_length=120, blank=True)
    lining = models.CharField(max_length=120, blank=True)
    closure_type = models.CharField(max_length=120, blank=True)
    care_instructions = models.TextField(blank=True)
    inspiration = models.TextField(blank=True)
    ai_confidence = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True
    )

    class Meta(TimeStampedModel.Meta):
        db_table = "catalog_item_metadata"


class ItemTag(TimeStampedModel):
    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name="item_tags")
    tag = models.ForeignKey(Tag, on_delete=models.CASCADE, related_name="tag_items")
    context = models.CharField(max_length=20, blank=True)
    confidence = models.DecimalField(
        max_digits=4, decimal_places=2, null=True, blank=True
    )

    class Meta(TimeStampedModel.Meta):
        db_table = "catalog_item_tag"
        unique_together = ("item", "tag")


class ItemColor(TimeStampedModel):
    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name="item_colors")
    color = models.ForeignKey(Color, on_delete=models.CASCADE, related_name="color_items")
    is_primary = models.BooleanField(default=False)

    class Meta(TimeStampedModel.Meta):
        db_table = "catalog_item_color"
        unique_together = ("item", "color")


class ItemSubstyle(TimeStampedModel):
    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name="item_substyles")
    substyle = models.ForeignKey(
        Substyle, on_delete=models.CASCADE, related_name="substyle_items"
    )
    weight = models.DecimalField(max_digits=4, decimal_places=2, null=True, blank=True)

    class Meta(TimeStampedModel.Meta):
        db_table = "catalog_item_substyle"
        unique_together = ("item", "substyle")


class ItemFabric(TimeStampedModel):
    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name="item_fabrics")
    fabric = models.ForeignKey(
        Fabric, on_delete=models.CASCADE, related_name="fabric_items"
    )
    percentage = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)

    class Meta(TimeStampedModel.Meta):
        db_table = "catalog_item_fabric"
        unique_together = ("item", "fabric")


class ItemFeature(TimeStampedModel):
    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name="item_features")
    feature = models.ForeignKey(
        Feature, on_delete=models.CASCADE, related_name="feature_items"
    )
    is_prominent = models.BooleanField(default=False)
    notes = models.TextField(blank=True)

    class Meta(TimeStampedModel.Meta):
        db_table = "catalog_item_feature"
        unique_together = ("item", "feature")


class ItemCollection(TimeStampedModel):
    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name="item_collections")
    collection = models.ForeignKey(
        Collection, on_delete=models.CASCADE, related_name="collection_items"
    )
    role = models.CharField(max_length=30, blank=True)

    class Meta(TimeStampedModel.Meta):
        db_table = "catalog_item_collection"
        unique_together = ("item", "collection")


class BrandSubstyle(TimeStampedModel):
    brand = models.ForeignKey(Brand, on_delete=models.CASCADE, related_name="brand_substyles")
    substyle = models.ForeignKey(
        Substyle, on_delete=models.CASCADE, related_name="substyle_brands"
    )

    class Meta(TimeStampedModel.Meta):
        db_table = "brand_brand_substyle"
        unique_together = ("brand", "substyle")


class ImageType(models.TextChoices):
    COVER = "cover", "Cover"
    GALLERY = "gallery", "Gallery"
    DETAIL = "detail", "Detail"
    BRAND_LOGO = "brand_logo", "Brand Logo"
    LOOKBOOK = "lookbook", "Lookbook"


class ImageSource(models.TextChoices):
    OFFICIAL = "official", "Official"
    USER_UPLOAD = "user_upload", "User Upload"
    AI_GENERATED = "ai_generated", "AI Generated"


class Image(TimeStampedModel, SoftDeleteModel):
    image_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    item = models.ForeignKey(
        Item, on_delete=models.CASCADE, related_name="images", null=True, blank=True
    )
    brand = models.ForeignKey(
        Brand, on_delete=models.CASCADE, related_name="images", null=True, blank=True
    )
    variant = models.ForeignKey(
        ItemVariant,
        on_delete=models.SET_NULL,
        related_name="images",
        null=True,
        blank=True,
    )
    storage_path = models.CharField(max_length=500)
    type = models.CharField(max_length=20, choices=ImageType.choices)
    caption = models.TextField(blank=True)
    is_cover = models.BooleanField(default=False)
    width = models.PositiveIntegerField(null=True, blank=True)
    height = models.PositiveIntegerField(null=True, blank=True)
    file_size_bytes = models.PositiveIntegerField(null=True, blank=True)
    hash_signature = models.CharField(max_length=64, blank=True)
    dominant_color = models.CharField(max_length=7, blank=True)
    source = models.CharField(max_length=20, choices=ImageSource.choices)
    license = models.CharField(max_length=200, blank=True)

    class Meta(TimeStampedModel.Meta, SoftDeleteModel.Meta):
        db_table = "media_image"


class ImageLabel(TimeStampedModel):
    image = models.ForeignKey(Image, on_delete=models.CASCADE, related_name="labels")
    language = models.ForeignKey(
        Language, to_field="code", on_delete=models.CASCADE, related_name="image_labels"
    )
    dialect = models.CharField(max_length=10, blank=True)
    text = models.TextField()
    source = models.CharField(max_length=20, choices=TranslationSource.choices)

    class Meta(TimeStampedModel.Meta):
        db_table = "media_image_label"
        unique_together = ("image", "language", "dialect")


class ImageEmbedding(TimeStampedModel):
    image = models.OneToOneField(
        Image, on_delete=models.CASCADE, related_name="embedding"
    )
    vector = models.JSONField(default=list, blank=True)
    algorithm = models.CharField(max_length=120)

    class Meta(TimeStampedModel.Meta):
        db_table = "media_image_embedding"


class AssetAttribution(TimeStampedModel):
    image = models.ForeignKey(Image, on_delete=models.CASCADE, related_name="attributions")
    credit_text = models.CharField(max_length=255)
    source_url = models.URLField(blank=True)
    notes = models.TextField(blank=True)

    class Meta(TimeStampedModel.Meta):
        db_table = "media_asset_attribution"


class UserProfile(TimeStampedModel):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="profile",
    )
    bio = models.TextField(blank=True)
    pronouns = models.CharField(max_length=60, blank=True)
    location = models.CharField(max_length=120, blank=True)
    preferred_languages = models.ManyToManyField(
        Language, blank=True, related_name="profiles"
    )
    profile_picture = models.URLField(blank=True)

    class Meta(TimeStampedModel.Meta):
        db_table = "account_user_profile"


class Review(TimeStampedModel):
    review_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name="reviews")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="reviews"
    )
    rating = models.PositiveSmallIntegerField()
    title = models.CharField(max_length=200, blank=True)
    body = models.TextField()
    is_verified_purchase = models.BooleanField(default=False)
    date_submitted = models.DateTimeField(auto_now_add=True)

    class Meta(TimeStampedModel.Meta):
        db_table = "social_review"
        indexes = [models.Index(fields=["item", "rating"], name="review_item_rating")]


class CommentStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    PUBLISHED = "published", "Published"
    HIDDEN = "hidden", "Hidden"


class Comment(TimeStampedModel, SoftDeleteModel):
    comment_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name="comments")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="comments"
    )
    parent_comment = models.ForeignKey(
        "self", on_delete=models.CASCADE, null=True, blank=True, related_name="replies"
    )
    body = models.TextField()
    status = models.CharField(
        max_length=20, choices=CommentStatus.choices, default=CommentStatus.PENDING
    )

    class Meta(TimeStampedModel.Meta, SoftDeleteModel.Meta):
        db_table = "social_comment"


class Favorite(TimeStampedModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="favorites"
    )
    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name="favorites")

    class Meta(TimeStampedModel.Meta):
        db_table = "social_favorite"
        unique_together = ("user", "item")


class OutfitVisibility(models.TextChoices):
    PRIVATE = "private", "Private"
    UNLISTED = "unlisted", "Unlisted"
    PUBLIC = "public", "Public"


class OutfitSet(TimeStampedModel, SoftDeleteModel):
    set_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="outfit_sets",
    )
    visibility = models.CharField(
        max_length=20, choices=OutfitVisibility.choices, default=OutfitVisibility.PRIVATE
    )

    class Meta(TimeStampedModel.Meta, SoftDeleteModel.Meta):
        db_table = "social_outfit_set"


class OutfitSetItem(TimeStampedModel):
    set = models.ForeignKey(
        OutfitSet, on_delete=models.CASCADE, related_name="items"
    )
    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name="outfit_items")
    position = models.PositiveSmallIntegerField(default=0)
    styling_notes = models.JSONField(default=dict, blank=True)

    class Meta(TimeStampedModel.Meta):
        db_table = "social_outfit_set_item"
        unique_together = ("set", "item")
        ordering = ["position"]


class UserFollow(TimeStampedModel):
    follower = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="following",
    )
    followed = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="followers",
    )

    class Meta(TimeStampedModel.Meta):
        db_table = "social_user_follow"
        unique_together = ("follower", "followed")


class AuditLog(TimeStampedModel):
    log_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    action = models.CharField(max_length=120)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_logs",
    )
    target_type = models.CharField(max_length=120)
    target_id = models.UUIDField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)

    class Meta(TimeStampedModel.Meta):
        db_table = "ops_audit_log"


class ModerationStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    IN_REVIEW = "in_review", "In Review"
    APPROVED = "approved", "Approved"
    REJECTED = "rejected", "Rejected"


class ModerationQueue(TimeStampedModel):
    queue_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    entity_type = models.CharField(max_length=120)
    entity_id = models.UUIDField()
    status = models.CharField(
        max_length=20, choices=ModerationStatus.choices, default=ModerationStatus.PENDING
    )
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="moderation_submissions",
    )
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="moderation_assignments",
    )
    priority = models.PositiveSmallIntegerField(default=0)
    notes = models.TextField(blank=True)

    class Meta(TimeStampedModel.Meta):
        db_table = "ops_moderation_queue"


class ModerationActionType(models.TextChoices):
    APPROVE = "approve", "Approve"
    REJECT = "reject", "Reject"
    REQUEST_CHANGES = "request_changes", "Request Changes"


class ModerationAction(TimeStampedModel):
    action_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    queue_entry = models.ForeignKey(
        ModerationQueue, on_delete=models.CASCADE, related_name="actions"
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="moderation_actions",
    )
    action = models.CharField(max_length=20, choices=ModerationActionType.choices)
    notes = models.TextField(blank=True)

    class Meta(TimeStampedModel.Meta):
        db_table = "ops_moderation_action"


class ConsentType(models.TextChoices):
    DATA_COLLECTION = "data_collection", "Data Collection"
    EMAIL_MARKETING = "email_marketing", "Email Marketing"
    AI_PROCESSING = "ai_processing", "AI Processing"


class SecurityConsent(TimeStampedModel):
    consent_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="consents"
    )
    consent_type = models.CharField(max_length=40, choices=ConsentType.choices)
    date_given = models.DateTimeField()
    change_description = models.TextField(blank=True)
    change_timestamp = models.DateTimeField(auto_now_add=True)

    class Meta(TimeStampedModel.Meta):
        db_table = "ops_security_consent"
        unique_together = ("user", "consent_type", "date_given")


class Notification(TimeStampedModel):
    notification_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications"
    )
    notification_type = models.CharField(max_length=120)
    payload = models.JSONField(default=dict, blank=True)
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta(TimeStampedModel.Meta):
        db_table = "ops_notification"


class UserActivity(TimeStampedModel):
    activity_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    event_type = models.CharField(max_length=120)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="activities",
    )
    target_type = models.CharField(max_length=120, blank=True)
    target_id = models.UUIDField(null=True, blank=True)
    payload = models.JSONField(default=dict, blank=True)
    occurred_at = models.DateTimeField(auto_now_add=True)

    class Meta(TimeStampedModel.Meta):
        db_table = "ops_user_activity"


class AnalyticsSnapshot(TimeStampedModel):
    snapshot_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name="analytics")
    recorded_at = models.DateField()
    views = models.PositiveIntegerField(default=0)
    likes = models.PositiveIntegerField(default=0)
    shares = models.PositiveIntegerField(default=0)
    popularity_score = models.DecimalField(
        max_digits=6, decimal_places=2, default=0
    )
    source = models.CharField(max_length=120, blank=True)

    class Meta(TimeStampedModel.Meta):
        db_table = "analytics_snapshot"
        unique_together = ("item", "recorded_at", "source")


class SearchIndexQueue(TimeStampedModel):
    queue_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    entity_type = models.CharField(max_length=120)
    entity_id = models.UUIDField()
    priority = models.PositiveSmallIntegerField(default=0)
    attempts = models.PositiveSmallIntegerField(default=0)
    last_attempt_at = models.DateTimeField(null=True, blank=True)

    class Meta(TimeStampedModel.Meta):
        db_table = "ops_search_index_queue"


class PriceSyncStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    SUCCESS = "success", "Success"
    FAILED = "failed", "Failed"


class PriceSyncRun(TimeStampedModel):
    run_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    started_at = models.DateTimeField()
    completed_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(
        max_length=20, choices=PriceSyncStatus.choices, default=PriceSyncStatus.PENDING
    )
    records_processed = models.PositiveIntegerField(default=0)
    error_summary = models.TextField(blank=True)

    class Meta(TimeStampedModel.Meta):
        db_table = "ops_price_sync_run"


class IngestionStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    RUNNING = "running", "Running"
    SUCCESS = "success", "Success"
    FAILED = "failed", "Failed"


class IngestionSource(TimeStampedModel):
    source_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200, unique=True)
    slug = models.SlugField(unique=True, max_length=140)
    description = models.TextField(blank=True)
    url = models.URLField(blank=True)
    contact_email = models.EmailField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta(TimeStampedModel.Meta):
        db_table = "ops_ingestion_source"


class IngestionJob(TimeStampedModel):
    job_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    source = models.ForeignKey(
        IngestionSource, on_delete=models.CASCADE, related_name="jobs"
    )
    run_at = models.DateTimeField()
    status = models.CharField(
        max_length=20, choices=IngestionStatus.choices, default=IngestionStatus.PENDING
    )
    records_ingested = models.PositiveIntegerField(default=0)
    error_payload = models.JSONField(default=dict, blank=True)

    class Meta(TimeStampedModel.Meta):
        db_table = "ops_ingestion_job"