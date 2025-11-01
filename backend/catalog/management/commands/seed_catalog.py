"""Management command to load sample catalog data for local development."""
from __future__ import annotations

from decimal import Decimal
from typing import Any, Dict, List

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils.text import slugify

from catalog import models

STYLE_DEFINITIONS: Dict[str, List[str]] = {
    "Lolita": ["Sweet", "Classic", "Gothic"],
    "Jirai Kei": ["Classic", "Subcul", "Jersey"],
    "Suna Kei": [],
    "Girly Kei": ["French Girly"],
    "Tenshi Kaiwai": ["Jersey", "Nurse"],
    "Gyaru": [
        "Ahejo",
        "Rokku",
        "Ganguro",
        "Kogal",
        "Onee gyaru",
        "Gyaruo",
        "Hime gyaru",
        "Hime",
        "Himekaji",
        "Manba gyaru",
        "Mode",
        "Yamanba gyaru",
    ],
    "Visual kei": [],
}


STYLE_SEED: Dict[str, Dict[str, Any]] = {
    slugify(style_name): {
        "name": style_name,
        "substyles": {slugify(substyle_name): substyle_name for substyle_name in substyle_names},
    }
    for style_name, substyle_names in STYLE_DEFINITIONS.items()
}

CATEGORY_SEED: Dict[str, Dict[str, Any]] = {
    "dress": {
        "name": "Dress",
        "subcategories": {
            "set-up": "Set-up",
            "one-piece": "One piece",
            "jumperskirt": "Jumperskirt",
        },
    },
    "top": {
        "name": "Top",
        "subcategories": {
            "blouse": "Blouse",
            "shirt": "Shirt",
            "sweater": "Sweater",
        },
    },
    "bottom": {
        "name": "Bottom",
        "subcategories": {
            "skirt": "Skirt",
            "shorts": "Shorts",
            "pants": "Pants",
        },
    },
    "outer": {
        "name": "Outer",
        "subcategories": {
            "coat": "Coat",
            "cardigan": "Cardigan",
            "jacket": "Jacket",
            "capes": "Capes",
        },
    },
    "socks": {
        "name": "Socks",
        "subcategories": {
            "tights": "Tights",
            "otk": "OTK",
            "utk": "UTK",
        },
    },
    "shoes": {
        "name": "Shoes",
        "subcategories": {
            "loafers": "Loafers",
            "platforms": "Platforms",
            "sandals": "Sandals",
        },
    },
    "bag": {
        "name": "Bag",
        "subcategories": {
            "handbag": "Handbag",
            "tote-bag": "Tote bag",
            "ita-bag": "Ita bag",
            "wallets": "Wallets",
        },
    },
    "accessory": {
        "name": "Accessory",
        "subcategories": {
            "headdress": "Headdress",
            "hats": "Hats",
            "clips": "Clips",
            "brooch": "Brooch",
            "choker": "Choker",
            "scarf": "Scarf",
            "perfume": "Perfume",
            "others": "Others",
        },
    },
    "jewelry": {
        "name": "Jewelry",
        "subcategories": {
            "necklace": "Necklace",
            "bracelet": "Bracelet",
            "earring": "Earring",
            "rings": "Rings",
        },
    },
}

BRAND_SEED: Dict[str, Dict[str, Any]] = {
    "liz-lisa": {
        "country": "JP",
        "names": {"en": "Liz Lisa", "ja": "リズリサ"},
        "status": models.Brand.BrandStatus.ACTIVE,
    },
    "rojita": {
        "country": "JP",
        "names": {"en": "Rojita", "ja": "ロジータ"},
        "status": models.Brand.BrandStatus.ACTIVE,
    },
}

BRAND_TAXONOMY_SEED: Dict[str, Dict[str, Any]] = {
    "liz-lisa": {
        "styles": ["lolita"],
        "primary_style": "lolita",
        "substyles": ["sweet", "classic"],
    },
    "rojita": {
        "styles": ["girly-kei"],
        "primary_style": "girly-kei",
        "substyles": ["french-girly"],
    },
}


class Command(BaseCommand):
    help = "Seed the catalog with a small set of brands, items, and related reference data."

    def handle(self, *args, **options):
        seed_catalog()
        self.stdout.write(self.style.SUCCESS("Catalog seed data loaded."))


def seed_catalog() -> None:
    """Populate a minimal set of catalog records used by the sample frontend."""
    with transaction.atomic():
        languages = _ensure_languages()
        currencies = _ensure_currencies()
        brands = _create_brands()
        categories = _create_categories()
        subcategories = _create_subcategories(categories)
        styles = _create_styles()
        substyles = _create_substyles(styles)
        _sync_brand_translations(brands=brands, languages=languages)
        _sync_brand_taxonomy(brands=brands, styles=styles, substyles=substyles)
        colors = _create_colors()
        fabrics = _create_fabrics()
        features = _create_features()
        collections = _create_collections(brands)
        _create_items(
            languages=languages,
            currencies=currencies,
            brands=brands,
            categories=categories,
            subcategories=subcategories,
            substyles=substyles,
            colors=colors,
            fabrics=fabrics,
            features=features,
            collections=collections,
        )


def _ensure_languages() -> dict[str, models.Language]:
    primary = {
        "en": {"name": "English", "native_name": "English"},
        "ja": {"name": "Japanese", "native_name": "日本語"},
    }
    languages: dict[str, models.Language] = {}
    for code, attrs in primary.items():
        language, _ = models.Language.objects.get_or_create(
            code=code,
            defaults={
                "name": attrs["name"],
                "native_name": attrs["native_name"],
                "is_supported": True,
            },
        )
        languages[code] = language
    return languages


def _ensure_currencies() -> dict[str, models.Currency]:
    primary = {
        "JPY": {"name": "Japanese Yen", "symbol": "¥"},
        "USD": {"name": "US Dollar", "symbol": "$"},
    }
    currencies: dict[str, models.Currency] = {}
    for code, attrs in primary.items():
        currency, _ = models.Currency.objects.get_or_create(
            code=code,
            defaults={
                "name": attrs["name"],
                "symbol": attrs["symbol"],
                "is_active": True,
            },
        )
        currencies[code] = currency
    return currencies


def _create_brands() -> dict[str, models.Brand]:
    brands: dict[str, models.Brand] = {}
    for slug, attrs in BRAND_SEED.items():
        brand, _ = models.Brand.objects.get_or_create(
            slug=slug,
            defaults={
                "country": attrs["country"],
                "names": attrs["names"],
                "status": attrs["status"],
            },
        )
        changed_fields: List[str] = []
        if brand.country != attrs["country"]:
            brand.country = str(attrs["country"])
            changed_fields.append("country")
        if brand.names != attrs["names"]:
            brand.names = dict(attrs["names"])
            changed_fields.append("names")
        if brand.status != attrs["status"]:
            brand.status = attrs["status"]
            changed_fields.append("status")
        if changed_fields:
            brand.save(update_fields=changed_fields)
        brands[slug] = brand
    return brands


def _create_categories() -> dict[str, models.Category]:
    categories: dict[str, models.Category] = {}
    for slug, attrs in CATEGORY_SEED.items():
        category, _ = models.Category.objects.get_or_create(
            slug=slug,
            defaults={
                "name": attrs["name"],
            },
        )
        if category.name != attrs["name"]:
            category.name = str(attrs["name"])
            category.save(update_fields=["name"])
        categories[slug] = category
    return categories


def _create_subcategories(categories: dict[str, models.Category]) -> dict[str, models.Subcategory]:
    subcategories: dict[str, models.Subcategory] = {}
    for category_slug, payload in CATEGORY_SEED.items():
        category = categories.get(category_slug)
        if not category:
            continue
        child_map = payload.get("subcategories")
        if not isinstance(child_map, dict):
            continue
        for sub_slug, name in child_map.items():
            subcategory, created = models.Subcategory.objects.get_or_create(
                slug=sub_slug,
                defaults={
                    "name": name,
                    "category": category,
                },
            )
            changed = False
            if getattr(subcategory, "category_id", None) != category.id:
                subcategory.category = category
                changed = True
            if subcategory.name != name:
                subcategory.name = str(name)
                changed = True
            if changed and not created:
                subcategory.save(update_fields=["category", "name"])
            subcategories[sub_slug] = subcategory
    return subcategories


def _create_styles() -> dict[str, models.Style]:
    styles: dict[str, models.Style] = {}
    for slug, attrs in STYLE_SEED.items():
        style, _ = models.Style.objects.get_or_create(
            slug=slug,
            defaults={
                "name": attrs["name"],
            },
        )
        if style.name != attrs["name"]:
            style.name = str(attrs["name"])
            style.save(update_fields=["name"])
        styles[slug] = style
    return styles


def _create_substyles(styles: dict[str, models.Style]) -> dict[str, models.Substyle]:
    substyles: dict[str, models.Substyle] = {}
    for style_slug, payload in STYLE_SEED.items():
        style = styles.get(style_slug)
        if not style:
            continue
        child_map = payload.get("substyles")
        if not isinstance(child_map, dict):
            continue
        for sub_slug, name in child_map.items():
            substyle, created = models.Substyle.objects.get_or_create(
                slug=sub_slug,
                defaults={
                    "name": name,
                    "style": style,
                },
            )
            changed = False
            if getattr(substyle, "style_id", None) != style.id:
                substyle.style = style
                changed = True
            if substyle.name != name:
                substyle.name = str(name)
                changed = True
            if changed and not created:
                substyle.save(update_fields=["style", "name"])
            substyles[sub_slug] = substyle
    return substyles


def _create_colors() -> dict[str, models.Color]:
    data = {
        "pink": {"name": "Pink", "hex_code": "#ffc0cb"},
        "sax": {"name": "Sax", "hex_code": "#9cd0ff"},
    }
    colors: dict[str, models.Color] = {}
    for slug, attrs in data.items():
        color, _ = models.Color.objects.get_or_create(
            name=attrs["name"],
            defaults={
                "hex_code": attrs["hex_code"],
            },
        )
        colors[slug] = color
    return colors


def _create_fabrics() -> dict[str, models.Fabric]:
    data = {
        "cotton": {"name": "Cotton"},
        "chiffon": {"name": "Chiffon"},
    }
    fabrics: dict[str, models.Fabric] = {}
    for key, attrs in data.items():
        fabric, _ = models.Fabric.objects.get_or_create(
            name=attrs["name"],
            defaults={"description": ""},
        )
        fabrics[key] = fabric
    return fabrics


def _create_features() -> dict[str, models.Feature]:
    data = {
        "bow": {
            "name": "Oversized Bow",
            "category": models.Feature.FeatureCategory.ACCESSORY,
        },
        "lace": {
            "name": "Lace Trim",
            "category": models.Feature.FeatureCategory.TRIM,
        },
    }
    features: dict[str, models.Feature] = {}
    for key, attrs in data.items():
        feature, _ = models.Feature.objects.get_or_create(
            name=attrs["name"],
            defaults={
                "category": attrs["category"],
                "description": "",
                "synonyms": {},
            },
        )
        features[key] = feature
    return features


def _create_collections(brands: dict[str, models.Brand]) -> dict[str, models.Collection]:
    data = {
        "liz-lisa": [
            {"name": "Sewing Bear Set-Up", "season": models.Collection.Season.WINTER, "year": 2025},
        ],
        "rojita": [
            {"name": "Waist Ribbon Design Skirt", "season": models.Collection.Season.WINTER, "year": 2025},
        ],
    }
    collections: dict[str, models.Collection] = {}
    for brand_slug, items in data.items():
        brand = brands.get(brand_slug)
        if brand is None:
            continue
        for item in items:
            collection, _ = models.Collection.objects.get_or_create(
                brand=brand,
                name=item["name"],
                defaults={
                    "season": item["season"],
                    "year": item["year"],
                    "description": "",
                },
            )
            collections[f"{brand_slug}:{collection.name}"] = collection
    return collections


def _sync_brand_translations(
    *,
    brands: Dict[str, models.Brand],
    languages: Dict[str, models.Language],
) -> None:
    for brand_slug, brand in brands.items():
        fallback_names = BRAND_SEED.get(brand_slug, {}).get("names", {})
        fallback_descriptions = BRAND_SEED.get(brand_slug, {}).get("descriptions", {})
        for code, language in languages.items():
            localized_name = None
            if isinstance(brand.names, dict):
                localized_name = brand.names.get(code) or brand.names.get("en")
            if localized_name is None and isinstance(fallback_names, dict):
                localized_name = fallback_names.get(code) or fallback_names.get("en")
            if localized_name is None:
                localized_name = brand.slug.replace("-", " ").title()

            localized_description = ""
            if isinstance(brand.descriptions, dict):
                localized_description = brand.descriptions.get(code) or brand.descriptions.get("en") or ""
            if not localized_description and isinstance(fallback_descriptions, dict):
                localized_description = fallback_descriptions.get(code, "")

            translation, created = models.BrandTranslation.objects.get_or_create(
                brand=brand,
                language=language,
                defaults={
                    "name": localized_name,
                    "description": localized_description,
                },
            )
            if created:
                continue

            update_fields: List[str] = []
            if translation.name != localized_name:
                translation.name = localized_name
                update_fields.append("name")
            if translation.description != localized_description:
                translation.description = localized_description
                update_fields.append("description")
            if update_fields:
                translation.save(update_fields=update_fields)


def _sync_brand_taxonomy(
    *,
    brands: Dict[str, models.Brand],
    styles: Dict[str, models.Style],
    substyles: Dict[str, models.Substyle],
) -> None:
    for brand_slug, payload in BRAND_TAXONOMY_SEED.items():
        brand = brands.get(brand_slug)
        if not brand:
            continue

        primary_style_slug = payload.get("primary_style")
        for style_slug in payload.get("styles", []):
            style = styles.get(style_slug)
            if not style:
                continue
            is_primary = style_slug == primary_style_slug
            brand_style, created = models.BrandStyle.objects.get_or_create(
                brand=brand,
                style=style,
                defaults={"is_primary": is_primary},
            )
            if not created and brand_style.is_primary != is_primary:
                brand_style.is_primary = is_primary
                brand_style.save(update_fields=["is_primary"])

        substyle_notes = payload.get("substyle_notes", {})
        for sub_slug in payload.get("substyles", []):
            substyle = substyles.get(sub_slug)
            if not substyle:
                continue
            note = ""
            if isinstance(substyle_notes, dict):
                note = str(substyle_notes.get(sub_slug, ""))
            brand_substyle, created = models.BrandSubstyle.objects.get_or_create(
                brand=brand,
                substyle=substyle,
                defaults={"notes": note},
            )
            if not created and note and brand_substyle.notes != note:
                brand_substyle.notes = note
                brand_substyle.save(update_fields=["notes"])


def _create_items(
    *,
    languages: dict[str, models.Language],
    currencies: dict[str, models.Currency],
    brands: dict[str, models.Brand],
    categories: dict[str, models.Category],
    subcategories: dict[str, models.Subcategory],
    substyles: dict[str, models.Substyle],
    colors: dict[str, models.Color],
    fabrics: dict[str, models.Fabric],
    features: dict[str, models.Feature],
    collections: dict[str, models.Collection],
) -> None:
    liz_lisa = models.Item.objects.update_or_create(
        slug="sewing-bear-set-up",
        defaults={
            "brand": brands["liz-lisa"],
            "category": categories["dress"],
            "subcategory": subcategories.get("set-up"),
            "origin_country": "JP",
            "default_language": languages["en"],
            "default_currency": currencies["JPY"],
            "release_year": 2024,
            "collaboration": "None",
            "limited_edition": False,
            "has_matching_set": True,
            "verified_source": True,
            "status": models.Item.ItemStatus.PUBLISHED,
        },
    )[0]
    _add_item_details(
        liz_lisa,
        languages=languages,
        colors=[colors["pink"]],
        fabrics=[(fabrics["cotton"], Decimal("65")), (fabrics["chiffon"], Decimal("35"))],
        features=[features["bow"], features["lace"]],
        collections=[collections["liz-lisa:Sewing Bear Set-Up"]],
        substyles=[substyles["sweet"]],
        price_currency=currencies["JPY"],
        price_amount=Decimal("28600"),
    )

    rojita = models.Item.objects.update_or_create(
        slug="ウエストリボンデザインスカート",
        defaults={
            "brand": brands["rojita"],
            "category": categories["bottom"],
            "subcategory": subcategories.get("skirt"),
            "origin_country": "JP",
            "default_language": languages["en"],
            "default_currency": currencies["JPY"],
            "release_year": 2023,
            "collaboration": "",
            "limited_edition": True,
            "has_matching_set": False,
            "verified_source": True,
            "status": models.Item.ItemStatus.PUBLISHED,
        },
    )[0]
    _add_item_details(
        rojita,
        languages=languages,
        colors=[colors["sax"]],
        fabrics=[(fabrics["cotton"], Decimal("55")), (fabrics["chiffon"], Decimal("45"))],
        features=[features["lace"]],
        collections=[collections["rojita:Waist Ribbon Design Skirt"]],
        substyles=[substyles["classic"]],
        price_currency=currencies["JPY"],
        price_amount=Decimal("31200"),
    )


def _add_item_details(
    item: models.Item,
    *,
    languages: dict[str, models.Language],
    colors: list[models.Color],
    fabrics: list[tuple[models.Fabric, Decimal]],
    features: list[models.Feature],
    collections: list[models.Collection],
    substyles: list[models.Substyle],
    price_currency: models.Currency,
    price_amount: Decimal,
) -> None:
    translation_defaults = {
        "description": "A charming release featuring sugary motifs and ruffled trims.",
        "season": "Spring",
        "fit": "Regular",
        "length": "Knee length",
        "occasion": "Tea party",
    }
    models.ItemTranslation.objects.update_or_create(
        item=item,
        language=languages["en"],
        defaults={
            "name": item.slug.replace("-", " ").title(),
            **translation_defaults,
        },
    )
    models.ItemTranslation.objects.update_or_create(
        item=item,
        language=languages["ja"],
        defaults={
            "name": "スイートドレス",  # Placeholder Japanese translation
            **translation_defaults,
        },
    )

    models.ItemPrice.objects.update_or_create(
        item=item,
        currency=price_currency,
        source=models.ItemPrice.Source.ORIGIN,
        defaults={
            "amount": price_amount,
        },
    )

    models.ItemVariant.objects.update_or_create(
        item=item,
        variant_label="Default",
        defaults={
            "stock_status": models.ItemVariant.StockStatus.AVAILABLE,
            "notes": {},
        },
    )

    models.ItemMetadata.objects.update_or_create(
        item=item,
        defaults={
            "season": translation_defaults["season"],
            "occasion": translation_defaults["occasion"],
            "fit": translation_defaults["fit"],
            "length": translation_defaults["length"],
        },
    )

    for color in colors:
        models.ItemColor.objects.get_or_create(item=item, color=color, defaults={"is_primary": True})

    for fabric, percentage in fabrics:
        models.ItemFabric.objects.get_or_create(
            item=item,
            fabric=fabric,
            defaults={"percentage": percentage},
        )

    for feature in features:
        models.ItemFeature.objects.get_or_create(
            item=item,
            feature=feature,
            defaults={"is_prominent": True},
        )

    for collection in collections:
        models.ItemCollection.objects.get_or_create(
            item=item,
            collection=collection,
            defaults={"role": models.ItemCollection.CollectionRole.MAINLINE},
        )

    for substyle in substyles:
        models.ItemSubstyle.objects.get_or_create(item=item, substyle=substyle)