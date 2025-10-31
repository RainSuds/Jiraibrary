from __future__ import annotations

from django.apps import AppConfig


class UsersConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "users"
    verbose_name = "Accounts"

    def ready(self) -> None:  # pragma: no cover - import side effects
        from . import signals  # noqa: F401
