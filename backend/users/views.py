"""Authentication endpoints for the Jiraibrary API."""
from __future__ import annotations

import logging
from typing import Any, cast

from django.conf import settings
from django.db import transaction
from django.utils.crypto import get_random_string
from django.utils.text import slugify
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from rest_framework import permissions, status
from rest_framework.authtoken.models import Token
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import User, UserProfile
from .serializers import LoginSerializer, RegisterSerializer, UserSerializer


logger = logging.getLogger(__name__)


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

    if full_name and profile.display_name != full_name:
        profile.display_name = full_name
        dirty = True

    if avatar_url and profile.avatar_url != avatar_url:
        profile.avatar_url = avatar_url
        dirty = True

    if dirty:
        profile.save(update_fields=["display_name", "avatar_url", "updated_at"])


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
                profile.save(update_fields=["display_name", "updated_at"])

        token, _ = Token.objects.get_or_create(user=user)
        payload = {
            "token": token.key,
            "user": UserSerializer(user, context={"request": request}).data,
        }
        return Response(payload, status=status.HTTP_201_CREATED)
