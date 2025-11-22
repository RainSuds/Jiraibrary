from __future__ import annotations

from rest_framework.permissions import BasePermission


class IsImageOwnerOrCatalogEditor(BasePermission):
    """Allow staff editors or the original uploader (while unlinked) to edit images."""

    message = "You do not have permission to modify this image."

    def has_permission(self, request, view):  # type: ignore[override]
        user = getattr(request, "user", None)
        return bool(user and user.is_authenticated)

    def has_object_permission(self, request, view, obj):  # type: ignore[override]
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return False
        if getattr(user, "is_staff", False) or getattr(user, "is_superuser", False):
            return True
        if obj.uploaded_by_id != getattr(user, "id", None):
            return False
        # Once an image is linked to catalog entities, lock it to staff review.
        return not any((obj.item_id, obj.brand_id, obj.variant_id))


class IsCatalogEditor(BasePermission):
    """Allow access to authenticated staff or superusers for write operations."""

    message = "Catalog editing access is restricted to staff users."

    def has_permission(self, request, view):  # type: ignore[override]
        user = getattr(request, "user", None)
        if user is None:
            return False
        return bool(user.is_authenticated and (user.is_staff or user.is_superuser))
