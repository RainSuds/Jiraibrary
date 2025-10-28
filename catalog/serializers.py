from __future__ import annotations

# pyright: reportAttributeAccessIssue=false

from dataclasses import asdict, dataclass, field
from typing import Any, Dict, Optional

from .models import Item, ItemPrice, ItemTranslation, ItemVariant


@dataclass(slots=True)
class ItemTranslationPayload:
    language: str
    name: str
    description: str
    pattern: str
    fit: str
    length: str
    occasion: str
    season: str
    lining: str
    closure_type: str
    care_instructions: str

    @classmethod
    def from_model(cls, translation: ItemTranslation) -> "ItemTranslationPayload":
        return cls(
            language=str(translation.language_id),
            name=translation.name,
            description=translation.description,
            pattern=translation.pattern,
            fit=translation.fit,
            length=translation.length,
            occasion=translation.occasion,
            season=translation.season,
            lining=translation.lining,
            closure_type=translation.closure_type,
            care_instructions=translation.care_instructions,
        )


@dataclass(slots=True)
class ItemPricePayload:
    currency: str
    amount: str
    source: str
    rate_used: Optional[str]

    @classmethod
    def from_model(cls, price: ItemPrice) -> "ItemPricePayload":
        return cls(
            currency=str(price.currency_id),
            amount=str(price.amount),
            source=price.source,
            rate_used=str(price.rate_used) if price.rate_used is not None else None,
        )


@dataclass(slots=True)
class ItemVariantPayload:
    label: str
    sku: str
    color: Optional[str]
    size_descriptor: str
    stock_status: str
    notes: Dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_model(cls, variant: ItemVariant) -> "ItemVariantPayload":
        return cls(
            label=variant.variant_label,
            sku=variant.sku,
            color=str(variant.color_id) if variant.color_id else None,
            size_descriptor=variant.size_descriptor,
            stock_status=variant.stock_status,
            notes=variant.notes or {},
        )


def serialize_item(item: Item) -> Dict[str, Any]:
    """Build a JSON-ready payload for public APIs or templates."""

    brand_payload: Optional[Dict[str, Any]] = None
    if item.brand:
        brand_payload = {
            "id": str(item.brand.pk),
            "slug": item.brand.slug,
            "name": item.brand.names.get("en"),
        }

    category_payload: Optional[Dict[str, Any]] = None
    if item.category:
        category_payload = {
            "id": str(item.category.pk),
            "name": item.category.name,
        }

    default_language = item.default_language_id
    default_currency = item.default_currency_id

    base: Dict[str, Any] = {
        "id": str(item.pk),
        "slug": item.slug,
        "brand": brand_payload,
        "category": category_payload,
        "default_language": default_language,
        "default_currency": default_currency,
        "release_year": item.release_year,
        "release_date": item.release_date.isoformat() if item.release_date else None,
        "status": item.status,
        "limited_edition": item.limited_edition,
        "has_matching_set": item.has_matching_set,
        "metadata": item.metadata and {
            "pattern": item.metadata.pattern,
            "sleeve_type": item.metadata.sleeve_type,
            "occasion": item.metadata.occasion,
            "season": item.metadata.season,
            "fit": item.metadata.fit,
            "length": item.metadata.length,
            "lining": item.metadata.lining,
            "closure_type": item.metadata.closure_type,
            "care_instructions": item.metadata.care_instructions,
            "inspiration": item.metadata.inspiration,
            "ai_confidence": str(item.metadata.ai_confidence)
            if item.metadata.ai_confidence is not None
            else None,
        },
        "extra_metadata": item.extra_metadata,
    }

    base["translations"] = [
        asdict(ItemTranslationPayload.from_model(t)) for t in item.translations.all()
    ]
    base["prices"] = [
        asdict(ItemPricePayload.from_model(p)) for p in item.prices.order_by("currency")
    ]
    base["variants"] = [
        asdict(ItemVariantPayload.from_model(v)) for v in item.variants.all()
    ]
    base["colors"] = [
        {
            "id": str(color.color_id),
            "name": color.color.name,
            "hex": color.color.hex_code,
            "is_primary": color.is_primary,
        }
        for color in item.item_colors.select_related("color")
    ]
    base["tags"] = [
        {"id": str(tag.tag_id), "name": tag.tag.name, "type": tag.tag.type}
        for tag in item.item_tags.select_related("tag")
    ]

    return base