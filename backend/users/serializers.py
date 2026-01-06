"""Serializers for user authentication endpoints."""
from __future__ import annotations

from django.contrib.auth import authenticate
from django.contrib.auth.validators import UnicodeUsernameValidator
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers

from catalog import models as catalog_models

from . import models


class UserSerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()
    role = serializers.SerializerMethodField()
    avatar_url = serializers.SerializerMethodField()
    pronouns = serializers.SerializerMethodField()
    bio = serializers.SerializerMethodField()
    location = serializers.SerializerMethodField()
    website = serializers.SerializerMethodField()
    preferred_language = serializers.SerializerMethodField()
    preferred_currency = serializers.SerializerMethodField()
    auth_provider = serializers.SerializerMethodField()

    class Meta:
        model = models.User
        fields = [
            "id",
            "username",
            "email",
            "is_staff",
            "is_superuser",
            "display_name",
            "role",
            "avatar_url",
            "pronouns",
            "bio",
            "location",
            "website",
            "preferred_language",
            "preferred_currency",
            "share_owned_public",
            "share_wishlist_public",
            "auth_provider",
        ]
        read_only_fields = fields

    def get_display_name(self, obj: models.User) -> str:
        profile = getattr(obj, "profile", None)
        if profile and profile.display_name:
            return profile.display_name
        return obj.username

    def get_role(self, obj: models.User) -> dict | None:
        role = getattr(obj, "role", None)
        if not role:
            return None
        return {
            "name": role.name,
            "scopes": role.scopes or [],
        }

    def get_avatar_url(self, obj: models.User) -> str | None:
        profile = getattr(obj, "profile", None)
        if not profile:
            return None
        return profile.avatar_url or None

    def get_pronouns(self, obj: models.User) -> str | None:
        profile = getattr(obj, "profile", None)
        if not profile:
            return None
        return profile.pronouns or None

    def get_bio(self, obj: models.User) -> str | None:
        profile = getattr(obj, "profile", None)
        if not profile:
            return None
        return profile.bio.strip() or None

    def get_location(self, obj: models.User) -> str | None:
        profile = getattr(obj, "profile", None)
        if not profile:
            return None
        return profile.location.strip() or None

    def get_website(self, obj: models.User) -> str | None:
        profile = getattr(obj, "profile", None)
        if not profile:
            return None
        return profile.website.strip() or None

    def get_preferred_language(self, obj: models.User) -> str | None:
        profile = getattr(obj, "profile", None)
        if not profile or not profile.preferred_languages:
            return None
        return profile.preferred_languages[0]

    def get_preferred_currency(self, obj: models.User) -> str | None:
        profile = getattr(obj, "profile", None)
        if not profile or not profile.preferred_currency:
            return None
        return profile.preferred_currency

    def get_auth_provider(self, obj: models.User) -> str:
        profile = getattr(obj, "profile", None)
        if profile and getattr(profile, "auth_provider", "") in {"password", "google", "cognito"}:
            return profile.auth_provider
        if not obj.has_usable_password():
            return "google"
        return "password"


class PublicUserSerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()
    avatar_url = serializers.SerializerMethodField()
    pronouns = serializers.SerializerMethodField()
    bio = serializers.SerializerMethodField()
    location = serializers.SerializerMethodField()
    website = serializers.SerializerMethodField()
    share_owned_public = serializers.BooleanField(read_only=True)
    share_wishlist_public = serializers.BooleanField(read_only=True)

    class Meta:
        model = models.User
        fields = [
            "username",
            "display_name",
            "avatar_url",
            "pronouns",
            "bio",
            "location",
            "website",
            "share_owned_public",
            "share_wishlist_public",
        ]
        read_only_fields = fields

    def _profile_value(self, obj: models.User, field: str) -> str | None:
        profile = getattr(obj, "profile", None)
        if not profile:
            return None
        value = getattr(profile, field, None)
        if isinstance(value, str) and value.strip():
            return value.strip()
        return None

    def get_display_name(self, obj: models.User) -> str:
        return self._profile_value(obj, "display_name") or obj.username

    def get_avatar_url(self, obj: models.User) -> str | None:
        return self._profile_value(obj, "avatar_url")

    def get_pronouns(self, obj: models.User) -> str | None:
        return self._profile_value(obj, "pronouns")

    def get_bio(self, obj: models.User) -> str | None:
        return self._profile_value(obj, "bio")

    def get_location(self, obj: models.User) -> str | None:
        return self._profile_value(obj, "location")

    def get_website(self, obj: models.User) -> str | None:
        return self._profile_value(obj, "website")


class UserPreferenceSerializer(serializers.Serializer):
    preferred_language = serializers.CharField(max_length=10, required=False, allow_blank=True)
    preferred_currency = serializers.CharField(max_length=3, required=False, allow_blank=True)
    share_owned_public = serializers.BooleanField(required=False)
    share_wishlist_public = serializers.BooleanField(required=False)

    def validate_preferred_language(self, value: str) -> str:
        normalized = value.strip().lower()
        if normalized and not catalog_models.Language.objects.filter(code__iexact=normalized).exists():
            raise serializers.ValidationError("Unknown language code.")
        return normalized

    def validate_preferred_currency(self, value: str) -> str:
        normalized = value.strip().upper()
        if normalized and not catalog_models.Currency.objects.filter(code__iexact=normalized).exists():
            raise serializers.ValidationError("Unknown currency code.")
        return normalized


class UserAccountUpdateSerializer(UserPreferenceSerializer):
    """Updates the authenticated user's account settings.

    - `display_name` is stored on UserProfile (duplicates allowed).
    - `username` is stored on User (must be unique, enforced in the view).
    """

    username = serializers.CharField(max_length=150, required=False)
    display_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    pronouns = serializers.CharField(max_length=64, required=False, allow_blank=True)
    bio = serializers.CharField(required=False, allow_blank=True)
    location = serializers.CharField(max_length=128, required=False, allow_blank=True)
    website = serializers.CharField(required=False, allow_blank=True)

    def validate_website(self, value: str) -> str:
        normalized = (value or "").strip()
        if not normalized:
            return ""

        if not normalized.lower().startswith(("http://", "https://")):
            normalized = f"https://{normalized}"

        url_field = serializers.URLField()
        return url_field.run_validation(normalized)

    def validate_username(self, value: str) -> str:
        normalized = value.strip()
        if normalized.startswith("@"):  # allow UI-style @username input
            normalized = normalized[1:].strip()

        if not normalized:
            raise serializers.ValidationError("Username cannot be blank.")

        UnicodeUsernameValidator()(normalized)
        return normalized


class LoginSerializer(serializers.Serializer):
    identifier = serializers.CharField(label=_("Username or email"), required=False)
    username = serializers.CharField(write_only=True, required=False)
    password = serializers.CharField(style={"input_type": "password"})

    default_error_messages = {
        "invalid_credentials": _("Unable to log in with the provided credentials."),
    }

    def validate(self, attrs: dict) -> dict:
        identifier = attrs.get("identifier") or attrs.get("username")
        password = attrs.get("password")

        if not identifier or not password:
            raise serializers.ValidationError({
                "identifier": _("This field is required."),
                "password": _("This field is required."),
            })

        request = self.context.get("request")
        user = authenticate(request=request, username=identifier, password=password)

        if user is None:
            # Attempt to resolve the identifier as an email address.
            email_match = models.User.objects.filter(email__iexact=identifier).first()
            if email_match:
                user = authenticate(
                    request=request,
                    username=email_match.get_username(),
                    password=password,
                )

        if user is None:
            raise serializers.ValidationError(self.error_messages["invalid_credentials"], code="authorization")

        attrs["user"] = user
        return attrs


class RegisterSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(min_length=8, write_only=True, style={"input_type": "password"})
    display_name = serializers.CharField(max_length=150, required=False, allow_blank=True)

    def validate_username(self, value: str) -> str:
        if models.User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError(_("A user with that username already exists."))
        return value

    def validate_email(self, value: str) -> str:
        if models.User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError(_("A user with that email already exists."))
        return value

    def create(self, validated_data: dict) -> models.User:
        display_name = validated_data.pop("display_name", "")
        user = models.User.objects.create_user(**validated_data)
        profile = models.UserProfile.objects.filter(user=user).first()
        if profile and display_name:
            profile.display_name = display_name
            if not profile.auth_provider:
                profile.auth_provider = "password"
            profile.save(update_fields=["display_name", "auth_provider", "updated_at"])
        elif profile and not profile.display_name:
            profile.display_name = user.username
            if not profile.auth_provider:
                profile.auth_provider = "password"
            profile.save(update_fields=["display_name", "auth_provider", "updated_at"])
        return user
