"""Authentication endpoints for the Jiraibrary API."""
from __future__ import annotations

from datetime import timedelta
import logging
from typing import Any, cast
import uuid

from django.conf import settings
from django.db import transaction
from django.core.files.storage import default_storage
from django.utils import timezone
from django.utils.crypto import get_random_string
from django.utils.text import slugify
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
import jwt
from rest_framework import permissions, status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.authtoken.models import Token
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import User, UserProfile
from .serializers import (
    LoginSerializer,
    PublicUserSerializer,
    RegisterSerializer,
    UserAccountUpdateSerializer,
    UserPreferenceSerializer,
    UserSerializer,
)


logger = logging.getLogger(__name__)


def _claim_is_true(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"true", "1", "yes"}
    if isinstance(value, int):
        return value == 1
    return False


def _cognito_claims_are_federated(claims: dict[str, Any]) -> bool:
    cognito_username = str(claims.get("cognito:username") or "")
    if "_" in cognito_username:
        provider_prefix = cognito_username.split("_", 1)[0].strip().lower()
        if provider_prefix in {"google", "facebook", "apple", "amazon", "loginwithamazon"}:
            return True

    identities = claims.get("identities")
    if not identities:
        return False

    # Cognito can serialize identities as a JSON string; treat any presence as federated.
    if isinstance(identities, (list, tuple)):
        return len(identities) > 0
    if isinstance(identities, str) and identities.strip():
        return True
    return False


def _generate_username(email: str, subject: str) -> str:
    local_part = email.split("@", 1)[0]
    base = slugify(local_part) or f"user-{subject[:8]}"
    candidate = base[:150] or f"user-{get_random_string(8).lower()}"
    attempts = 0

    while User.objects.filter(username=candidate).exists():
        suffix = get_random_string(6).lower()
        trimmed_base = base[: max(0, 150 - len(suffix) - 1)] or base
        candidate = f"{trimmed_base}-{suffix}"
        attempts += 1
        if attempts > 10:
            candidate = f"user-{get_random_string(10).lower()}"
            break

    return candidate[:150]


def _update_profile_from_google(user: User, *, full_name: str | None, avatar_url: str | None) -> None:
    profile, _ = UserProfile.objects.get_or_create(user=user)
    dirty = False

    if profile.auth_provider != "google":
        profile.auth_provider = "google"
        dirty = True

    if full_name and profile.display_name != full_name:
        profile.display_name = full_name
        dirty = True

    if avatar_url and profile.avatar_url != avatar_url:
        profile.avatar_url = avatar_url
        dirty = True

    if dirty:
        profile.save(update_fields=["auth_provider", "display_name", "avatar_url", "updated_at"])


def _update_profile_from_cognito(user: User, *, full_name: str | None, avatar_url: str | None = None) -> None:
    profile, _ = UserProfile.objects.get_or_create(user=user)
    dirty = False

    if profile.auth_provider != "cognito":
        profile.auth_provider = "cognito"
        dirty = True

    if full_name and profile.display_name != full_name:
        profile.display_name = full_name
        dirty = True

    if avatar_url and profile.avatar_url != avatar_url:
        profile.avatar_url = avatar_url
        dirty = True

    if dirty:
        profile.save(update_fields=["auth_provider", "display_name", "avatar_url", "updated_at"])


def _verify_cognito_id_token(id_token: str) -> dict[str, Any]:
    region = getattr(settings, "COGNITO_REGION", "")
    user_pool_id = getattr(settings, "COGNITO_USER_POOL_ID", "")
    client_id = getattr(settings, "COGNITO_APP_CLIENT_ID", "")
    if not region or not user_pool_id or not client_id:
        raise ValueError("Cognito settings are not configured.")

    issuer = f"https://cognito-idp.{region}.amazonaws.com/{user_pool_id}"
    jwks_url = f"{issuer}/.well-known/jwks.json"

    jwk_client = jwt.PyJWKClient(jwks_url)
    signing_key = jwk_client.get_signing_key_from_jwt(id_token)

    decoded = jwt.decode(
        id_token,
        signing_key.key,
        algorithms=["RS256"],
        audience=client_id,
        issuer=issuer,
        leeway=120,
    )

    token_use = decoded.get("token_use")
    if token_use != "id":
        raise ValueError("Unexpected Cognito token_use.")

    return cast(dict[str, Any], decoded)


class LoginView(APIView):
    """Issue or reuse a DRF auth token for a validated user."""

    permission_classes = [permissions.AllowAny]
    serializer_class = LoginSerializer

    def post(self, request, *args, **kwargs):  # type: ignore[override]
        serializer = self.serializer_class(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        validated_data = cast(dict[str, Any], serializer.validated_data)
        user = validated_data["user"]
        token, _ = Token.objects.get_or_create(user=user)
        payload = {
            "token": token.key,
            "user": UserSerializer(user, context={"request": request}).data,
        }
        return Response(payload)


class LogoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):  # type: ignore[override]
        Token.objects.filter(user=request.user).delete()
        return Response(status=204)


class CurrentUserView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):  # type: ignore[override]
        serializer = UserSerializer(request.user, context={"request": request})
        return Response(serializer.data)

    def patch(self, request, *args, **kwargs):  # type: ignore[override]
        if "email" in request.data:
            return Response(
                {"detail": "Email cannot be changed."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = UserAccountUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        validated = serializer.validated_data
        update_fields: list[str] = []
        user_update_fields: list[str] = []

        if "display_name" in validated:
            profile.display_name = (validated.get("display_name") or "").strip()
            update_fields.append("display_name")

        if "pronouns" in validated:
            profile.pronouns = (validated.get("pronouns") or "").strip()
            update_fields.append("pronouns")

        if "bio" in validated:
            profile.bio = validated.get("bio") or ""
            update_fields.append("bio")

        if "location" in validated:
            profile.location = (validated.get("location") or "").strip()
            update_fields.append("location")

        if "website" in validated:
            profile.website = validated.get("website") or ""
            update_fields.append("website")

        if "username" in validated:
            desired_username = cast(str, validated.get("username") or "").strip()
            if desired_username and desired_username != request.user.username:
                if User.objects.filter(username__iexact=desired_username).exclude(pk=request.user.pk).exists():
                    return Response(
                        {"detail": "That username is already taken."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                now = timezone.now()
                last_change = profile.username_changed_at
                if last_change and now < last_change + timedelta(days=30):
                    return Response(
                        {"detail": "Username can only be changed once every 30 days."},
                        status=status.HTTP_429_TOO_MANY_REQUESTS,
                    )

                request.user.username = desired_username
                user_update_fields.append("username")
                profile.username_changed_at = now
                update_fields.append("username_changed_at")

        if "preferred_language" in validated:
            language = validated.get("preferred_language") or ""
            profile.preferred_languages = [language] if language else []
            update_fields.append("preferred_languages")

        if "preferred_currency" in validated:
            profile.preferred_currency = validated.get("preferred_currency") or ""
            update_fields.append("preferred_currency")

        if update_fields:
            update_fields.append("updated_at")
            profile.save(update_fields=update_fields)

        if "share_owned_public" in validated:
            request.user.share_owned_public = bool(validated.get("share_owned_public"))
            user_update_fields.append("share_owned_public")

        if "share_wishlist_public" in validated:
            request.user.share_wishlist_public = bool(validated.get("share_wishlist_public"))
            user_update_fields.append("share_wishlist_public")

        if user_update_fields:
            request.user.save(update_fields=user_update_fields)

        response_data = UserSerializer(request.user, context={"request": request}).data
        return Response(response_data)


class PublicUserProfileView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, *args, **kwargs):  # type: ignore[override]
        username = (kwargs.get("username") or "").strip()
        user = User.objects.select_related("profile").filter(username__iexact=username).first()
        if not user:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = PublicUserSerializer(user, context={"request": request})
        return Response(serializer.data)


class AvatarUploadView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, *args, **kwargs):  # type: ignore[override]
        upload = request.FILES.get("avatar") or request.FILES.get("file")
        if not upload:
            return Response({"detail": "Missing avatar file."}, status=status.HTTP_400_BAD_REQUEST)

        content_type = getattr(upload, "content_type", "") or ""
        if not content_type.startswith("image/"):
            return Response({"detail": "Avatar must be an image."}, status=status.HTTP_400_BAD_REQUEST)

        max_bytes = 5 * 1024 * 1024
        if getattr(upload, "size", 0) and upload.size > max_bytes:
            return Response({"detail": "Avatar file is too large (max 5MB)."}, status=status.HTTP_400_BAD_REQUEST)

        ext = ""
        original_name = getattr(upload, "name", "") or ""
        if "." in original_name:
            ext = f".{original_name.rsplit('.', 1)[-1].lower()}"
        if ext and len(ext) > 10:
            ext = ""

        key = uuid.uuid4().hex
        storage_path = f"avatars/{request.user.pk}/{key}{ext}"
        saved_path = default_storage.save(storage_path, upload)
        stored_url = default_storage.url(saved_path)
        absolute_url = request.build_absolute_uri(stored_url)

        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        profile.avatar_url = absolute_url
        profile.save(update_fields=["avatar_url", "updated_at"])

        return Response(UserSerializer(request.user, context={"request": request}).data)

    def delete(self, request, *args, **kwargs):  # type: ignore[override]
        """Delete the authenticated user's account.

        This deletes the user record and cascades to the profile and auth token.
        Related records follow their FK on_delete behavior (cascade or set null).
        """

        with transaction.atomic():
            Token.objects.filter(user=request.user).delete()
            request.user.delete()

        return Response(status=status.HTTP_204_NO_CONTENT)


class GoogleLoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):  # type: ignore[override]
        id_token = request.data.get("id_token")
        if not id_token:
            return Response({"detail": "Missing Google ID token."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            id_info = google_id_token.verify_oauth2_token(id_token, google_requests.Request())
        except ValueError as exc:  # pragma: no cover - defensive branch
            logger.warning("Failed to verify Google ID token: %s", exc)
            return Response({"detail": "Invalid Google ID token."}, status=status.HTTP_400_BAD_REQUEST)

        issuer = id_info.get("iss")
        if issuer not in {"accounts.google.com", "https://accounts.google.com"}:
            logger.warning("Unexpected Google token issuer: %s", issuer)
            return Response({"detail": "Unrecognized Google token issuer."}, status=status.HTTP_400_BAD_REQUEST)

        allowed_audiences = getattr(settings, "GOOGLE_OAUTH_CLIENT_IDS", [])
        audience = id_info.get("aud")
        if allowed_audiences and audience not in allowed_audiences:
            logger.warning("Google token audience %s not in allowed list.", audience)
            return Response({"detail": "Google token audience mismatch."}, status=status.HTTP_400_BAD_REQUEST)

        email = id_info.get("email")
        email_verified = id_info.get("email_verified", False)
        if not email or not email_verified:
            return Response({"detail": "Google account email is not verified."}, status=status.HTTP_400_BAD_REQUEST)

        given_name = id_info.get("given_name") or ""
        family_name = id_info.get("family_name") or ""
        full_name = id_info.get("name")
        avatar_url = id_info.get("picture")
        subject = id_info.get("sub", "")

        with transaction.atomic():
            user, created = User.objects.get_or_create(
                email=email,
                defaults={
                    "username": _generate_username(email, subject),
                },
            )

            updated_fields: list[str] = []

            if created:
                user.first_name = given_name
                user.last_name = family_name
                user.set_unusable_password()
                updated_fields.extend(["first_name", "last_name", "password"])
            else:
                if given_name and not user.first_name:
                    user.first_name = given_name
                    updated_fields.append("first_name")
                if family_name and not user.last_name:
                    user.last_name = family_name
                    updated_fields.append("last_name")

            if updated_fields:
                user.save(update_fields=updated_fields)

            _update_profile_from_google(user, full_name=full_name, avatar_url=avatar_url)

        token, _ = Token.objects.get_or_create(user=user)
        payload = {
            "token": token.key,
            "user": UserSerializer(user, context={"request": request}).data,
        }
        return Response(payload, status=status.HTTP_200_OK)


class CognitoLoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):  # type: ignore[override]
        id_token = request.data.get("id_token")
        if not id_token:
            return Response({"detail": "Missing Cognito ID token."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            claims = _verify_cognito_id_token(id_token)
        except Exception as exc:
            logger.warning("Failed to verify Cognito ID token: %s", exc)
            if getattr(settings, "DEBUG", False):
                return Response(
                    {"detail": "Invalid Cognito ID token.", "reason": str(exc)},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            return Response({"detail": "Invalid Cognito ID token."}, status=status.HTTP_400_BAD_REQUEST)

        email = claims.get("email")
        email_verified = _claim_is_true(claims.get("email_verified"))
        is_federated = _cognito_claims_are_federated(claims)
        if not email:
            return Response({"detail": "Missing email for Cognito account."}, status=status.HTTP_400_BAD_REQUEST)
        if not email_verified and not is_federated:
            return Response({"detail": "Cognito account email is not verified."}, status=status.HTTP_400_BAD_REQUEST)

        subject = claims.get("sub", "")
        given_name = claims.get("given_name") or ""
        family_name = claims.get("family_name") or ""
        full_name = claims.get("name")
        avatar_url = claims.get("picture") or claims.get("avatar_url")

        with transaction.atomic():
            user, created = User.objects.get_or_create(
                email=email,
                defaults={
                    "username": _generate_username(email, subject or email),
                },
            )

            updated_fields: list[str] = []

            if created:
                user.first_name = given_name
                user.last_name = family_name
                user.set_unusable_password()
                updated_fields.extend(["first_name", "last_name", "password"])
            else:
                if given_name and not user.first_name:
                    user.first_name = given_name
                    updated_fields.append("first_name")
                if family_name and not user.last_name:
                    user.last_name = family_name
                    updated_fields.append("last_name")

            if updated_fields:
                user.save(update_fields=updated_fields)

            _update_profile_from_cognito(user, full_name=full_name, avatar_url=avatar_url)

        # Reload so response includes fresh profile fields (e.g. avatar_url).
        user = User.objects.select_related("profile", "role").get(pk=user.pk)

        token, _ = Token.objects.get_or_create(user=user)
        payload = {
            "token": token.key,
            "user": UserSerializer(user, context={"request": request}).data,
        }
        return Response(payload, status=status.HTTP_200_OK)


class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):  # type: ignore[override]
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            user = serializer.save()
            profile = cast(UserProfile | None, getattr(user, "profile", None))
            if profile and not profile.display_name:
                profile.display_name = user.username
                if not profile.auth_provider:
                    profile.auth_provider = "password"
                profile.save(update_fields=["display_name", "auth_provider", "updated_at"])

        token, _ = Token.objects.get_or_create(user=user)
        payload = {
            "token": token.key,
            "user": UserSerializer(user, context={"request": request}).data,
        }
        return Response(payload, status=status.HTTP_201_CREATED)
