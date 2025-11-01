"""Viewsets powering the public catalog API."""
from __future__ import annotations

from typing import Any, cast

from django.db.models import Count, Prefetch, Q, QuerySet
from rest_framework import mixins, permissions, status, viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.request import Request

from . import filters, models, serializers


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


class ImageViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = models.Image.objects.select_related("item", "brand", "variant").all()
    serializer_class = serializers.ImageSerializer
    filterset_fields = ["item__slug", "brand__slug", "type", "is_cover"]
    search_fields = ["storage_path", "caption"]


class LanguageViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = models.Language.objects.all().order_by("code")
    serializer_class = serializers.LanguageSerializer
    lookup_field = "code"


class CurrencyViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = models.Currency.objects.all().order_by("code")
    serializer_class = serializers.CurrencySerializer
    lookup_field = "code"


class ItemViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = (
        models.Item.objects.select_related(
            "brand",
            "category",
            "subcategory",
            "default_language",
            "default_currency",
            "submitted_by",
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

    def get_serializer_class(self):  # type: ignore[override]
        if self.action == "retrieve":
            return serializers.ItemDetailSerializer
        return serializers.ItemSummarySerializer

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

    def _extract_selected_filters(self, request) -> dict[str, str | None]:
        def normalize(value: str | None) -> str | None:
            if value is None or value == "":
                return None
            return value

        return {
            "q": normalize(request.query_params.get("q")),
            "brand": normalize(request.query_params.get("brand")),
            "category": normalize(request.query_params.get("category")),
            "style": normalize(request.query_params.get("style")),
            "tag": normalize(request.query_params.get("tag")),
            "color": normalize(request.query_params.get("color")),
            "collection": normalize(request.query_params.get("collection")),
        }

    def _build_filters_payload(self, selected: dict[str, str | None]) -> dict[str, list[dict[str, Any]]]:
        published_filter = Q(items__status=models.Item.ItemStatus.PUBLISHED)
        style_published_filter = Q(substyles__items__status=models.Item.ItemStatus.PUBLISHED)

        brand_options: list[dict[str, Any]] = []
        for brand in (
            models.Brand.objects.annotate(
                item_count=Count("items", filter=published_filter, distinct=True)
            )
            .filter(item_count__gt=0)
            .order_by("-item_count", "slug")[:24]
        ):
            item_count = int(getattr(brand, "item_count", 0) or 0)
            brand_options.append(
                {
                    "slug": brand.slug,
                    "name": brand.display_name(),
                    "selected": brand.slug == selected.get("brand"),
                    "item_count": item_count,
                    "country": brand.country,
                }
            )
        brand_value = selected.get("brand")
        if brand_value and all(option["slug"] != brand_value for option in brand_options):
            extra_brand = (
                models.Brand.objects.annotate(
                    item_count=Count("items", filter=published_filter, distinct=True)
                )
                .filter(slug=brand_value)
                .first()
            )
            if extra_brand and getattr(extra_brand, "item_count", 0):
                brand_options.append(
                    {
                        "slug": extra_brand.slug,
                        "name": extra_brand.display_name(),
                        "selected": True,
                        "item_count": int(getattr(extra_brand, "item_count", 0) or 0),
                        "country": extra_brand.country,
                    }
                )
        brand_options.sort(key=lambda option: (-int(option["item_count"]), str(option["slug"])))

        category_options: list[dict[str, Any]] = []
        for category in (
            models.Category.objects.annotate(
                item_count=Count("items", filter=published_filter, distinct=True)
            )
            .filter(item_count__gt=0)
            .order_by("name")[:24]
        ):
            item_count = int(getattr(category, "item_count", 0) or 0)
            category_options.append(
                {
                    "id": str(category.id),
                    "name": category.name,
                    "selected": str(category.id) == (selected.get("category") or ""),
                    "item_count": item_count,
                }
            )
        category_value = selected.get("category")
        if category_value and all(option["id"] != category_value for option in category_options):
            extra_category = (
                models.Category.objects.annotate(
                    item_count=Count("items", filter=published_filter, distinct=True)
                )
                .filter(id=category_value)
                .first()
            )
            if extra_category and getattr(extra_category, "item_count", 0):
                category_options.append(
                    {
                        "id": str(extra_category.id),
                        "name": extra_category.name,
                        "selected": True,
                        "item_count": int(getattr(extra_category, "item_count", 0) or 0),
                    }
                )
        category_options.sort(key=lambda option: str(option["name"]))

        style_options: list[dict[str, Any]] = []
        for style in (
            models.Style.objects.annotate(
                item_count=Count("substyles__items", filter=style_published_filter, distinct=True)
            )
            .filter(item_count__gt=0)
            .order_by("name")[:24]
        ):
            item_count = int(getattr(style, "item_count", 0) or 0)
            style_options.append(
                {
                    "slug": style.slug,
                    "name": style.name,
                    "selected": style.slug == selected.get("style"),
                    "item_count": item_count,
                }
            )
        style_value = selected.get("style")
        if style_value and all(option["slug"] != style_value for option in style_options):
            extra_style = (
                models.Style.objects.annotate(
                    item_count=Count("substyles__items", filter=style_published_filter, distinct=True)
                )
                .filter(slug=style_value)
                .first()
            )
            if extra_style and getattr(extra_style, "item_count", 0):
                style_options.append(
                    {
                        "slug": extra_style.slug,
                        "name": extra_style.name,
                        "selected": True,
                        "item_count": int(getattr(extra_style, "item_count", 0) or 0),
                    }
                )
        style_options.sort(key=lambda option: str(option["name"]))

        tag_options: list[dict[str, Any]] = []
        for tag in (
            models.Tag.objects.annotate(
                item_count=Count("items", filter=published_filter, distinct=True)
            )
            .filter(item_count__gt=0)
            .order_by("-item_count", "name")[:30]
        ):
            item_count = int(getattr(tag, "item_count", 0) or 0)
            tag_options.append(
                {
                    "id": str(tag.id),
                    "name": tag.name,
                    "selected": str(tag.id) == (selected.get("tag") or ""),
                    "type": tag.type,
                    "item_count": item_count,
                }
            )
        tag_value = selected.get("tag")
        if tag_value and all(option["id"] != tag_value for option in tag_options):
            extra_tag = (
                models.Tag.objects.annotate(
                    item_count=Count("items", filter=published_filter, distinct=True)
                )
                .filter(id=tag_value)
                .first()
            )
            if extra_tag and getattr(extra_tag, "item_count", 0):
                tag_options.append(
                    {
                        "id": str(extra_tag.id),
                        "name": extra_tag.name,
                        "selected": True,
                        "type": extra_tag.type,
                        "item_count": int(getattr(extra_tag, "item_count", 0) or 0),
                    }
                )
        tag_options.sort(key=lambda option: (-int(option["item_count"]), str(option["name"])))

        color_options: list[dict[str, Any]] = []
        for color in (
            models.Color.objects.annotate(
                item_count=Count("items", filter=published_filter, distinct=True)
            )
            .filter(item_count__gt=0)
            .order_by("-item_count", "name")[:24]
        ):
            item_count = int(getattr(color, "item_count", 0) or 0)
            color_options.append(
                {
                    "id": str(color.id),
                    "name": color.name,
                    "selected": str(color.id) == (selected.get("color") or ""),
                    "hex": color.hex_code,
                    "item_count": item_count,
                }
            )
        color_value = selected.get("color")
        if color_value and all(option["id"] != color_value for option in color_options):
            extra_color = (
                models.Color.objects.annotate(
                    item_count=Count("items", filter=published_filter, distinct=True)
                )
                .filter(id=color_value)
                .first()
            )
            if extra_color and getattr(extra_color, "item_count", 0):
                color_options.append(
                    {
                        "id": str(extra_color.id),
                        "name": extra_color.name,
                        "selected": True,
                        "hex": extra_color.hex_code,
                        "item_count": int(getattr(extra_color, "item_count", 0) or 0),
                    }
                )
        color_options.sort(key=lambda option: (-int(option["item_count"]), str(option["name"])))

        collection_options: list[dict[str, Any]] = [
            {
                "id": str(collection.id),
                "name": collection.name,
                "brand_slug": collection.brand.slug if collection.brand else None,
                "year": collection.year,
                "selected": str(collection.id) == (selected.get("collection") or ""),
            }
            for collection in models.Collection.objects.annotate(
                item_count=Count("items", filter=published_filter, distinct=True)
            )
            .filter(item_count__gt=0)
            .order_by("-year", "name")[:24]
        ]
        collection_value = selected.get("collection")
        if collection_value and all(option["id"] != collection_value for option in collection_options):
            extra_collection = (
                models.Collection.objects.annotate(
                    item_count=Count("items", filter=published_filter, distinct=True)
                )
                .filter(id=collection_value)
                .first()
            )
            if extra_collection and getattr(extra_collection, "item_count", 0):
                collection_options.append(
                    {
                        "id": str(extra_collection.id),
                        "name": extra_collection.name,
                        "brand_slug": extra_collection.brand.slug if extra_collection.brand else None,
                        "year": extra_collection.year,
                        "selected": True,
                    }
                )
        collection_options.sort(
            key=lambda option: (
                -int(option["year"]) if option["year"] is not None else 0,
                str(option["name"]),
            )
        )

        return {
            "brands": brand_options,
            "categories": category_options,
            "styles": style_options,
            "tags": tag_options,
            "colors": color_options,
            "collections": collection_options,
        }

    def _build_active_filters(self, selected: dict[str, str | None]) -> list[dict[str, str]]:
        active: list[dict[str, str]] = []

        if selected.get("q"):
            active.append({"label": "Search", "value": selected["q"] or "", "param": "q"})

        if selected.get("brand"):
            brand = models.Brand.objects.filter(slug=selected["brand"]).first()
            if brand:
                active.append(
                    {"label": "Brand", "value": brand.display_name(), "param": "brand"}
                )

        if selected.get("category"):
            category = models.Category.objects.filter(id=selected["category"]).first()
            if category:
                active.append(
                    {"label": "Category", "value": category.name, "param": "category"}
                )

        if selected.get("tag"):
            tag = models.Tag.objects.filter(id=selected["tag"]).first()
            if tag:
                active.append({"label": "Tag", "value": tag.name, "param": "tag"})

        if selected.get("style"):
            style = models.Style.objects.filter(slug=selected["style"]).first()
            if style:
                active.append({"label": "Style", "value": style.name, "param": "style"})

        if selected.get("color"):
            color = models.Color.objects.filter(id=selected["color"]).first()
            if color:
                active.append({"label": "Color", "value": color.name, "param": "color"})

        if selected.get("collection"):
            collection = models.Collection.objects.filter(id=selected["collection"]).first()
            if collection:
                label = f"{collection.name}"
                if collection.year:
                    label = f"{collection.year} {label}".strip()
                active.append(
                    {"label": "Collection", "value": label, "param": "collection"}
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
            queryset = queryset.filter(Q(item__slug=item_param) | Q(item__id=item_param))
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


class ItemSubmissionViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = serializers.ItemSubmissionSerializer
    permission_classes = [permissions.IsAuthenticated]

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
