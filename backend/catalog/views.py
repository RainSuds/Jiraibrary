"""Viewsets powering the public catalog API."""
from __future__ import annotations

from typing import Any, cast
from uuid import UUID

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db.models import Count, Max, Min, Prefetch, Q, QuerySet
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, mixins, permissions, status, viewsets
from rest_framework.exceptions import MethodNotAllowed, PermissionDenied
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.request import Request

from . import filters, models, serializers
from .permissions import IsCatalogEditor, IsImageOwnerOrCatalogEditor


UserModel = get_user_model()


def _is_uuid_value(value: Any) -> bool:
    try:
        UUID(str(value))
    except (ValueError, TypeError, AttributeError):
        return False
    return True


class BrandViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = (
        models.Brand.objects.annotate(
            item_count=Count(
                "items",
                filter=Q(items__status=models.Item.ItemStatus.PUBLISHED),
                distinct=True,
            )
        )
        .prefetch_related(
            "styles",
            Prefetch(
                "substyles",
                queryset=models.Substyle.objects.select_related("style"),
            ),
            Prefetch(
                "translations",
                queryset=models.BrandTranslation.objects.select_related("language"),
            ),
        )
        .order_by("slug")
    )
    lookup_field = "slug"

    def get_serializer_class(self):  # type: ignore[override]
        if self.action == "list":
            return serializers.BrandListSerializer
        return serializers.BrandSerializer


class CollectionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = (
        models.Collection.objects.select_related("brand")
        .all()
        .order_by("brand__slug", "-year", "season")
    )
    serializer_class = serializers.CollectionSerializer
    filterset_fields = ["brand__slug", "season", "year"]
    ordering_fields = ["year", "season", "name"]
    search_fields = ["name", "brand__slug"]


class CategoryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = models.Category.objects.all().order_by("name")
    serializer_class = serializers.CategorySerializer
    lookup_field = "slug"


class StyleViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = models.Style.objects.all().order_by("name")
    serializer_class = serializers.StyleSerializer
    lookup_field = "slug"


class SubcategoryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = models.Subcategory.objects.select_related("category").all()
    serializer_class = serializers.SubcategorySerializer
    filterset_fields = ["category__slug"]
    lookup_field = "slug"


class SubstyleViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = models.Substyle.objects.select_related("style").all()
    serializer_class = serializers.SubstyleSerializer
    filterset_fields = ["style__slug"]
    lookup_field = "slug"


class TagViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = models.Tag.objects.all().order_by("name")
    serializer_class = serializers.TagSerializer
    lookup_field = "slug"
    filterset_fields = ["type", "is_featured"]
    search_fields = ["name", "slug"]


class ColorViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = models.Color.objects.all().order_by("name")
    serializer_class = serializers.ColorSerializer


class FabricViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = models.Fabric.objects.all().order_by("name")
    serializer_class = serializers.FabricSerializer


class FeatureViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = models.Feature.objects.all().order_by("name")
    serializer_class = serializers.FeatureSerializer
    filterset_fields = ["category", "is_visible"]


class ImageViewSet(viewsets.ModelViewSet):
    queryset = models.Image.objects.select_related("item", "brand", "variant", "uploaded_by").all()
    serializer_class = serializers.ImageSerializer
    filterset_fields = ["item__slug", "brand__slug", "type", "is_cover"]
    search_fields = ["storage_path", "caption"]
    parser_classes = [MultiPartParser, FormParser]
    http_method_names = ["get", "post", "put", "patch", "delete", "head", "options"]

    def get_permissions(self):  # type: ignore[override]
        if self.action in {"list", "retrieve"}:
            return [permissions.AllowAny()]
        if self.action == "create":
            return [permissions.IsAuthenticated()]
        if self.action in {"update", "partial_update", "destroy"}:
            return [permissions.IsAuthenticated(), IsImageOwnerOrCatalogEditor()]
        return [permissions.IsAuthenticated(), IsCatalogEditor()]

    def get_serializer_class(self):  # type: ignore[override]
        if self.action in {"create", "update", "partial_update"}:
            return serializers.ImageUploadSerializer
        return super().get_serializer_class()

    @staticmethod
    def _user_is_editor(user: Any) -> bool:
        return bool(getattr(user, "is_staff", False) or getattr(user, "is_superuser", False))

    def perform_create(self, serializer):  # type: ignore[override]
        user = getattr(self.request, "user", None)
        extra_kwargs: dict[str, Any] = {}
        if user and getattr(user, "is_authenticated", False):
            extra_kwargs["uploaded_by"] = user
        if not self._user_is_editor(user):
            for field in ("item", "brand", "variant"):
                serializer.validated_data.pop(field, None)
            extra_kwargs.setdefault("item", None)
            extra_kwargs.setdefault("brand", None)
            extra_kwargs.setdefault("variant", None)
        serializer.save(**extra_kwargs)

    def perform_update(self, serializer):  # type: ignore[override]
        user = getattr(self.request, "user", None)
        if not self._user_is_editor(user):
            for field in ("item", "brand", "variant"):
                serializer.validated_data.pop(field, None)
        serializer.save()


class LanguageViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = models.Language.objects.all().order_by("code")
    serializer_class = serializers.LanguageSerializer
    lookup_field = "code"


class CurrencyViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = models.Currency.objects.all().order_by("code")
    serializer_class = serializers.CurrencySerializer
    lookup_field = "code"


class ItemViewSet(viewsets.ModelViewSet):
    queryset = (
        models.Item.objects.select_related(
            "brand",
            "category",
            "subcategory",
            "default_language",
            "default_currency",
            "submitted_by",
            "submitted_by__profile",
        )
        .prefetch_related(
            "tags",
            "substyles",
            "fabrics",
            "features",
            "collections",
            Prefetch(
                "prices",
                queryset=models.ItemPrice.objects.select_related("currency").order_by(
                    "-valid_from",
                    "-created_at",
                ),
            ),
            Prefetch(
                "translations",
                queryset=models.ItemTranslation.objects.select_related("language"),
            ),
            Prefetch(
                "variants",
                queryset=models.ItemVariant.objects.select_related("color"),
            ),
            Prefetch(
                "itemcolor_set",
                queryset=models.ItemColor.objects.select_related("color"),
            ),
            Prefetch(
                "itemcollection_set",
                queryset=models.ItemCollection.objects.select_related("collection__brand"),
            ),
            Prefetch(
                "itemsubstyle_set",
                queryset=models.ItemSubstyle.objects.select_related("substyle__style"),
            ),
            Prefetch(
                "itemfabric_set",
                queryset=models.ItemFabric.objects.select_related("fabric"),
            ),
            Prefetch(
                "itemfeature_set",
                queryset=models.ItemFeature.objects.select_related("feature"),
            ),
            Prefetch(
                "images",
                queryset=models.Image.objects.order_by("-is_cover", "-created_at"),
            ),
        )
        .all()
        .distinct()
    )
    filterset_class = filters.ItemFilter
    ordering_fields = ["created_at", "release_year", "brand__slug"]
    ordering = ["brand__slug", "slug"]
    search_fields = ["slug", "translations__name", "brand__slug"]
    lookup_field = "slug"
    pagination_class = None
    http_method_names = ["get", "post", "put", "delete", "head", "options"]
    serializer_class = serializers.ItemSummarySerializer

    def get_serializer_class(self):  # type: ignore[override]
        if self.action in {"create", "update"}:
            return serializers.ItemWriteSerializer
        if self.action == "retrieve":
            return serializers.ItemDetailSerializer
        return serializers.ItemSummarySerializer

    def get_permissions(self):  # type: ignore[override]
        if self.action in {"list", "retrieve"}:
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated(), IsCatalogEditor()]

    def partial_update(self, request, *args, **kwargs):  # type: ignore[override]
        raise MethodNotAllowed("PATCH")

    def list(self, request, *args, **kwargs):  # type: ignore[override]
        queryset = self.filter_queryset(self.get_queryset())
        total_count = queryset.count()
        limit_param = request.query_params.get("limit")
        try:
            limit = int(limit_param) if limit_param else 60
        except ValueError:
            limit = 60
        if limit > 0:
            queryset = queryset[:limit]

        serializer = self.get_serializer(queryset, many=True)
        selected = self._extract_selected_filters(request)
        filters_payload = self._build_filters_payload(selected)
        active_filters = self._build_active_filters(selected)

        return Response(
            {
                "results": serializer.data,
                "result_count": total_count,
                "filters": filters_payload,
                "selected": selected,
                "active_filters": active_filters,
            }
        )

    def _extract_selected_filters(self, request) -> dict[str, Any]:
        def normalize(value: str | None) -> str | None:
            if value is None or value == "":
                return None
            return value

        def normalize_list(param: str) -> list[str]:
            values = [value for value in request.query_params.getlist(param) if value]
            return values

        def normalize_number(param: str) -> float | None:
            raw = request.query_params.get(param)
            if raw is None or raw == "":
                return None
            try:
                return float(raw)
            except (TypeError, ValueError):
                return None

        def parse_int(value: str | None) -> int | None:
            if value in (None, ""):
                return None
            try:
                return int(value)
            except (TypeError, ValueError):
                return None

        def parse_float(value: str | None) -> float | None:
            if value in (None, ""):
                return None
            try:
                return float(value)
            except (TypeError, ValueError):
                return None

        release_year_ranges: list[dict[str, int | None | str]] = []
        for raw in request.query_params.getlist("release_year_range"):
            if raw is None:
                continue
            min_part, sep, max_part = raw.partition(":")
            min_value = parse_int(min_part) if sep else parse_int(raw)
            max_value = parse_int(max_part) if sep else None
            if min_value is None and max_value is None:
                continue
            value_key = f"{min_part}:{max_part}" if sep else min_part
            release_year_ranges.append(
                {
                    "min": min_value,
                    "max": max_value,
                    "value_key": value_key,
                }
            )

        currency_setting = getattr(settings, "PREFERRED_CURRENCY_CODE", None)
        price_currency = (
            currency_setting
            if isinstance(currency_setting, str) and currency_setting
            else "USD"
        )
        price_ranges: list[dict[str, float | str | None]] = []
        for raw in request.query_params.getlist("price_range"):
            if raw is None:
                continue
            parts = raw.split(":")
            if len(parts) == 3:
                currency_part, min_part, max_part = parts
            elif len(parts) == 2:
                currency_part, min_part = parts
                max_part = ""
            else:
                currency_part = parts[0] if parts else ""
                min_part = ""
                max_part = ""
            currency_code = currency_part or price_currency
            min_value = parse_float(min_part)
            max_value = parse_float(max_part)
            if currency_code is None or (min_value is None and max_value is None):
                continue
            value_key = f"{currency_code}:{min_part}:{max_part}"
            price_ranges.append(
                {
                    "currency": currency_code,
                    "min": min_value,
                    "max": max_value,
                    "value_key": value_key,
                }
            )

        return {
            "q": normalize(request.query_params.get("q")),
            "brand": normalize_list("brand"),
            "category": normalize_list("category"),
            "subcategory": normalize_list("subcategory"),
            "style": normalize_list("style"),
            "substyle": normalize_list("substyle"),
            "tag": normalize_list("tag"),
            "color": normalize_list("color"),
            "collection": normalize_list("collection"),
            "fabric": normalize_list("fabric"),
            "feature": normalize_list("feature"),
            "measurement": {
                "bust_min": normalize_number("measurement_bust_min"),
                "bust_max": normalize_number("measurement_bust_max"),
                "waist_min": normalize_number("measurement_waist_min"),
                "waist_max": normalize_number("measurement_waist_max"),
                "hip_min": normalize_number("measurement_hip_min"),
                "hip_max": normalize_number("measurement_hip_max"),
                "length_min": normalize_number("measurement_length_min"),
                "length_max": normalize_number("measurement_length_max"),
            },
            "release_year_ranges": release_year_ranges,
            "price_currency": price_currency,
            "price_ranges": price_ranges,
        }

    def _build_filters_payload(self, selected: dict[str, Any]) -> dict[str, Any]:
        published_filter = Q(items__status=models.Item.ItemStatus.PUBLISHED)
        style_published_filter = Q(
            substyles__items__status=models.Item.ItemStatus.PUBLISHED
        )
        measurement_filter = Q(item__status=models.Item.ItemStatus.PUBLISHED)

        selected_brand_slugs = set(cast(list[str], selected.get("brand") or []))
        selected_category_ids = set(cast(list[str], selected.get("category") or []))
        selected_subcategory_ids = set(cast(list[str], selected.get("subcategory") or []))
        selected_style_slugs = set(cast(list[str], selected.get("style") or []))
        selected_substyle_slugs = set(cast(list[str], selected.get("substyle") or []))
        selected_tag_ids = set(cast(list[str], selected.get("tag") or []))
        selected_color_ids = set(cast(list[str], selected.get("color") or []))
        selected_collection_ids = set(cast(list[str], selected.get("collection") or []))
        selected_fabric_ids = set(cast(list[str], selected.get("fabric") or []))
        selected_feature_ids = set(cast(list[str], selected.get("feature") or []))

        brand_queryset = (
            models.Brand.objects.annotate(
                item_count=Count("items", filter=published_filter, distinct=True)
            )
            .filter(Q(item_count__gt=0) | Q(slug__in=selected_brand_slugs))
            .order_by("-item_count", "slug")
        )
        brand_options = [
            {
                "slug": brand.slug,
                "name": brand.display_name(),
                "selected": brand.slug in selected_brand_slugs,
                "item_count": int(getattr(brand, "item_count", 0) or 0),
                "country": brand.country,
            }
            for brand in brand_queryset[:48]
        ]

        subcategory_queryset = (
            models.Subcategory.objects.annotate(
                item_count=Count("items", filter=published_filter, distinct=True)
            )
            .filter(Q(item_count__gt=0) | Q(id__in=selected_subcategory_ids))
            .select_related("category")
            .order_by("category__name", "name")
        )
        subcategory_map: dict[str, list[dict[str, Any]]] = {}
        for subcategory in subcategory_queryset:
            category_rel = subcategory.category
            if not category_rel:
                continue
            category_id = str(category_rel.id)
            subcategory_map.setdefault(category_id, []).append(
                {
                    "id": str(subcategory.id),
                    "name": subcategory.name,
                    "selected": str(subcategory.id) in selected_subcategory_ids,
                    "item_count": int(getattr(subcategory, "item_count", 0) or 0),
                }
            )

        category_queryset = (
            models.Category.objects.annotate(
                item_count=Count("items", filter=published_filter, distinct=True)
            )
            .filter(
                Q(item_count__gt=0)
                | Q(id__in=selected_category_ids)
                | Q(subcategories__id__in=selected_subcategory_ids)
            )
            .order_by("name")
            .distinct()
        )
        category_options = []
        for category in category_queryset:
            category_id = str(category.id)
            subcategories = subcategory_map.get(category_id, [])
            category_selected = (
                category_id in selected_category_ids
                or any(sub_option["selected"] for sub_option in subcategories)
            )
            category_options.append(
                {
                    "id": category_id,
                    "name": category.name,
                    "selected": category_selected,
                    "item_count": int(getattr(category, "item_count", 0) or 0),
                    "subcategories": subcategories,
                }
            )
        category_options.sort(key=lambda option: option["name"])

        substyle_queryset = (
            models.Substyle.objects.annotate(
                item_count=Count("items", filter=published_filter, distinct=True)
            )
            .filter(Q(item_count__gt=0) | Q(slug__in=selected_substyle_slugs))
            .select_related("style")
            .order_by("style__name", "name")
        )
        substyle_map: dict[str, list[dict[str, Any]]] = {}
        for substyle in substyle_queryset:
            if not substyle.style:
                continue
            style_slug = substyle.style.slug
            if not style_slug:
                continue
            substyle_map.setdefault(style_slug, []).append(
                {
                    "slug": substyle.slug,
                    "name": substyle.name,
                    "selected": substyle.slug in selected_substyle_slugs,
                    "item_count": int(getattr(substyle, "item_count", 0) or 0),
                }
            )

        style_queryset = (
            models.Style.objects.annotate(
                item_count=Count(
                    "substyles__items", filter=style_published_filter, distinct=True
                )
            )
            .filter(Q(item_count__gt=0) | Q(slug__in=selected_style_slugs))
            .order_by("name")
        )
        style_options = []
        for style in style_queryset:
            substyles = substyle_map.get(style.slug, [])
            style_selected = style.slug in selected_style_slugs or any(
                sub_option["selected"] for sub_option in substyles
            )
            style_options.append(
                {
                    "slug": style.slug,
                    "name": style.name,
                    "selected": style_selected,
                    "item_count": int(getattr(style, "item_count", 0) or 0),
                    "substyles": substyles,
                }
            )
        style_options.sort(key=lambda option: option["name"])

        tag_queryset = (
            models.Tag.objects.annotate(
                item_count=Count("items", filter=published_filter, distinct=True)
            )
            .filter(Q(item_count__gt=0) | Q(id__in=selected_tag_ids))
            .order_by("-item_count", "name")
        )
        tag_options = [
            {
                "id": str(tag.id),
                "name": tag.name,
                "selected": str(tag.id) in selected_tag_ids,
                "type": tag.type,
                "item_count": int(getattr(tag, "item_count", 0) or 0),
            }
            for tag in tag_queryset[:60]
        ]

        color_queryset = (
            models.Color.objects.annotate(
                item_count=Count("items", filter=published_filter, distinct=True)
            )
            .filter(Q(item_count__gt=0) | Q(id__in=selected_color_ids))
            .order_by("-item_count", "name")
        )
        color_options = [
            {
                "id": str(color.id),
                "name": color.name,
                "selected": str(color.id) in selected_color_ids,
                "hex": color.hex_code,
                "item_count": int(getattr(color, "item_count", 0) or 0),
            }
            for color in color_queryset[:48]
        ]

        collection_queryset = (
            models.Collection.objects.annotate(
                item_count=Count("items", filter=published_filter, distinct=True)
            )
            .filter(Q(item_count__gt=0) | Q(id__in=selected_collection_ids))
            .select_related("brand")
            .order_by("-year", "name")
        )
        collection_options = [
            {
                "id": str(collection.id),
                "name": collection.name,
                "brand_slug": collection.brand.slug if collection.brand else None,
                "year": collection.year,
                "selected": str(collection.id) in selected_collection_ids,
            }
            for collection in collection_queryset[:48]
        ]

        fabric_queryset = (
            models.Fabric.objects.annotate(
                item_count=Count("items", filter=published_filter, distinct=True)
            )
            .filter(Q(item_count__gt=0) | Q(id__in=selected_fabric_ids))
            .order_by("name")
        )
        fabric_options = [
            {
                "id": str(fabric.id),
                "name": fabric.name,
                "selected": str(fabric.id) in selected_fabric_ids,
                "item_count": int(getattr(fabric, "item_count", 0) or 0),
            }
            for fabric in fabric_queryset[:48]
        ]

        feature_queryset = (
            models.Feature.objects.annotate(
                item_count=Count("items", filter=published_filter, distinct=True)
            )
            .filter(Q(item_count__gt=0) | Q(id__in=selected_feature_ids))
            .order_by("name")
        )
        feature_options = [
            {
                "id": str(feature.id),
                "name": feature.name,
                "selected": str(feature.id) in selected_feature_ids,
                "category": feature.category,
                "item_count": int(getattr(feature, "item_count", 0) or 0),
            }
            for feature in feature_queryset[:48]
        ]

        measurement_ranges = models.ItemMeasurement.objects.aggregate(
            bust_min=Min("bust_cm", filter=measurement_filter),
            bust_max=Max("bust_cm", filter=measurement_filter),
            waist_min=Min("waist_cm", filter=measurement_filter),
            waist_max=Max("waist_cm", filter=measurement_filter),
            hip_min=Min("hip_cm", filter=measurement_filter),
            hip_max=Max("hip_cm", filter=measurement_filter),
            length_min=Min("length_cm", filter=measurement_filter),
            length_max=Max("length_cm", filter=measurement_filter),
        )

        release_year_ranges = models.Item.objects.filter(
            status=models.Item.ItemStatus.PUBLISHED,
            release_year__isnull=False,
        ).aggregate(
            min_year=Min("release_year"),
            max_year=Max("release_year"),
        )

        currency_setting = getattr(settings, "PREFERRED_CURRENCY_CODE", None)
        preferred_currency = (
            currency_setting
            if isinstance(currency_setting, str) and currency_setting
            else None
        )
        price_stats: dict[str, Any] | None = None
        if preferred_currency:
            price_stats = (
                models.ItemPrice.objects.filter(
                    item__status=models.Item.ItemStatus.PUBLISHED,
                    currency__code=preferred_currency,
                ).aggregate(
                    min_amount=Min("amount"),
                    max_amount=Max("amount"),
                )
            )
        if (
            not price_stats
            or (
                price_stats.get("min_amount") is None
                and price_stats.get("max_amount") is None
            )
        ):
            fallback_currency = (
                models.ItemPrice.objects.filter(
                    item__status=models.Item.ItemStatus.PUBLISHED
                )
                .values("currency__code")
                .annotate(currency_count=Count("id"))
                .order_by("-currency_count")
                .first()
            )
            if fallback_currency:
                preferred_currency = fallback_currency.get("currency__code")
                price_stats = (
                    models.ItemPrice.objects.filter(
                        item__status=models.Item.ItemStatus.PUBLISHED,
                        currency__code=preferred_currency,
                    ).aggregate(
                        min_amount=Min("amount"),
                        max_amount=Max("amount"),
                    )
                )

        preferred_currency = preferred_currency or "USD"

        measurement_options = [
            {
                "field": "bust_cm",
                "label": "Bust",
                "unit": "cm",
                "min": float(measurement_ranges["bust_min"]) if measurement_ranges.get("bust_min") is not None else None,
                "max": float(measurement_ranges["bust_max"]) if measurement_ranges.get("bust_max") is not None else None,
            },
            {
                "field": "waist_cm",
                "label": "Waist",
                "unit": "cm",
                "min": float(measurement_ranges["waist_min"]) if measurement_ranges.get("waist_min") is not None else None,
                "max": float(measurement_ranges["waist_max"]) if measurement_ranges.get("waist_max") is not None else None,
            },
            {
                "field": "hip_cm",
                "label": "Hip",
                "unit": "cm",
                "min": float(measurement_ranges["hip_min"]) if measurement_ranges.get("hip_min") is not None else None,
                "max": float(measurement_ranges["hip_max"]) if measurement_ranges.get("hip_max") is not None else None,
            },
            {
                "field": "length_cm",
                "label": "Length",
                "unit": "cm",
                "min": float(measurement_ranges["length_min"]) if measurement_ranges.get("length_min") is not None else None,
                "max": float(measurement_ranges["length_max"]) if measurement_ranges.get("length_max") is not None else None,
            },
        ]

        return {
            "brands": brand_options,
            "categories": category_options,
            "styles": style_options,
            "tags": tag_options,
            "colors": color_options,
            "collections": collection_options,
            "fabrics": fabric_options,
            "features": feature_options,
            "measurements": measurement_options,
            "release_year": {
                "min": release_year_ranges.get("min_year"),
                "max": release_year_ranges.get("max_year"),
            },
            "prices": {
                "currency": preferred_currency,
                "min": float(price_stats["min_amount"]) if price_stats and price_stats.get("min_amount") is not None else None,
                "max": float(price_stats["max_amount"]) if price_stats and price_stats.get("max_amount") is not None else None,
            },
        }

    def _build_active_filters(self, selected: dict[str, Any]) -> list[dict[str, str]]:
        active: list[dict[str, str]] = []

        search_value = selected.get("q")
        if search_value:
            active.append({"label": "Search", "value": cast(str, search_value), "param": "q"})

        for slug in dict.fromkeys(cast(list[str], selected.get("brand") or [])):
            brand = models.Brand.objects.filter(slug=slug).first()
            if brand:
                active.append(
                    {
                        "label": "Brand",
                        "value": brand.display_name(),
                        "param": "brand",
                        "value_key": brand.slug,
                    }
                )

        for category_id in dict.fromkeys(cast(list[str], selected.get("category") or [])):
            category = models.Category.objects.filter(id=category_id).first()
            if category:
                active.append(
                    {
                        "label": "Category",
                        "value": category.name,
                        "param": "category",
                        "value_key": str(category.id),
                    }
                )

        for subcategory_id in dict.fromkeys(cast(list[str], selected.get("subcategory") or [])):
            subcategory = (
                models.Subcategory.objects.select_related("category").filter(id=subcategory_id).first()
            )
            if subcategory:
                value_label = subcategory.name
                if subcategory.category:
                    value_label = f"{subcategory.category.name} › {subcategory.name}"
                active.append(
                    {
                        "label": "Subcategory",
                        "value": value_label,
                        "param": "subcategory",
                        "value_key": str(subcategory.id),
                    }
                )

        for style_slug in dict.fromkeys(cast(list[str], selected.get("style") or [])):
            style = models.Style.objects.filter(slug=style_slug).first()
            if style:
                active.append(
                    {
                        "label": "Style",
                        "value": style.name,
                        "param": "style",
                        "value_key": style.slug,
                    }
                )

        for substyle_slug in dict.fromkeys(cast(list[str], selected.get("substyle") or [])):
            substyle = (
                models.Substyle.objects.select_related("style").filter(slug=substyle_slug).first()
            )
            if substyle:
                value_label = substyle.name
                if substyle.style:
                    value_label = f"{substyle.style.name} › {substyle.name}"
                active.append(
                    {
                        "label": "Substyle",
                        "value": value_label,
                        "param": "substyle",
                        "value_key": substyle.slug,
                    }
                )

        for tag_id in dict.fromkeys(cast(list[str], selected.get("tag") or [])):
            tag = models.Tag.objects.filter(id=tag_id).first()
            if tag:
                active.append(
                    {
                        "label": "Tag",
                        "value": tag.name,
                        "param": "tag",
                        "value_key": str(tag.id),
                    }
                )

        for color_id in dict.fromkeys(cast(list[str], selected.get("color") or [])):
            color = models.Color.objects.filter(id=color_id).first()
            if color:
                active.append(
                    {
                        "label": "Color",
                        "value": color.name,
                        "param": "color",
                        "value_key": str(color.id),
                    }
                )

        for fabric_id in dict.fromkeys(cast(list[str], selected.get("fabric") or [])):
            fabric = models.Fabric.objects.filter(id=fabric_id).first()
            if fabric:
                active.append(
                    {
                        "label": "Fabric",
                        "value": fabric.name,
                        "param": "fabric",
                        "value_key": str(fabric.id),
                    }
                )

        for feature_id in dict.fromkeys(cast(list[str], selected.get("feature") or [])):
            feature = models.Feature.objects.filter(id=feature_id).first()
            if feature:
                active.append(
                    {
                        "label": "Feature",
                        "value": feature.name,
                        "param": "feature",
                        "value_key": str(feature.id),
                    }
                )

        for collection_id in dict.fromkeys(cast(list[str], selected.get("collection") or [])):
            collection = models.Collection.objects.filter(id=collection_id).first()
            if collection:
                display_name = collection.name
                if collection.year:
                    display_name = f"{collection.year} {collection.name}"
                active.append(
                    {
                        "label": "Collection",
                        "value": display_name,
                        "param": "collection",
                        "value_key": str(collection.id),
                    }
                )

        measurement = cast(dict[str, float | None], selected.get("measurement") or {})
        measurement_labels = {
            "bust_min": ("Bust", "measurement_bust_min", "≥"),
            "bust_max": ("Bust", "measurement_bust_max", "≤"),
            "waist_min": ("Waist", "measurement_waist_min", "≥"),
            "waist_max": ("Waist", "measurement_waist_max", "≤"),
            "hip_min": ("Hip", "measurement_hip_min", "≥"),
            "hip_max": ("Hip", "measurement_hip_max", "≤"),
            "length_min": ("Length", "measurement_length_min", "≥"),
            "length_max": ("Length", "measurement_length_max", "≤"),
        }
        for key, (label, param_name, comparator) in measurement_labels.items():
            value = measurement.get(key)
            if value is None:
                continue
            value_str = f"{value:g}"
            active.append(
                {
                    "label": label,
                    "value": f"{comparator} {value_str} cm",
                    "param": param_name,
                    "value_key": value_str,
                }
            )

        for release_range in cast(list[dict[str, Any]], selected.get("release_year_ranges") or []):
            min_year = release_range.get("min")
            max_year = release_range.get("max")
            value_key = release_range.get("value_key")
            if min_year is None and max_year is None:
                continue
            if not isinstance(value_key, str) or not value_key:
                continue
            if min_year is None:
                label_value = f"≤ {max_year}"
            elif max_year is None:
                label_value = f"≥ {min_year}"
            else:
                label_value = f"{min_year}–{max_year}"
            active.append(
                {
                    "label": "Release year",
                    "value": label_value,
                    "param": "release_year_range",
                    "value_key": value_key,
                }
            )

        for price_range in cast(list[dict[str, Any]], selected.get("price_ranges") or []):
            currency = price_range.get("currency")
            min_price = price_range.get("min")
            max_price = price_range.get("max")
            value_key = price_range.get("value_key")
            if not isinstance(currency, str) or not currency:
                continue
            if min_price is None and max_price is None:
                continue
            if not isinstance(value_key, str) or not value_key:
                continue
            if min_price is None:
                label_value = f"≤ {max_price:g} {currency}"
            elif max_price is None:
                label_value = f"≥ {min_price:g} {currency}"
            else:
                label_value = f"{min_price:g}–{max_price:g} {currency}"
            active.append(
                {
                    "label": "Price",
                    "value": label_value,
                    "param": "price_range",
                    "value_key": value_key,
                }
            )

        return active


class ItemFavoriteViewSet(
    mixins.CreateModelMixin,
    mixins.DestroyModelMixin,
    mixins.ListModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = serializers.ItemFavoriteSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None
    lookup_field = "pk"

    def get_queryset(self):  # type: ignore[override]
        request = cast(Request, self.request)
        queryset: QuerySet[models.ItemFavorite] = (
            models.ItemFavorite.objects.select_related("item", "item__brand", "item__category")
            .filter(user=request.user)
            .order_by("-created_at")
        )
        item_param = request.query_params.get("item")
        if item_param:
            slug_filter = Q(item__slug=item_param)
            if _is_uuid_value(item_param):
                queryset = queryset.filter(slug_filter | Q(item__id=item_param))
            else:
                queryset = queryset.filter(slug_filter)
        status_param = request.query_params.get("status")
        if status_param:
            normalized_status = status_param.strip().lower()
            if normalized_status in models.WardrobeEntry.EntryStatus.values:
                queryset = queryset.filter(status=normalized_status)
        return queryset

    def create(self, request, *args, **kwargs):  # type: ignore[override]
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        item = serializer.validated_data["item"]
        favorite, created = models.ItemFavorite.objects.get_or_create(
            user=request.user,
            item=item,
        )
        output = self.get_serializer(favorite)
        return Response(output.data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class WardrobeEntryViewSet(
    mixins.CreateModelMixin,
    mixins.DestroyModelMixin,
    mixins.ListModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = serializers.WardrobeEntrySerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None
    lookup_field = "pk"

    def get_queryset(self):  # type: ignore[override]
        request = cast(Request, self.request)
        queryset: QuerySet[models.WardrobeEntry] = (
            models.WardrobeEntry.objects.select_related("item", "item__brand", "item__category")
            .filter(user=request.user)
            .order_by("-created_at")
        )
        item_param = request.query_params.get("item")
        if item_param:
            slug_filter = Q(item__slug=item_param)
            if _is_uuid_value(item_param):
                queryset = queryset.filter(slug_filter | Q(item__id=item_param))
            else:
                queryset = queryset.filter(slug_filter)
        status_param = request.query_params.get("status")
        if status_param:
            normalized_status = status_param.strip().lower()
            if normalized_status in models.WardrobeEntry.EntryStatus.values:
                queryset = queryset.filter(status=normalized_status)
        return queryset

    def create(self, request, *args, **kwargs):  # type: ignore[override]
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        item = serializer.validated_data["item"]
        mutable_fields = [
            "status",
            "note",
            "is_public",
            "colors",
            "size",
            "acquired_date",
            "arrival_date",
            "source",
            "price_paid",
            "currency",
            "was_gift",
        ]
        defaults = {}
        for field in mutable_fields:
            if field in serializer.validated_data:
                value = serializer.validated_data[field]
                if field == "colors" and value is not None:
                    value = list(value)
                defaults[field] = value
        entry, created = models.WardrobeEntry.objects.update_or_create(
            user=request.user,
            item=item,
            defaults=defaults,
        )
        output = self.get_serializer(entry)
        return Response(output.data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class ItemSubmissionViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = serializers.ItemSubmissionSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None

    def get_queryset(self):  # type: ignore[override]
        request = cast(Request, self.request)
        queryset: QuerySet[models.ItemSubmission] = models.ItemSubmission.objects.select_related(
            "user",
            "linked_item",
        )
        if not request.user.is_staff:
            queryset = queryset.filter(user=request.user)
        return queryset

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def update(self, request, *args, **kwargs):  # type: ignore[override]
        if not request.user.is_staff:
            raise PermissionDenied("Only staff users may modify submissions.")
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):  # type: ignore[override]
        if not request.user.is_staff:
            raise PermissionDenied("Only staff users may modify submissions.")
        return super().partial_update(request, *args, **kwargs)


class SubmissionDraftViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = serializers.ItemSubmissionSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None

    def get_queryset(self):  # type: ignore[override]
        request = cast(Request, self.request)
        return models.ItemSubmission.objects.filter(
            user=request.user,
            status=models.ItemSubmission.SubmissionStatus.DRAFT,
        ).order_by("-updated_at")

    def get_serializer_context(self):  # type: ignore[override]
        context = super().get_serializer_context()
        context["draft_mode"] = True
        return context

    def perform_create(self, serializer):  # type: ignore[override]
        serializer.save(
            user=self.request.user,
            status=models.ItemSubmission.SubmissionStatus.DRAFT,
        )

    def perform_update(self, serializer):  # type: ignore[override]
        instance: models.ItemSubmission = serializer.instance  # type: ignore[assignment]
        if getattr(instance, "user_id", None) != getattr(self.request.user, "id", None):
            raise PermissionDenied("You can only modify your own drafts.")
        if instance.status != models.ItemSubmission.SubmissionStatus.DRAFT:
            raise PermissionDenied("Only drafts may be updated.")
        serializer.save(
            user=self.request.user,
            status=models.ItemSubmission.SubmissionStatus.DRAFT,
        )

    def perform_destroy(self, instance):  # type: ignore[override]
        if getattr(instance, "user_id", None) != getattr(self.request.user, "id", None):
            raise PermissionDenied("You can only delete your own drafts.")
        if instance.status != models.ItemSubmission.SubmissionStatus.DRAFT:
            raise PermissionDenied("Only drafts may be deleted.")
        instance.delete()


class UserSubmissionListView(generics.ListAPIView):
    serializer_class = serializers.UserSubmissionSummarySerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None

    def get_queryset(self):  # type: ignore[override]
        request = cast(Request, self.request)
        queryset: QuerySet[models.ItemSubmission] = models.ItemSubmission.objects.filter(user=request.user).order_by(
            "-updated_at"
        )
        status_param = request.query_params.get("status")
        if status_param:
            statuses = [value.strip() for value in status_param.split(",") if value and value.strip()]
            if statuses:
                queryset = queryset.filter(status__in=statuses)
        return queryset


class PublicUserSubmissionListView(generics.ListAPIView):
    serializer_class = serializers.UserSubmissionSummarySerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = None

    def get_queryset(self):  # type: ignore[override]
        request = cast(Request, self.request)
        username = (self.kwargs.get("username") or "").strip()
        user = get_object_or_404(UserModel, username__iexact=username)
        queryset: QuerySet[models.ItemSubmission] = (
            models.ItemSubmission.objects.filter(user=user, status=models.ItemSubmission.SubmissionStatus.APPROVED)
            .select_related("linked_item")
            .order_by("-updated_at")
        )

        limit = request.query_params.get("limit")
        if limit:
            try:
                queryset = queryset[: max(int(limit), 0)]
            except (TypeError, ValueError):
                pass
        return queryset


class ItemReviewListCreateView(generics.ListCreateAPIView):
    parser_classes = [MultiPartParser, FormParser]
    pagination_class = None

    def get_permissions(self):  # type: ignore[override]
        if self.request.method.upper() == "POST":
            return [permissions.IsAuthenticated()]
        return [permissions.AllowAny()]

    def get_queryset(self):  # type: ignore[override]
        request = cast(Request, self.request)
        item = get_object_or_404(models.Item, slug=self.kwargs.get("slug"))
        queryset = (
            models.ItemReview.objects.filter(item=item, status=models.ItemReview.ModerationStatus.APPROVED)
            .select_related("author", "author__profile")
            .prefetch_related("images")
            .order_by("-created_at")
        )
        limit = request.query_params.get("limit")
        if limit:
            try:
                queryset = queryset[: max(int(limit), 0)]
            except (TypeError, ValueError):
                pass
        return queryset

    def get_serializer_class(self):  # type: ignore[override]
        if self.request.method.upper() == "POST":
            return serializers.ItemReviewCreateSerializer
        return serializers.ItemReviewSerializer

    def create(self, request: Request, *args: Any, **kwargs: Any) -> Response:  # type: ignore[override]
        item = get_object_or_404(models.Item, slug=kwargs.get("slug"))
        if models.ItemReview.objects.filter(author=request.user, status=models.ItemReview.ModerationStatus.PENDING).exists():
            return Response(
                {"detail": "You already have a pending review. Please wait for moderation before submitting another."},
                status=status.HTTP_409_CONFLICT,
            )
        if models.ItemReview.objects.filter(item=item, author=request.user).exists():
            return Response({"detail": "You have already reviewed this item."}, status=status.HTTP_409_CONFLICT)

        files = request.FILES.getlist("images") or request.FILES.getlist("images[]")
        if not files:
            return Response({"detail": "At least one picture is required."}, status=status.HTTP_400_BAD_REQUEST)

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validated = cast(dict[str, Any], serializer.validated_data)
        review = models.ItemReview.objects.create(
            item=item,
            author=request.user,
            recommendation=validated["recommendation"],
            body=validated.get("body", "") or "",
            status=models.ItemReview.ModerationStatus.PENDING,
        )
        for file in files:
            models.ReviewImage.objects.create(
                review=review,
                image_file=file,
                uploaded_by=request.user,
            )
        output = serializers.ItemReviewSerializer(review, context=self.get_serializer_context())
        return Response(output.data, status=status.HTTP_201_CREATED)


class ItemReviewModerateView(generics.UpdateAPIView):
    queryset = models.ItemReview.objects.select_related("author", "item").all()
    serializer_class = serializers.ItemReviewSerializer
    permission_classes = [permissions.IsAdminUser]
    http_method_names = ["patch", "options", "head"]

    def patch(self, request: Request, *args: Any, **kwargs: Any) -> Response:  # type: ignore[override]
        review: models.ItemReview = self.get_object()
        next_status = (request.data.get("status") or "").strip().lower()
        note = (request.data.get("moderation_note") or "").strip()
        if next_status not in {
            models.ItemReview.ModerationStatus.APPROVED,
            models.ItemReview.ModerationStatus.REJECTED,
        }:
            return Response({"detail": "Status must be 'approved' or 'rejected'."}, status=status.HTTP_400_BAD_REQUEST)

        review.status = next_status
        review.moderation_note = note
        review.moderated_by = request.user
        review.moderated_at = timezone.now()
        review.save(update_fields=["status", "moderation_note", "moderated_by", "moderated_at", "updated_at"])
        output = self.get_serializer(review)
        return Response(output.data, status=status.HTTP_200_OK)


class PublicUserReviewListView(generics.ListAPIView):
    serializer_class = serializers.ItemReviewSerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = None

    def get_queryset(self):  # type: ignore[override]
        request = cast(Request, self.request)
        username = (self.kwargs.get("username") or "").strip()
        user = get_object_or_404(UserModel, username__iexact=username)
        queryset = (
            models.ItemReview.objects.filter(author=user, status=models.ItemReview.ModerationStatus.APPROVED)
            .select_related("item", "author", "author__profile")
            .prefetch_related("images")
            .order_by("-created_at")
        )

        limit = request.query_params.get("limit")
        if limit:
            try:
                queryset = queryset[: max(int(limit), 0)]
            except (TypeError, ValueError):
                pass
        return queryset


class MyReviewListView(generics.ListAPIView):
    serializer_class = serializers.MyItemReviewSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None

    def get_queryset(self):  # type: ignore[override]
        request = cast(Request, self.request)
        queryset = (
            models.ItemReview.objects.filter(author=request.user)
            .select_related("item", "author", "author__profile")
            .prefetch_related("images")
            .order_by("-created_at")
        )

        raw_status = (request.query_params.get("status") or "").strip()
        if raw_status:
            statuses = [value.strip().lower() for value in raw_status.split(",") if value and value.strip()]
            allowed = {
                models.ItemReview.ModerationStatus.PENDING,
                models.ItemReview.ModerationStatus.APPROVED,
                models.ItemReview.ModerationStatus.REJECTED,
            }
            filtered = [value for value in statuses if value in allowed]
            if filtered:
                queryset = queryset.filter(status__in=filtered)

        limit = request.query_params.get("limit")
        if limit:
            try:
                queryset = queryset[: max(int(limit), 0)]
            except (TypeError, ValueError):
                pass
        return queryset
