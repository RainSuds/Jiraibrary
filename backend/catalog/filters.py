"""Custom filter sets for catalog viewsets."""
from __future__ import annotations

import django_filters
from django.db.models import Q

from . import models


class ItemFilter(django_filters.FilterSet):
    brand = django_filters.CharFilter(field_name="brand__slug", lookup_expr="iexact")
    category = django_filters.CharFilter(field_name="category__name", lookup_expr="iexact")
    category_slug = django_filters.CharFilter(field_name="category__slug", lookup_expr="iexact")
    category_id = django_filters.UUIDFilter(field_name="category__id")
    subcategory = django_filters.CharFilter(field_name="subcategory__name", lookup_expr="iexact")
    subcategory_slug = django_filters.CharFilter(field_name="subcategory__slug", lookup_expr="iexact")
    substyle = django_filters.CharFilter(field_name="substyles__name", lookup_expr="iexact")
    style = django_filters.CharFilter(field_name="substyles__style__name", lookup_expr="iexact")
    style_slug = django_filters.CharFilter(field_name="substyles__style__slug", lookup_expr="iexact")
    style_id = django_filters.UUIDFilter(field_name="substyles__style__id")
    tag = django_filters.CharFilter(field_name="tags__name", lookup_expr="iexact")
    tag_slug = django_filters.CharFilter(field_name="tags__slug", lookup_expr="iexact")
    tag_id = django_filters.UUIDFilter(field_name="tags__id")
    color = django_filters.CharFilter(field_name="colors__name", lookup_expr="iexact")
    color_id = django_filters.UUIDFilter(field_name="colors__id")
    collection_id = django_filters.UUIDFilter(field_name="collections__id")
    status = django_filters.MultipleChoiceFilter(
        field_name="status",
        choices=models.Item.ItemStatus.choices,
    )
    year = django_filters.NumberFilter(field_name="release_year")
    year__gte = django_filters.NumberFilter(field_name="release_year", lookup_expr="gte")
    year__lte = django_filters.NumberFilter(field_name="release_year", lookup_expr="lte")
    q = django_filters.CharFilter(method="filter_search")

    class Meta:
        model = models.Item
        fields = [
            "brand",
            "category",
            "category_slug",
            "category_id",
            "subcategory",
            "subcategory_slug",
            "substyle",
            "style",
            "style_slug",
            "style_id",
            "tag",
            "tag_slug",
            "tag_id",
            "color",
            "color_id",
            "status",
            "year",
            "year__gte",
            "year__lte",
            "collection_id",
        ]

    def filter_search(self, queryset, _: str, value: str):  # type: ignore[override]
        if not value:
            return queryset
        return queryset.filter(
            Q(translations__name__icontains=value)
            | Q(brand__slug__icontains=value)
            | Q(slug__icontains=value)
        ).distinct()
