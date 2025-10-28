from django.core.management.base import BaseCommand, CommandError

from catalog.models import Item


class Command(BaseCommand):
    help = "Validate that seed fixtures load correctly and core relations resolve."

    def handle(self, *args, **options):
        try:
            item = Item.all_objects.select_related(
                "brand",
                "category",
                "metadata",
            ).prefetch_related(
                "translations",
                "prices",
                "variants__measurements",
                "item_colors__color",
                "item_tags__tag",
                "item_fabrics__fabric",
            ).get(slug="heart-apron-jsk-setup")
        except Item.DoesNotExist as exc:
            raise CommandError("Expected Heart Apron seed item is missing.") from exc

        missing_relations = []

        if not item.brand:
            missing_relations.append("brand")
        if not item.category:
            missing_relations.append("category")
        if item.translations.count() < 1:
            missing_relations.append("translations")
        if item.prices.count() < 1:
            missing_relations.append("prices")
        if item.variants.count() < 1:
            missing_relations.append("variants")
        if not item.metadata:
            missing_relations.append("metadata")
        if item.item_tags.count() < 1:
            missing_relations.append("tags")
        if item.item_colors.count() < 1:
            missing_relations.append("colors")
        if item.item_fabrics.count() < 1:
            missing_relations.append("fabrics")

        if missing_relations:
            missing = ", ".join(missing_relations)
            raise CommandError(f"Seed data is incomplete: missing {missing} relations.")

        self.stdout.write(self.style.SUCCESS("Seed data integrity check passed."))
