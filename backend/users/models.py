# pyright: reportIncompatibleVariableOverride=false
"""Custom user and related account models."""
from __future__ import annotations

import uuid

from django.contrib.auth.models import AbstractUser
from django.db import models


class TimeStampedUUIDModel(models.Model):
    """Abstract base class shared by account models."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class UserRole(TimeStampedUUIDModel):
    name = models.CharField(max_length=50, unique=True)
    description = models.TextField(blank=True)
    scopes = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class User(AbstractUser):
    """Extend Django's user model to use UUID keys and explicit roles."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField("email address", unique=True)
    role = models.ForeignKey(
        UserRole,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="users",
    )

    REQUIRED_FIELDS = ["email"]

    class Meta:
        ordering = ["username"]

    def __str__(self) -> str:
        return self.username


class UserProfile(TimeStampedUUIDModel):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    display_name = models.CharField(max_length=150, blank=True)
    bio = models.TextField(blank=True)
    pronouns = models.CharField(max_length=64, blank=True)
    location = models.CharField(max_length=128, blank=True)
    website = models.URLField(blank=True)
    preferred_languages = models.JSONField(default=list, blank=True)
    social_links = models.JSONField(default=dict, blank=True)
    avatar_url = models.URLField(blank=True)

    class Meta:
        ordering = ["user__username"]

    def __str__(self) -> str:
        return self.display_name or self.user.username
