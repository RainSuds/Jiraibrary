from django.contrib import admin
from .models import Brand, Tag, Item

@admin.register(Brand)
class BrandAdmin(admin.ModelAdmin):
    list_display = ('name', 'country')
    search_fields = ('name', 'country')

@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    list_display = ('name',)
    search_fields = ('name',)

@admin.register(Item)
class ItemAdmin(admin.ModelAdmin):
    list_display = ('name', 'brand', 'category', 'year', 'status')
    list_filter = ('category', 'brand', 'status', 'tags')
    search_fields = ('name', 'description')
    filter_horizontal = ('tags',)