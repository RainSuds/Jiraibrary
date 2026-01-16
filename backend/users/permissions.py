from __future__ import annotations

from rest_framework.permissions import BasePermission


class IsAdminRole(BasePermission):
    """Allow access to platform admins (superuser or role=admin)."""

    message = "Admin access is required to perform this action."

    def has_permission(self, request, view):  # type: ignore[override]
        user = getattr(request, "user", None)
        if not user or not getattr(user, "is_authenticated", False):
            return False
        if getattr(user, "is_superuser", False):
            return True
        role = getattr(user, "role", None)
        if not role:
            return False
        return str(getattr(role, "name", "")).strip().lower() == "admin"
