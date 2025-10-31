"""URL configuration for the Jiraibrary backend."""
from __future__ import annotations

from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.routers import DefaultRouter

from catalog.views import (  # type: ignore[F401]
    BrandViewSet,
    CategoryViewSet,
    CollectionViewSet,
    ColorViewSet,
    CurrencyViewSet,
    FabricViewSet,
    FeatureViewSet,
    ImageViewSet,
    ItemViewSet,
    LanguageViewSet,
    SubcategoryViewSet,
    SubstyleViewSet,
    TagViewSet,
)

router = DefaultRouter()
router.register(r"brands", BrandViewSet)
router.register(r"categories", CategoryViewSet)
router.register(r"subcategories", SubcategoryViewSet)
router.register(r"substyles", SubstyleViewSet)
router.register(r"tags", TagViewSet)
router.register(r"collections", CollectionViewSet)
router.register(r"items", ItemViewSet, basename="item")
router.register(r"colors", ColorViewSet)
router.register(r"fabrics", FabricViewSet)
router.register(r"features", FeatureViewSet)
router.register(r"images", ImageViewSet)
router.register(r"languages", LanguageViewSet)
router.register(r"currencies", CurrencyViewSet)


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
    path("api/", include(router.urls)),
]
