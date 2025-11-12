from __future__ import annotations

from rest_framework.permissions import BasePermission


class IsCatalogEditor(BasePermission):
    """Allow access to authenticated staff or superusers for write operations."""

    message = "Catalog editing access is restricted to staff users."

    def has_permission(self, request, view):  # type: ignore[override]
        user = getattr(request, "user", None)
        if user is None:
            return False
        return bool(user.is_authenticated and (user.is_staff or user.is_superuser))
