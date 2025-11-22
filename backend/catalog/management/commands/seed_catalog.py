"""Management command to load sample catalog data for local development."""
from __future__ import annotations

from decimal import Decimal
from typing import Any, Dict, List

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils.text import slugify

from catalog import models

# ---------------------------------------------------------------------------
# Seed definitions
# ---------------------------------------------------------------------------

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
    "acdc-rag": {
        "country": "JP",
        "names": {"en": "ACDC Rag", "ja": "ACDC Rag"},
        "descriptions": {"en": "Spreading KAWAII from Harajuku to the world."},
        "founded_year": 1973,
        "icon_url": "https://placehold.co/400x400?text=ACDC+Rag",
        "official_site_url": "https://acdcrag.com/en",
        "status": models.Brand.BrandStatus.ACTIVE,
    },
    "dear-my-love": {
        "country": "JP",
        "names": {"en": "DearMyLove", "ja": "DearMyLove"},
        "descriptions": {
            "ja": "量産型・地雷系・闇属性・ガーリーと何でも揃っちゃう、ずっと可愛くいたい女の子の味方ブランド",
            "en": "A brand supporting girls who want to stay cute forever with looks spanning ryousangata, jirai, dark, and girly styles.",
        },
        "founded_year": 2008,
        "icon_url": "https://placehold.co/400x400?text=DearMyLove",
        "official_site_url": "https://dreamvs.jp/pages/brand_dearmylove_",
        "status": models.Brand.BrandStatus.ACTIVE,
    },
    "dimmoire": {
        "country": "JP",
        "names": {"en": "DimMoire", "ja": "DimMoire"},
        "descriptions": {
            "en": (
                "DimMoire is a brand with the concept of clothes that'll make you want to show off,"
                " blending gothic elements into everyday life."
            )
        },
        "founded_year": 2020,
        "icon_url": "https://placehold.co/400x400?text=DimMoire",
        "official_site_url": "https://acrotokyo-global.com/index_en_USD_2-5.html",
        "status": models.Brand.BrandStatus.ACTIVE,
    },
    "liz-lisa": {
        "country": "JP",
        "names": {"en": "Liz Lisa", "ja": "リズリサ"},
        "descriptions": {"en": ""},
        "founded_year": 1999,
        "icon_url": "https://placehold.co/400x400?text=Liz+Lisa",
        "official_site_url": "https://www.tokyokawaiilife.jp/",
        "status": models.Brand.BrandStatus.ACTIVE,
    },
    "rojita": {
        "country": "JP",
        "names": {"en": "Rojita", "ja": "ロジータ"},
        "descriptions": {
            "en": (
                "Clothing for girls transitioning from teens to their twenties with a cute adult style,"
                " blending seasonal trends and retro-girly charm."
            )
        },
        "founded_year": 2001,
        "icon_url": "https://placehold.co/400x400?text=Rojita",
        "official_site_url": "https://rlab-store.jp/",
        "status": models.Brand.BrandStatus.ACTIVE,
    },
}

BRAND_TAXONOMY_SEED: Dict[str, Dict[str, Any]] = {
    "acdc-rag": {
        "styles": ["jirai-kei", "tenshi-kaiwai", "visual-kei"],
        "primary_style": "jirai-kei",
        "substyles": ["jersey", "subcul"],
    },
    "dear-my-love": {
        "styles": ["jirai-kei", "tenshi-kaiwai"],
        "primary_style": "jirai-kei",
        "substyles": ["classic", "jersey"],
    },
    "dimmoire": {
        "styles": ["jirai-kei"],
        "primary_style": "jirai-kei",
        "substyles": ["subcul"],
    },
    "liz-lisa": {
        "styles": ["jirai-kei", "gyaru"],
        "primary_style": "jirai-kei",
        "substyles": ["classic", "himekaji"],
    },
    "rojita": {
        "styles": ["jirai-kei", "suna-kei"],
        "primary_style": "jirai-kei",
        "substyles": ["classic"],
    },
}


class Command(BaseCommand):
    help = "Seed the catalog with a small set of brands, items, and related reference data."

    def handle(self, *args, **options):
        seed_catalog()
        self.stdout.write(self.style.SUCCESS("Catalog seed data loaded."))


# ---------------------------------------------------------------------------
# Seed orchestration
# ---------------------------------------------------------------------------

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
        tags = _create_tags()
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
            tags=tags,
            features=features,
            collections=collections,
        )


# ---------------------------------------------------------------------------
# Seed helpers
# ---------------------------------------------------------------------------

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
        defaults = {
            "country": attrs["country"],
            "names": dict(attrs["names"]),
            "status": attrs["status"],
            "descriptions": dict(attrs.get("descriptions", {})),
            "founded_year": attrs.get("founded_year"),
            "icon_url": attrs.get("icon_url", ""),
            "official_site_url": attrs.get("official_site_url", ""),
        }
        brand, _ = models.Brand.objects.get_or_create(
            slug=slug,
            defaults=defaults,
        )
        changed_fields: List[str] = []
        field_updates: Dict[str, Any] = {
            "country": str(attrs["country"]),
            "names": dict(attrs["names"]),
            "descriptions": dict(attrs.get("descriptions", {})),
            "founded_year": attrs.get("founded_year"),
            "icon_url": attrs.get("icon_url", ""),
            "official_site_url": attrs.get("official_site_url", ""),
            "status": attrs["status"],
        }
        for field, value in field_updates.items():
            if getattr(brand, field) != value:
                setattr(brand, field, value)
                changed_fields.append(field)
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
        "white": {"name": "White", "hex_code": "#ffffff"},
        "pink": {"name": "Pink", "hex_code": "#ffc0cb"},
        "blue": {"name": "Blue", "hex_code": "#2f6ed9"},
        "sax": {"name": "Sax", "hex_code": "#9cd0ff"},
        "black": {"name": "Black", "hex_code": "#000000"},
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
        "polyester": {"name": "Polyester"},
    }
    fabrics: dict[str, models.Fabric] = {}
    for key, attrs in data.items():
        fabric, _ = models.Fabric.objects.get_or_create(
            name=attrs["name"],
            defaults={"description": ""},
        )
        fabrics[key] = fabric
    return fabrics


def _create_tags() -> dict[str, models.Tag]:
    data = {
        "solid": {
            "name": "Solid",
            "description": "Indicates a piece is a solid color without any prints or patterns.",
            "type": models.Tag.TagType.DETAIL,
        },
        "print": {
            "name": "Print",
            "description": "Highlights that the piece features printed artwork or patterned motifs.",
            "type": models.Tag.TagType.DETAIL,
        },
    }
    tags: dict[str, models.Tag] = {}
    for slug, attrs in data.items():
        tag, created = models.Tag.objects.get_or_create(
            slug=slug,
            defaults={
                "name": attrs["name"],
                "description": attrs["description"],
                "type": attrs["type"],
                "is_featured": False,
            },
        )
        if not created:
            update_fields: list[str] = []
            if tag.name != attrs["name"]:
                tag.name = attrs["name"]
                update_fields.append("name")
            if tag.description != attrs["description"]:
                tag.description = attrs["description"]
                update_fields.append("description")
            if tag.type != attrs["type"]:
                tag.type = attrs["type"]
                update_fields.append("type")
            if update_fields:
                tag.save(update_fields=update_fields)
        tags[slug] = tag
    return tags


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
        "detachable-sleeves": {
            "name": "Detachable Sleeves",
            "category": models.Feature.FeatureCategory.CONSTRUCTION,
        },
        "short-sleeves": {
            "name": "Short Sleeves",
            "category": models.Feature.FeatureCategory.CONSTRUCTION,
        },
        "zipper-detail": {
            "name": "Zipper Detail",
            "category": models.Feature.FeatureCategory.ATTACHMENT,
        },
        "button-front": {
            "name": "Button Front",
            "category": models.Feature.FeatureCategory.ATTACHMENT,
        },
        "print-graphic": {
            "name": "Graphic Print",
            "category": models.Feature.FeatureCategory.TRIM,
        },
        "back-vent": {
            "name": "Back Vent",
            "category": models.Feature.FeatureCategory.CONSTRUCTION,
        },
        "tuxedo-collar": {
            "name": "Tuxedo Collar",
            "category": models.Feature.FeatureCategory.CONSTRUCTION,
        },
        "sailor-collar": {
            "name": "Sailor Collar",
            "category": models.Feature.FeatureCategory.CONSTRUCTION,
        },
        "long-sleeves": {
            "name": "Long Sleeves",
            "category": models.Feature.FeatureCategory.CONSTRUCTION,
        },
        "skirt-pants": {
            "name": "Skirt Pants",
            "category": models.Feature.FeatureCategory.CONSTRUCTION,
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
        "acdc-rag": [
            {"name": "PUNK Revival 2nd", "season": models.Collection.Season.SPRING, "year": 2025},
        ],
        "liz-lisa": [
            {"name": "Sewing Bear Set-Up", "season": models.Collection.Season.WINTER, "year": 2025},
            {"name": "2025 Standard Release", "season": models.Collection.Season.SPRING, "year": 2025},
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
        desired_style_ids: set[Any] = set()
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
            desired_style_ids.add(style.id)
            if not created and brand_style.is_primary != is_primary:
                brand_style.is_primary = is_primary
                brand_style.save(update_fields=["is_primary"])
        if desired_style_ids:
            models.BrandStyle.objects.filter(brand=brand).exclude(style_id__in=desired_style_ids).delete()
        else:
            models.BrandStyle.objects.filter(brand=brand).delete()

        substyle_notes = payload.get("substyle_notes", {})
        desired_substyle_ids: set[Any] = set()
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
            desired_substyle_ids.add(substyle.id)
            if not created and note and brand_substyle.notes != note:
                brand_substyle.notes = note
                brand_substyle.save(update_fields=["notes"])
        if desired_substyle_ids:
            models.BrandSubstyle.objects.filter(brand=brand).exclude(substyle_id__in=desired_substyle_ids).delete()
        else:
            models.BrandSubstyle.objects.filter(brand=brand).delete()


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
    tags: dict[str, models.Tag],
    features: dict[str, models.Feature],
    collections: dict[str, models.Collection],
) -> None:
    acdc_rag = models.Item.objects.update_or_create(
        slug="1115-shirt",
        defaults={
            "brand": brands["acdc-rag"],
            "category": categories["top"],
            "subcategory": subcategories.get("blouse"),
            "origin_country": "JP",
            "production_country": "CN",
            "default_language": languages["en"],
            "default_currency": currencies["JPY"],
            "release_year": 2025,
            "collaboration": "",
            "limited_edition": False,
            "has_matching_set": True,
            "verified_source": True,
            "status": models.Item.ItemStatus.PUBLISHED,
        },
    )[0]
    _add_item_details(
        acdc_rag,
        languages=languages,
        colors=[colors["black"]],
        fabrics=[(fabrics["polyester"], Decimal("100"))],
        features=[
            features["detachable-sleeves"],
            features["short-sleeves"],
            features["zipper-detail"],
            features["button-front"],
            features["print-graphic"],
            features["back-vent"],
            features["tuxedo-collar"],
        ],
        collections=[collections["acdc-rag:PUNK Revival 2nd"]],
        substyles=[],
        price_currency=currencies["JPY"],
        price_amount=Decimal("6490"),
        tags=[tags["print"]],
        translation_overrides={
            "en": {
                "name": "1115 Shirt",
                "description": (
                    "[Design]\n"
                    "Want to bring back those heart-racing moments?\n"
                    "Dive into nostalgic-meets-fresh Harajuku punk revival!\n\n"
                    "[Details]\n"
                    "Fierce zip-accented punk shirt!\n"
                    "Removable sleeves for that perfect 2-way versatility"
                ),
            },
            "ja": {
                "name": "1115シャツ",
                "description": (
                    "【デザイン】\n"
                    "あの頃のトキメキをもう一度着こなしてみませんか？\n"
                    "懐かしくて新しい原宿パンクリバイバル！\n\n"
                    "【ディテール】\n"
                    "ジップ使いのパンクなシャツ！\n"
                    "袖は取り外せる2way仕様◎"
                ),
            },
        },
        secondary_prices=[(currencies["USD"], Decimal("44.00"))],
    )

    liz_lisa = models.Item.objects.update_or_create(
        slug="sewing-bear-set-up",
        defaults={
            "brand": brands["liz-lisa"],
            "category": categories["dress"],
            "subcategory": subcategories.get("set-up"),
            "origin_country": "JP",
            "production_country": "CN",
            "default_language": languages["en"],
            "default_currency": currencies["JPY"],
            "release_year": 2025,
            "collaboration": "",
            "limited_edition": False,
            "has_matching_set": False,
            "verified_source": True,
            "status": models.Item.ItemStatus.PUBLISHED,
        },
    )[0]
    _add_item_details(
        liz_lisa,
        languages=languages,
        colors=[colors["white"], colors["pink"], colors["blue"]],
        fabrics=[(fabrics["polyester"], Decimal("100"))],
        features=[
            features["sailor-collar"],
            features["long-sleeves"],
            features["skirt-pants"],
        ],
        collections=[collections["liz-lisa:2025 Standard Release"]],
        substyles=[substyles["classic"]],
        price_currency=currencies["JPY"],
        price_amount=Decimal("20800"),
        tags=[tags["print"]],
        translation_overrides={
            "en": {
                "name": "Sewing Bear Set-Up",
                "description": (
                    "[Design]\n"
                    "The original patterned set-up returns, printed with a charming motif of a handsome bear sewing.\n"
                    "Features a sailor collar and chest ribbon as key points of the design.\n"
                    "The bottoms are skirt pants, allowing easy coordination with blouses and versatile outfit styling.\n"
                    "[Details]\n"
                    "Set-up consisting of top and skirt-pants.\n"
                    "Top features sailor collar and decorative ribbon.\n"
                    "Skirt-pants provide both comfort and coverage for varied coordinates.\n"
                    "Available in White, Pink, and Blue (availability may vary).\n"
                    "Size: Free."
                ),
            },
            "ja": {
                "name": "ソーイングベア セットアップ",
                "description": (
                    "【デザイン】\n"
                    "イケメンなクマが裁縫しているモチーフをプリントした、オリジナル柄セットアップが再登場。\n"
                    "セーラーカラーと胸元のリボンがポイントです。\n"
                    "ボトムはブラウスとも合わせやすいスカパン仕様で、幅広いコーディネートが楽しめます。\n"
                    "【ディテール】\n"
                    "トップスとスカパンのセットアップ。\n"
                    "ホワイト・ピンク・ブルー展開（在庫状況は異なる場合があります）。\n"
                    "サイズ：フリー。"
                ),
            },
        },
        secondary_prices=[(currencies["USD"], Decimal("133.00"))],
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
        tags=[tags["solid"]],
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
    tags: list[models.Tag] | None = None,
    translation_overrides: dict[str, dict[str, str]] | None = None,
    secondary_prices: list[tuple[models.Currency, Decimal]] | None = None,
) -> None:
    translation_defaults = {
        "description": "A charming release featuring sugary motifs and ruffled trims.",
        "season": "Spring",
        "fit": "Regular",
        "length": "Knee length",
        "occasion": "Tea party",
    }
    overrides = translation_overrides or {}
    for code, language in languages.items():
        defaults = {
            "name": item.slug.replace("-", " ").title() if code != "ja" else "スイートドレス",
            **translation_defaults,
        }
        override_payload = overrides.get(code) if isinstance(overrides, dict) else None
        if isinstance(override_payload, dict):
            override_name = str(override_payload.get("name", ""))
            if override_name.strip():
                defaults["name"] = override_name
            override_description = override_payload.get("description")
            if isinstance(override_description, str) and override_description.strip():
                defaults["description"] = override_description
        models.ItemTranslation.objects.update_or_create(
            item=item,
            language=language,
            defaults=defaults,
        )

    models.ItemPrice.objects.update_or_create(
        item=item,
        currency=price_currency,
        source=models.ItemPrice.Source.ORIGIN,
        defaults={
            "amount": price_amount,
        },
    )
    if secondary_prices:
        for currency, amount in secondary_prices:
            models.ItemPrice.objects.update_or_create(
                item=item,
                currency=currency,
                source=models.ItemPrice.Source.CONVERTED,
                defaults={
                    "amount": amount,
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

    if tags:
        for index, tag in enumerate(tags):
            item_tag, created = models.ItemTag.objects.get_or_create(
                item=item,
                tag=tag,
                defaults={
                    "context": models.ItemTag.TagContext.PRIMARY
                    if index == 0
                    else models.ItemTag.TagContext.SECONDARY,
                },
            )
            if not created:
                desired_context = (
                    models.ItemTag.TagContext.PRIMARY if index == 0 else models.ItemTag.TagContext.SECONDARY
                )
                if item_tag.context != desired_context:
                    item_tag.context = desired_context
                    item_tag.save(update_fields=["context"])


