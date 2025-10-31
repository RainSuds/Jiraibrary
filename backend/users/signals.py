from __future__ import annotations

from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import User, UserProfile


@receiver(post_save, sender=User)
def ensure_profile_exists(sender, instance: User, created: bool, **_: object) -> None:
    """Create a blank profile whenever a user account is created."""
    if created:
        UserProfile.objects.create(user=instance)
