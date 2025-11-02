"""Serializers for user authentication endpoints."""
from __future__ import annotations

from django.contrib.auth import authenticate
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers

from . import models


class UserSerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()
    role = serializers.SerializerMethodField()
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = models.User
        fields = [
            "id",
            "username",
            "email",
            "is_staff",
            "display_name",
            "role",
            "avatar_url",
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
            profile.save(update_fields=["display_name", "updated_at"])
        elif profile and not profile.display_name:
            profile.display_name = user.username
            profile.save(update_fields=["display_name", "updated_at"])
        return user
