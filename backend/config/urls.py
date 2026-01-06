"""URL configuration for the Jiraibrary backend."""
from __future__ import annotations

from django.conf import settings
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from django.conf.urls.static import static
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
    WardrobeEntryViewSet,
    SubmissionDraftViewSet,
    UserSubmissionListView,
    ImageViewSet,
    ItemViewSet,
    ItemReviewListCreateView,
    ItemReviewModerateView,
    MyReviewListView,
    LanguageViewSet,
    SubcategoryViewSet,
    SubstyleViewSet,
    StyleViewSet,
    TagViewSet,
    PublicUserSubmissionListView,
    PublicUserReviewListView,
)
from users.views import (
    AvatarUploadView,
    CognitoLoginView,
    CurrentUserView,
    GoogleLoginView,
    LoginView,
    LogoutView,
    PublicUserProfileView,
    RegisterView,
)

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
router.register(r"wardrobe", WardrobeEntryViewSet, basename="wardrobe-entry")
router.register(r"item-submissions", ItemSubmissionViewSet, basename="item-submission")
router.register(r"submissions/drafts", SubmissionDraftViewSet, basename="submission-draft")


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
    path("api/auth/cognito/", CognitoLoginView.as_view(), name="api-cognito-login"),
    path("api/auth/register/", RegisterView.as_view(), name="api-register"),
    path("api/auth/logout/", LogoutView.as_view(), name="api-logout"),
    path("api/auth/me/", CurrentUserView.as_view(), name="api-current-user"),
    path("api/auth/avatar/", AvatarUploadView.as_view(), name="api-avatar-upload"),
    path("api/items/<slug:slug>/reviews/", ItemReviewListCreateView.as_view(), name="item-review-list-create"),
    path("api/reviews/<uuid:pk>/moderate/", ItemReviewModerateView.as_view(), name="item-review-moderate"),
    path("api/reviews/mine/", MyReviewListView.as_view(), name="my-review-list"),
    path("api/submissions/mine/", UserSubmissionListView.as_view(), name="user-submissions"),
        path("api/users/<str:username>/", PublicUserProfileView.as_view(), name="public-user-profile"),
        path(
            "api/users/<str:username>/submissions/",
            PublicUserSubmissionListView.as_view(),
            name="public-user-submissions",
        ),
        path(
            "api/users/<str:username>/reviews/",
            PublicUserReviewListView.as_view(),
            name="public-user-reviews",
        ),
    path("api/", include(router.urls)),
]


if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
