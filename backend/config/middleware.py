from __future__ import annotations

from typing import Callable

from django.http import JsonResponse
from django.utils.deprecation import MiddlewareMixin

from users.models import SiteSettings


class MaintenanceModeMiddleware(MiddlewareMixin):
    """Return 503 responses when maintenance mode is enabled."""

    def __init__(self, get_response: Callable | None = None) -> None:
        super().__init__(get_response)

    def process_request(self, request):  # type: ignore[override]
        path = request.path or ""
        if path.startswith("/admin/") or path.startswith("/api/admin/"):
            return None
        if path.startswith("/health-check") or path.startswith("/api/schema") or path.startswith("/api/docs"):
            return None
        if path.startswith("/api/auth/"):
            return None

        settings_obj = SiteSettings.objects.first()
        if not settings_obj or not settings_obj.maintenance_mode:
            return None

        user = getattr(request, "user", None)
        if user and getattr(user, "is_authenticated", False) and getattr(user, "is_staff", False):
            return None

        message = settings_obj.maintenance_message or "The service is temporarily unavailable due to maintenance."
        return JsonResponse({"detail": message}, status=503)
