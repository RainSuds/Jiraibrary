"""Custom filter sets for catalog viewsets."""
from __future__ import annotations

from decimal import Decimal, InvalidOperation
from typing import Any, cast

import django_filters
from django.conf import settings
from django.db.models import Q
from django.http import QueryDict

from . import models


class SlugInFilter(django_filters.BaseInFilter, django_filters.CharFilter):
    """Allow filtering a char field with a list of slug values."""


class UUIDInFilter(django_filters.BaseInFilter, django_filters.UUIDFilter):
    """Allow filtering a UUID field with a list of UUID values."""


class ItemFilter(django_filters.FilterSet):
    brand = SlugInFilter(field_name="brand__slug", lookup_expr="in")
    category = UUIDInFilter(field_name="category__id", lookup_expr="in")
    subcategory = UUIDInFilter(field_name="subcategory__id", lookup_expr="in")
    style = SlugInFilter(field_name="substyles__style__slug", lookup_expr="in")
    substyle = SlugInFilter(field_name="substyles__slug", lookup_expr="in")
    tag = UUIDInFilter(field_name="tags__id", lookup_expr="in")
    color = UUIDInFilter(field_name="colors__id", lookup_expr="in")
    collection = UUIDInFilter(field_name="collections__id", lookup_expr="in")
    fabric = UUIDInFilter(field_name="fabrics__id", lookup_expr="in")
    feature = UUIDInFilter(field_name="features__id", lookup_expr="in")
    status = django_filters.MultipleChoiceFilter(
        field_name="status",
        choices=models.Item.ItemStatus.choices,
    )
    year = django_filters.NumberFilter(field_name="release_year")
    year__gte = django_filters.NumberFilter(field_name="release_year", lookup_expr="gte")
    year__lte = django_filters.NumberFilter(field_name="release_year", lookup_expr="lte")
    measurement_bust_min = django_filters.NumberFilter(
        field_name="measurements__bust_cm",
        lookup_expr="gte",
    )
    measurement_bust_max = django_filters.NumberFilter(
        field_name="measurements__bust_cm",
        lookup_expr="lte",
    )
    measurement_waist_min = django_filters.NumberFilter(
        field_name="measurements__waist_cm",
        lookup_expr="gte",
    )
    measurement_waist_max = django_filters.NumberFilter(
        field_name="measurements__waist_cm",
        lookup_expr="lte",
    )
    measurement_hip_min = django_filters.NumberFilter(
        field_name="measurements__hip_cm",
        lookup_expr="gte",
    )
    measurement_hip_max = django_filters.NumberFilter(
        field_name="measurements__hip_cm",
        lookup_expr="lte",
    )
    measurement_length_min = django_filters.NumberFilter(
        field_name="measurements__length_cm",
        lookup_expr="gte",
    )
    measurement_length_max = django_filters.NumberFilter(
        field_name="measurements__length_cm",
        lookup_expr="lte",
    )
    release_year_range = django_filters.CharFilter(method="filter_release_year_range")
    price_range = django_filters.CharFilter(method="filter_price_range")
    q = django_filters.CharFilter(method="filter_search")

    class Meta:
        model = models.Item
        fields = [
            "brand",
            "category",
            "subcategory",
            "style",
            "substyle",
            "tag",
            "color",
            "collection",
            "fabric",
            "feature",
            "status",
            "year",
            "year__gte",
            "year__lte",
            "measurement_bust_min",
            "measurement_bust_max",
            "measurement_waist_min",
            "measurement_waist_max",
            "measurement_hip_min",
            "measurement_hip_max",
            "measurement_length_min",
            "measurement_length_max",
            "release_year_range",
            "price_range",
        ]

    @property
    def qs(self):  # type: ignore[override]
        """Ensure distinct results when joining through many-to-many relations."""

        return super().qs.distinct()

    def filter_search(self, queryset, _: str, value: str):  # type: ignore[override]
        if not value:
            return queryset
        return queryset.filter(
            Q(translations__name__icontains=value)
            | Q(brand__slug__icontains=value)
            | Q(slug__icontains=value)
        ).distinct()

    def filter_release_year_range(self, queryset, name: str, value: str):
        data = getattr(self, "data", None)
        if not isinstance(data, QueryDict):
            return queryset
        raw_ranges = cast(QueryDict, data).getlist(name)
        if not raw_ranges:
            return queryset

        combined_query = Q()
        for raw in raw_ranges:
            if raw is None:
                continue
            min_part, sep, max_part = raw.partition(":")
            min_value = self._parse_int(min_part if sep else raw)
            max_value = self._parse_int(max_part if sep else None)
            if min_value is None and max_value is None:
                continue
            clause = Q()
            if min_value is not None:
                clause &= Q(release_year__gte=min_value)
            if max_value is not None:
                clause &= Q(release_year__lte=max_value)
            combined_query |= clause

        if combined_query:
            return queryset.filter(combined_query)
        return queryset

    def filter_price_range(self, queryset, name: str, value: str):
        data = getattr(self, "data", None)
        if not isinstance(data, QueryDict):
            return queryset
        raw_ranges = cast(QueryDict, data).getlist(name)
        if not raw_ranges:
            return queryset

        preferred_currency = getattr(settings, "PREFERRED_CURRENCY_CODE", None)
        combined_query = Q()
        for raw in raw_ranges:
            if raw is None:
                continue
            parts = raw.split(":")
            if len(parts) >= 3:
                currency_part, min_part, max_part = parts[0], parts[1], parts[2]
            elif len(parts) == 2:
                currency_part, min_part = parts[0], parts[1]
                max_part = ""
            elif len(parts) == 1:
                currency_part, min_part, max_part = parts[0], "", ""
            else:
                continue

            currency_code = currency_part or preferred_currency
            if not currency_code:
                continue

            min_value = self._parse_decimal(min_part)
            max_value = self._parse_decimal(max_part)
            if min_value is None and max_value is None:
                continue

            clause = Q(prices__currency__code=currency_code)
            if min_value is not None:
                clause &= Q(prices__amount__gte=min_value)
            if max_value is not None:
                clause &= Q(prices__amount__lte=max_value)
            combined_query |= clause

        if combined_query:
            return queryset.filter(combined_query).distinct()
        return queryset

    @staticmethod
    def _parse_int(value: str | None) -> int | None:
        if not value:
            return None
        try:
            return int(value)
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _parse_decimal(value: str | None) -> Decimal | None:
        if not value:
            return None
        try:
            return Decimal(value)
        except (InvalidOperation, TypeError, ValueError):
            return None
