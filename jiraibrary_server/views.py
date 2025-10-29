from dataclasses import dataclass
from typing import Iterable, List

from django.db.models import Prefetch
from django.views.generic import DetailView, TemplateView

from .models import Category, Item, ItemPrice, ItemStatus, ItemTranslation


@dataclass
class CategorySection:
    """Helper structure passed to the template."""

    category: Category
    items: List[Item]


class ItemBrowseByCategoryView(TemplateView):
    """Render the catalog grouped by category with optional filtering."""

    template_name = "jiraibrary_server/item_list.html"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)

        translations_prefetch = Prefetch(
            "translations",
            queryset=ItemTranslation.objects.order_by("language__code"),
            to_attr="prefetched_translations",
        )
        prices_prefetch = Prefetch(
            "prices",
            queryset=ItemPrice.objects.select_related("currency").order_by("currency__code"),
            to_attr="prefetched_prices",
        )

        base_items = (
            Item.objects.filter(status=ItemStatus.PUBLISHED)
            .select_related("brand", "category", "default_language")
            .prefetch_related(translations_prefetch, prices_prefetch)
        )

        categories = list(
            Category.objects.prefetch_related(
                Prefetch(
                    "items",
                    queryset=base_items.order_by("slug"),
                    to_attr="published_items",
                )
            ).order_by("name")
        )

        category_lookup = {str(cat.category_id): cat for cat in categories}
        requested_category_id = self.request.GET.get("category")
        active_category = category_lookup.get(requested_category_id) if requested_category_id else None

        if active_category:
            display_categories = [active_category]
        else:
            display_categories = [cat for cat in categories if getattr(cat, "published_items", [])]

        sections = [
            CategorySection(category=cat, items=self._annotate_items(getattr(cat, "published_items", [])))
            for cat in display_categories
        ]

        if active_category and not sections:
            sections = [CategorySection(category=active_category, items=[])]

        nav_categories = [
            cat for cat in categories if getattr(cat, "published_items", []) or cat is active_category
        ]

        context.update(
            category_sections=sections,
            all_categories=nav_categories,
            selected_category=active_category,
            selected_category_id=requested_category_id,
            has_results=any(section.items for section in sections),
        )
        return context

    def _annotate_items(self, items: Iterable[Item]) -> List[Item]:
        enriched: List[Item] = []
        for item in items:
            translations = getattr(item, "prefetched_translations", [])
            default_language_code = getattr(item, "default_language_id", None)
            display_name = next(
                (t.name for t in translations if t.language_id == default_language_code),
                translations[0].name if translations else item.slug,
            )

            brand_display = ""
            if item.brand:
                brand_display = (
                    item.brand.names.get("en")
                    or item.brand.names.get("default")
                    or item.brand.slug
                )

            primary_price = None
            prices = getattr(item, "prefetched_prices", [])
            if prices:
                primary_price = prices[0]

            item.display_name = display_name  # type: ignore[attr-defined]
            item.brand_display = brand_display  # type: ignore[attr-defined]
            item.primary_price = primary_price  # type: ignore[attr-defined]
            enriched.append(item)

        return enriched


class ItemDetailView(DetailView):
    model = Item
    template_name = "jiraibrary_server/item_detail.html"