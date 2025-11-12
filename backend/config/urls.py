"""URL configuration for the Jiraibrary backend."""
from __future__ import annotations

from django.contrib import admin
from django.http import JsonResponse
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
    ItemFavoriteViewSet,
    ItemSubmissionViewSet,
    ImageViewSet,
    ItemViewSet,
    LanguageViewSet,
    SubcategoryViewSet,
    SubstyleViewSet,
    StyleViewSet,
    TagViewSet,
)
from users.views import CurrentUserView, GoogleLoginView, LoginView, LogoutView, RegisterView

router = DefaultRouter()
router.register(r"brands", BrandViewSet)
router.register(r"categories", CategoryViewSet)
router.register(r"styles", StyleViewSet)
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
router.register(r"item-favorites", ItemFavoriteViewSet, basename="item-favorite")
router.register(r"item-submissions", ItemSubmissionViewSet, basename="item-submission")


def health_check(_request):
    return JsonResponse({"status": "ok"})


urlpatterns = [
    path("admin/", admin.site.urls),
    path("health-check", health_check, name="health-check"),
    path("health-check/", health_check, name="health-check-slash"),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
    path("api/auth/login/", LoginView.as_view(), name="api-login"),
    path("api/auth/google/", GoogleLoginView.as_view(), name="api-google-login"),
    path("api/auth/register/", RegisterView.as_view(), name="api-register"),
    path("api/auth/logout/", LogoutView.as_view(), name="api-logout"),
    path("api/auth/me/", CurrentUserView.as_view(), name="api-current-user"),
    path("api/", include(router.urls)),
]
