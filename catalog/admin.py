from django.contrib import admin

from . import models


@admin.register(models.Brand)
class BrandAdmin(admin.ModelAdmin):
    list_display = ("slug", "country", "status")
    search_fields = ("slug",)


@admin.register(models.Tag)
class TagAdmin(admin.ModelAdmin):
    list_display = ("name", "type", "is_featured")
    list_filter = ("type", "is_featured")
    search_fields = ("name",)


@admin.register(models.Item)
class ItemAdmin(admin.ModelAdmin):
    list_display = ("slug", "brand", "category", "status", "release_year")
    list_filter = ("status", "brand", "category")
    search_fields = ("slug",)