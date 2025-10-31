from __future__ import annotations

from django.contrib import admin

from . import models


class BrandTranslationInline(admin.TabularInline):
    model = models.BrandTranslation
    extra = 0


class BrandStyleInline(admin.TabularInline):
    model = models.BrandStyle
    extra = 0
    autocomplete_fields = ["style"]


class BrandSubstyleInline(admin.TabularInline):
    model = models.BrandSubstyle
    extra = 0
    autocomplete_fields = ["substyle"]


@admin.register(models.Brand)
class BrandAdmin(admin.ModelAdmin):
    list_display = ("slug", "status", "country", "founded_year")
    list_filter = ("status", "country", "styles")
    search_fields = ("slug", "names")
    filter_horizontal = ("styles", "substyles")
    inlines = [BrandTranslationInline, BrandStyleInline, BrandSubstyleInline]


@admin.register(models.Collection)
class CollectionAdmin(admin.ModelAdmin):
    list_display = ("name", "brand", "season", "year")
    list_filter = ("season", "year", "brand")
    search_fields = ("name", "brand__slug")


@admin.register(models.Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "slug")
    search_fields = ("name", "slug")
    prepopulated_fields = {"slug": ("name",)}


@admin.register(models.Subcategory)
class SubcategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "category")
    search_fields = ("name", "slug", "category__name")
    list_filter = ("category",)
    prepopulated_fields = {"slug": ("name",)}


@admin.register(models.Style)
class StyleAdmin(admin.ModelAdmin):
    list_display = ("name", "slug")
    search_fields = ("name", "slug")
    prepopulated_fields = {"slug": ("name",)}


@admin.register(models.Tag)
class TagAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "type", "is_featured")
    list_filter = ("type", "is_featured")
    search_fields = ("name", "slug")
    prepopulated_fields = {"slug": ("name",)}


@admin.register(models.TagTranslation)
class TagTranslationAdmin(admin.ModelAdmin):
    list_display = ("tag", "language", "name", "source", "quality")
    list_filter = ("language", "source", "quality")
    search_fields = ("tag__name", "name")


class ItemTranslationInline(admin.TabularInline):
    model = models.ItemTranslation
    extra = 0


class ItemPriceInline(admin.TabularInline):
    model = models.ItemPrice
    extra = 0


class ItemVariantInline(admin.TabularInline):
    model = models.ItemVariant
    extra = 0


class ItemTagInline(admin.TabularInline):
    model = models.ItemTag
    extra = 0
    autocomplete_fields = ["tag"]


class ItemColorInline(admin.TabularInline):
    model = models.ItemColor
    extra = 0
    autocomplete_fields = ["color"]


class ItemSubstyleInline(admin.TabularInline):
    model = models.ItemSubstyle
    extra = 0
    autocomplete_fields = ["substyle"]


class ItemFabricInline(admin.TabularInline):
    model = models.ItemFabric
    extra = 0
    autocomplete_fields = ["fabric"]


class ItemFeatureInline(admin.TabularInline):
    model = models.ItemFeature
    extra = 0
    autocomplete_fields = ["feature"]


class ItemCollectionInline(admin.TabularInline):
    model = models.ItemCollection
    extra = 0
    autocomplete_fields = ["collection"]


@admin.register(models.Item)
class ItemAdmin(admin.ModelAdmin):
    list_display = (
        "slug",
        "brand",
        "status",
        "release_year",
        "limited_edition",
        "verified_source",
    )
    list_filter = ("status", "brand", "release_year", "limited_edition", "verified_source")
    search_fields = ("slug", "brand__slug", "translations__name")
    inlines = [
        ItemTranslationInline,
        ItemPriceInline,
        ItemVariantInline,
        ItemTagInline,
        ItemColorInline,
        ItemSubstyleInline,
        ItemFabricInline,
        ItemFeatureInline,
        ItemCollectionInline,
    ]


@admin.register(models.Image)
class ImageAdmin(admin.ModelAdmin):
    list_display = ("storage_path", "type", "item", "brand", "is_cover")
    list_filter = ("type", "is_cover", "source")
    search_fields = ("storage_path", "item__slug", "brand__slug")


@admin.register(models.Language)
class LanguageAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "is_supported")
    search_fields = ("code", "name")
    list_filter = ("is_supported",)


@admin.register(models.Currency)
class CurrencyAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "symbol", "is_active")
    search_fields = ("code", "name")
    list_filter = ("is_active",)


@admin.register(models.Substyle)
class SubstyleAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "style")
    search_fields = ("name", "slug", "style__name")
    list_filter = ("style",)
    prepopulated_fields = {"slug": ("name",)}
    autocomplete_fields = ["style"]

@admin.register(models.Color)
class ColorAdmin(admin.ModelAdmin):
    list_display = ("name", "hex_code")
    search_fields = ("name", "hex_code")


@admin.register(models.Fabric)
class FabricAdmin(admin.ModelAdmin):
    list_display = ("name",)
    search_fields = ("name",)


@admin.register(models.Feature)
class FeatureAdmin(admin.ModelAdmin):
    list_display = ("name", "category", "is_visible")
    list_filter = ("category", "is_visible")
    search_fields = ("name", "description")

admin.site.register(models.ItemMetadata)
admin.site.register(models.ItemMeasurement)
admin.site.register(models.ItemTag)
admin.site.register(models.ItemColor)
admin.site.register(models.ItemSubstyle)
admin.site.register(models.ItemFabric)
admin.site.register(models.ItemFeature)
admin.site.register(models.ItemCollection)
