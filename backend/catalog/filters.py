"""Custom filter sets for catalog viewsets."""
from __future__ import annotations

from decimal import Decimal, InvalidOperation
from typing import Any, cast

import django_filters
from django.conf import settings
from django.db.models import Count, Q
from django.http import QueryDict

from . import models
from .serializers import _get_fx_rate


class SlugInFilter(django_filters.BaseInFilter, django_filters.CharFilter):
    """Allow filtering a char field with a list of slug values."""


class UUIDInFilter(django_filters.BaseInFilter, django_filters.UUIDFilter):
    """Allow filtering a UUID field with a list of UUID values."""


class ItemFilter(django_filters.FilterSet):
    brand = SlugInFilter(method="filter_brand")
    category = UUIDInFilter(method="filter_category")
    subcategory = UUIDInFilter(field_name="subcategory__id", lookup_expr="in")
    style = SlugInFilter(method="filter_style")
    substyle = SlugInFilter(field_name="substyles__slug", lookup_expr="in")
    tag = UUIDInFilter(method="filter_tag")
    color = UUIDInFilter(method="filter_color")
    collection = UUIDInFilter(method="filter_collection")
    fabric = UUIDInFilter(method="filter_fabric")
    feature = UUIDInFilter(method="filter_feature")
    season = django_filters.CharFilter(field_name="metadata__season", lookup_expr="iexact")
    fit = django_filters.CharFilter(field_name="metadata__fit", lookup_expr="iexact")
    status = django_filters.MultipleChoiceFilter(
        field_name="status",
        choices=models.Item.ItemStatus.choices,
    )
    year = django_filters.NumberFilter(field_name="release_year")
    year__gte = django_filters.NumberFilter(field_name="release_year", lookup_expr="gte")
    year__lte = django_filters.NumberFilter(field_name="release_year", lookup_expr="lte")
    measurement_bust_min = django_filters.NumberFilter(method="filter_measurement_min")
    measurement_bust_max = django_filters.NumberFilter(method="filter_measurement_max")
    measurement_waist_min = django_filters.NumberFilter(method="filter_measurement_min")
    measurement_waist_max = django_filters.NumberFilter(method="filter_measurement_max")
    measurement_hip_min = django_filters.NumberFilter(method="filter_measurement_min")
    measurement_hip_max = django_filters.NumberFilter(method="filter_measurement_max")
    measurement_length_min = django_filters.NumberFilter(method="filter_measurement_min")
    measurement_length_max = django_filters.NumberFilter(method="filter_measurement_max")
    measurement_range = django_filters.CharFilter(method="filter_measurement_range")
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
            "season",
            "fit",
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
            "measurement_range",
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

    def filter_style(self, queryset, name: str, value: str):  # type: ignore[override]
        data = getattr(self, "data", None)
        if not isinstance(data, QueryDict):
            return queryset
        raw_values = cast(QueryDict, data).getlist(name)
        style_slugs: list[str] = []
        for entry in raw_values:
            if not entry:
                continue
            style_slugs.extend([slug for slug in entry.split(",") if slug])
        if not style_slugs:
            return queryset
        return queryset.filter(
            Q(styles__slug__in=style_slugs) | Q(substyles__style__slug__in=style_slugs)
        ).distinct()

    def filter_brand(self, queryset, name: str, value: str):  # type: ignore[override]
        data = getattr(self, "data", None)
        if not isinstance(data, QueryDict):
            return queryset
        raw_values = cast(QueryDict, data).getlist(name)
        brand_slugs = [entry for entry in raw_values if entry]
        if not brand_slugs:
            return queryset
        return queryset.filter(brand__slug__in=brand_slugs).distinct()

    def filter_category(self, queryset, name: str, value: str):  # type: ignore[override]
        data = getattr(self, "data", None)
        if not isinstance(data, QueryDict):
            return queryset
        raw_values = cast(QueryDict, data).getlist(name)
        category_ids = [entry for entry in raw_values if entry]
        if not category_ids:
            return queryset
        return queryset.filter(category__id__in=category_ids).distinct()

    def filter_color(self, queryset, name: str, value: str):  # type: ignore[override]
        data = getattr(self, "data", None)
        if not isinstance(data, QueryDict):
            return queryset
        raw_values = cast(QueryDict, data).getlist(name)
        color_ids = [entry for entry in raw_values if entry]
        if not color_ids:
            return queryset
        match_mode = self._get_match_mode(cast(QueryDict, data), "color_match", "all")
        if match_mode == "all":
            return (
                queryset.filter(colors__id__in=color_ids)
                .annotate(
                    matched_colors=Count(
                        "colors",
                        filter=Q(colors__id__in=color_ids),
                        distinct=True,
                    )
                )
                .filter(matched_colors=len(color_ids))
            )
        return queryset.filter(colors__id__in=color_ids).distinct()

    def filter_tag(self, queryset, name: str, value: str):  # type: ignore[override]
        data = getattr(self, "data", None)
        if not isinstance(data, QueryDict):
            return queryset
        raw_values = cast(QueryDict, data).getlist(name)
        tag_ids = [entry for entry in raw_values if entry]
        if not tag_ids:
            return queryset
        match_mode = self._get_match_mode(cast(QueryDict, data), "tag_match", "any")
        if match_mode == "all":
            return (
                queryset.filter(tags__id__in=tag_ids)
                .annotate(
                    matched_tags=Count(
                        "tags",
                        filter=Q(tags__id__in=tag_ids),
                        distinct=True,
                    )
                )
                .filter(matched_tags=len(tag_ids))
            )
        return queryset.filter(tags__id__in=tag_ids).distinct()

    def filter_collection(self, queryset, name: str, value: str):  # type: ignore[override]
        data = getattr(self, "data", None)
        if not isinstance(data, QueryDict):
            return queryset
        raw_values = cast(QueryDict, data).getlist(name)
        collection_ids = [entry for entry in raw_values if entry]
        if not collection_ids:
            return queryset
        return queryset.filter(collections__id__in=collection_ids).distinct()

    def filter_fabric(self, queryset, name: str, value: str):  # type: ignore[override]
        data = getattr(self, "data", None)
        if not isinstance(data, QueryDict):
            return queryset
        raw_values = cast(QueryDict, data).getlist(name)
        fabric_ids = [entry for entry in raw_values if entry]
        if not fabric_ids:
            return queryset
        match_mode = self._get_match_mode(cast(QueryDict, data), "fabric_match", "any")
        if match_mode == "all":
            return (
                queryset.filter(fabrics__id__in=fabric_ids)
                .annotate(
                    matched_fabrics=Count(
                        "fabrics",
                        filter=Q(fabrics__id__in=fabric_ids),
                        distinct=True,
                    )
                )
                .filter(matched_fabrics=len(fabric_ids))
            )
        return queryset.filter(fabrics__id__in=fabric_ids).distinct()

    def filter_feature(self, queryset, name: str, value: str):  # type: ignore[override]
        data = getattr(self, "data", None)
        if not isinstance(data, QueryDict):
            return queryset
        raw_values = cast(QueryDict, data).getlist(name)
        feature_ids = [entry for entry in raw_values if entry]
        if not feature_ids:
            return queryset
        match_mode = self._get_match_mode(cast(QueryDict, data), "feature_match", "any")
        if match_mode == "all":
            return (
                queryset.filter(features__id__in=feature_ids)
                .annotate(
                    matched_features=Count(
                        "features",
                        filter=Q(features__id__in=feature_ids),
                        distinct=True,
                    )
                )
                .filter(matched_features=len(feature_ids))
            )
        return queryset.filter(features__id__in=feature_ids).distinct()

    def _get_match_mode(self, data: QueryDict, param: str, default: str) -> str:
        raw = data.get(param, default) or default
        normalized = raw.strip().lower()
        if normalized in {"all", "and"}:
            return "all"
        return "any"

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

    def _measurement_key_from_param(self, param_name: str) -> str | None:
        if param_name.startswith("measurement_"):
            key = param_name.replace("measurement_", "", 1)
            return key.rsplit("_", 1)[0]
        return None

    def filter_measurement_min(self, queryset, name: str, value: str):  # type: ignore[override]
        try:
            min_value = float(value)
        except (TypeError, ValueError):
            return queryset
        measurement_key = self._measurement_key_from_param(name)
        if not measurement_key:
            return queryset
        return queryset.filter(
            Q(variants__measurements__measurement_type__name__iexact=measurement_key)
            & (
                Q(variants__measurements__min_value__lte=min_value)
                | Q(variants__measurements__min_value__isnull=True)
            )
            & (
                Q(variants__measurements__max_value__gte=min_value)
                | Q(variants__measurements__max_value__isnull=True)
            )
        ).distinct()

    def filter_measurement_max(self, queryset, name: str, value: str):  # type: ignore[override]
        try:
            max_value = float(value)
        except (TypeError, ValueError):
            return queryset
        measurement_key = self._measurement_key_from_param(name)
        if not measurement_key:
            return queryset
        return queryset.filter(
            Q(variants__measurements__measurement_type__name__iexact=measurement_key)
            & (
                Q(variants__measurements__min_value__lte=max_value)
                | Q(variants__measurements__min_value__isnull=True)
            )
            & (
                Q(variants__measurements__max_value__gte=max_value)
                | Q(variants__measurements__max_value__isnull=True)
            )
        ).distinct()

    def filter_measurement_range(self, queryset, name: str, value: str):  # type: ignore[override]
        data = getattr(self, "data", None)
        if not isinstance(data, QueryDict):
            return queryset
        raw_ranges = cast(QueryDict, data).getlist(name)
        if not raw_ranges:
            return queryset

        grouped: dict[str, list[tuple[float | None, float | None]]] = {}
        for raw in raw_ranges:
            if raw is None:
                continue
            parts = raw.split(":")
            if not parts:
                continue
            measurement_name = (parts[0] or "").strip().lower()
            if not measurement_name:
                continue
            min_value = None
            max_value = None
            if len(parts) >= 2 and parts[1] != "":
                try:
                    min_value = float(parts[1])
                except (TypeError, ValueError):
                    min_value = None
            if len(parts) >= 3 and parts[2] != "":
                try:
                    max_value = float(parts[2])
                except (TypeError, ValueError):
                    max_value = None
            if min_value is None and max_value is None:
                continue
            grouped.setdefault(measurement_name, []).append((min_value, max_value))

        if not grouped:
            return queryset

        combined_query = Q()
        for measurement_name, ranges in grouped.items():
            group_query = Q()
            for min_value, max_value in ranges:
                clause = Q(variants__measurements__measurement_type__name__iexact=measurement_name)
                if min_value is not None and max_value is not None:
                    clause &= (
                        Q(variants__measurements__min_value__isnull=True)
                        | Q(variants__measurements__min_value__lte=max_value)
                    )
                    clause &= (
                        Q(variants__measurements__max_value__isnull=True)
                        | Q(variants__measurements__max_value__gte=min_value)
                    )
                elif min_value is not None:
                    clause &= (
                        Q(variants__measurements__max_value__gte=min_value)
                        | (
                            Q(variants__measurements__max_value__isnull=True)
                            & Q(variants__measurements__min_value__gte=min_value)
                        )
                    )
                elif max_value is not None:
                    clause &= (
                        Q(variants__measurements__min_value__lte=max_value)
                        | (
                            Q(variants__measurements__min_value__isnull=True)
                            & Q(variants__measurements__max_value__lte=max_value)
                        )
                    )
                group_query |= clause
            combined_query &= group_query

        if combined_query:
            return queryset.filter(combined_query).distinct()
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
        converted_item_ids: set[str] = set()
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

            item_ids_with_currency = set(
                models.ItemPrice.objects.filter(
                    item__in=queryset,
                    currency__code=currency_code,
                ).values_list("item_id", flat=True)
            )

            fallback_prices = (
                models.ItemPrice.objects.filter(item__in=queryset)
                .exclude(item_id__in=item_ids_with_currency)
                .select_related("currency")
            )

            rate_cache: dict[str, Decimal | None] = {}
            for price in fallback_prices:
                if not price.currency or not price.currency.code:
                    continue
                base_currency = price.currency.code.upper()
                if base_currency == currency_code.upper():
                    continue
                rate = rate_cache.get(base_currency)
                if rate is None and base_currency not in rate_cache:
                    rate = _get_fx_rate(base_currency, currency_code)
                    rate_cache[base_currency] = rate
                if rate is None:
                    continue
                try:
                    converted_amount = Decimal(price.amount) * rate
                except (InvalidOperation, TypeError):
                    continue
                if min_value is not None and converted_amount < min_value:
                    continue
                if max_value is not None and converted_amount > max_value:
                    continue
                converted_item_ids.add(str(price.item_id))

        if combined_query:
            filtered = queryset.filter(combined_query)
        else:
            filtered = queryset

        if converted_item_ids:
            filtered = filtered | queryset.filter(id__in=converted_item_ids)

        return filtered.distinct()

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
