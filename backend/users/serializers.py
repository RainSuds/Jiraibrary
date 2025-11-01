"""Serializers for user authentication endpoints."""
from __future__ import annotations

from rest_framework import serializers

from . import models


class UserSerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()
    role = serializers.SerializerMethodField()

    class Meta:
        model = models.User
        fields = [
            "id",
            "username",
            "email",
            "is_staff",
            "display_name",
            "role",
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
