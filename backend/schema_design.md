# Catalog Schema Reference (Django 5.2)

This document mirrors the current Django models under `backend/catalog/models.py`. Every model inherits from `TimeStampedUUIDModel`, giving each table a UUID primary key named `id` and `created_at` / `updated_at` timestamp columns.

---

## Reference Tables

### Language (`catalog_language`)

| Field | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key |
| `code` | varchar(10) | Unique language identifier (ISO 639-1/2) |
| `name` | varchar(128) | English display name |
| `native_name` | varchar(128) | Optional native script |
| `is_supported` | bool | Toggles availability in UI |

### Currency (`catalog_currency`)

| Field | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key |
| `code` | char(3) | ISO 4217; unique |
| `name` | varchar(64) | |
| `symbol` | varchar(8) | Optional display symbol |
| `is_active` | bool | Marks currencies eligible for pricing |

---

## Brand & Taxonomy

### Brand (`catalog_brand`)

| Field | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key |
| `slug` | varchar(255) | Unique identifier used in URLs |
| `names` | jsonb | Localised names keyed by language code |
| `descriptions` | jsonb | Localised descriptions |
| `country` | char(2) | Optional ISO 3166 code |
| `founded_year` | smallint | 1800–2100 guard rails |
| `icon_url` | varchar | Optional image URL |
| `official_site_url` | varchar | |
| `status` | enum(`active`,`discontinued`,`hiatus`) | Defaults to `active` |

#### BrandTranslation (`catalog_brandtranslation`)

| Field | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key |
| `brand_id` | uuid FK → brand | |
| `language_id` | uuid FK → language | One translation per language |
| `name` | varchar(255) | Mandatory localized name |
| `description` | text | Optional localized profile |

#### BrandStyle (`catalog_brandstyle`)

| Field | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key |
| `brand_id` | uuid FK → brand | |
| `style_id` | uuid FK → style | |
| `is_primary` | bool | Marks canonical aesthetic |

#### BrandSubstyle (`catalog_brandsubstyle`)

| Field | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key |
| `brand_id` | uuid FK → brand | |
| `substyle_id` | uuid FK → substyle | |
| `notes` | text | Optional curation notes |

### Style (`catalog_style`)

| Field | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key |
| `name` | varchar(128) | Unique aesthetic name |
| `slug` | varchar(128) | Unique slug |
| `description` | text | Optional summary |

### Substyle (`catalog_substyle`)

| Field | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key |
| `style_id` | uuid FK → style | Nullable temporarily during migration cleanup |
| `name` | varchar(128) | Unique within a style |
| `slug` | varchar(128) | Globally unique slug |
| `description` | text | Optional detail |

### Category (`catalog_category`)

| Field | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key |
| `name` | varchar(128) | Unique category label |
| `slug` | varchar(128) | Unique slug |
| `description` | text | Optional |

### Subcategory (`catalog_subcategory`)

| Field | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key |
| `category_id` | uuid FK → category | |
| `name` | varchar(128) | Unique within a category |
| `slug` | varchar(128) | Unique slug |
| `description` | text | Optional |

### Color (`catalog_color`)

| Field | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key |
| `name` | varchar(64) | |
| `hex_code` | char(7) | Optional `#RRGGBB` |
| `lch_values` | jsonb | Optional perceptual colour payload |

### Fabric (`catalog_fabric`)

| Field | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key |
| `name` | varchar(64) | Unique |
| `description` | text | Optional |

### Feature (`catalog_feature`)

| Field | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key |
| `name` | varchar(128) | Unique |
| `description` | text | Optional |
| `synonyms` | jsonb | Alternate search terms |
| `category` | enum(`construction`,`accessory`,`trim`,`attachment`) | Defaults to `construction` |
| `is_visible` | bool | Feature toggle |

### Tag (`catalog_tag`)

| Field | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key |
| `name` | varchar(128) | Unique |
| `slug` | varchar(128) | Unique |
| `description` | text | Optional |
| `type` | enum(`style`,`detail`,`material`,`motif`,`construction`) | Defaults to `detail` |
| `is_featured` | bool | Marks tags for homepage surfacing |

#### TagTranslation (`catalog_tagtranslation`)

| Field | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key |
| `tag_id` | uuid FK → tag | |
| `language_id` | uuid FK → language | One entry per language |
| `name` | varchar(128) | Localised name |
| `description` | text | Optional localization |
| `source` | enum(`official`,`ai`,`user`) | Defaults to `user` |
| `quality` | enum(`draft`,`verified`) | Defaults to `draft` |
| `auto_translated` | bool | Flags AI content |

### Collection (`catalog_collection`)

| Field | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key |
| `brand_id` | uuid FK → brand | |
| `name` | varchar(255) | |
| `season` | enum(`spring`,`summer`,`fall`,`winter`,`resort`) | Optional |
| `year` | smallint | 1900–2100 guard rails |
| `description` | text | Optional |

---

## Item Lifecycle

### Item (`catalog_item`)

| Field | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key |
| `slug` | varchar(255) | Unique per item |
| `brand_id` | uuid FK → brand | |
| `category_id` | uuid FK → category | Nullable |
| `subcategory_id` | uuid FK → subcategory | Nullable |
| `origin_country` | char(2) | Optional |
| `default_language_id` | uuid FK → language | Nullable |
| `default_currency_id` | uuid FK → currency | Nullable |
| `release_year` | smallint | 1970–2100 guard rails |
| `release_date` | date | Optional |
| `collaboration` | varchar(255) | Optional |
| `limited_edition` | bool | |
| `has_matching_set` | bool | |
| `verified_source` | bool | |
| `status` | enum(`draft`,`pending_review`,`published`,`archived`) | Defaults to `draft` |
| `submitted_by_id` | uuid FK → auth user | Nullable |
| `approved_at` | timestamptz | Optional moderation timestamp |
| `extra_metadata` | jsonb | Flexible metadata (e.g. listing URLs) |

Many-to-many relationships use explicit through models:

- `tags` ↔ `ItemTag`
- `colors` ↔ `ItemColor`
- `substyles` ↔ `ItemSubstyle`
- `fabrics` ↔ `ItemFabric`
- `features` ↔ `ItemFeature`
- `collections` ↔ `ItemCollection`

### ItemTranslation (`catalog_itemtranslation`)

| Field | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key |
| `item_id` | uuid FK → item | cascade delete |
| `language_id` | uuid FK → language | |
| `dialect` | varchar(32) | Optional |
| `name` | varchar(255) | Localised item title |
| `description` | text | Optional |
| `pattern` | varchar(255) | Optional |
| `fit` | varchar(255) | Optional |
| `length` | varchar(255) | Optional |
| `occasion` | varchar(255) | Optional |
| `season` | varchar(255) | Optional |
| `lining` | varchar(255) | Optional |
| `closure_type` | varchar(255) | Optional |
| `care_instructions` | text | Optional |
| `source` | enum(`official`,`ai`,`user`) | Defaults to `user` |
| `quality` | enum(`draft`,`verified`) | Defaults to `draft` |
| `auto_translated` | bool | Flags machine translations |

### ItemPrice (`catalog_itemprice`)

| Field | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key |
| `item_id` | uuid FK → item | |
| `currency_id` | uuid FK → currency | |
| `amount` | numeric(10,2) | Monetary value |
| `source` | enum(`origin`,`converted`,`manual`) | Defaults to `origin` |
| `rate_used` | numeric(12,6) | Optional exchange rate |
| `valid_from` | date | Optional start |
| `valid_to` | date | Optional end |
| `last_synced_at` | timestamptz | Optional |

### ItemVariant (`catalog_itemvariant`)

| Field | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key |
| `item_id` | uuid FK → item | |
| `variant_label` | varchar(255) | Display name |
| `sku` | varchar(255) | Optional SKU |
| `color_id` | uuid FK → color | Nullable |
| `size_descriptor` | varchar(128) | Optional |
| `stock_status` | enum(`available`,`limited`,`sold_out`,`unknown`) | Defaults to `unknown` |
| `notes` | jsonb | Additional details |

### ItemMeasurement (`catalog_itemmeasurement`)

| Field | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key |
| `item_id` | uuid FK → item | |
| `variant_id` | uuid FK → itemvariant | Nullable |
| `is_one_size` | bool | |
| `bust_cm` | numeric(6,2) | Optional |
| `waist_cm` | numeric(6,2) | Optional |
| `hip_cm` | numeric(6,2) | Optional |
| `length_cm` | numeric(6,2) | Optional |
| `sleeve_length_cm` | numeric(6,2) | Optional |
| `hem_cm` | numeric(6,2) | Optional |
| `heel_height_cm` | numeric(6,2) | Optional |
| `bag_depth_cm` | numeric(6,2) | Optional |
| `fit_notes` | text | Optional |

### ItemMetadata (`catalog_itemmetadata`)

| Field | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key |
| `item_id` | uuid FK → item | One-to-one |
| `pattern` | varchar(64) | Optional |
| `sleeve_type` | varchar(128) | Optional |
| `occasion` | varchar(128) | Optional |
| `season` | varchar(128) | Optional |
| `fit` | varchar(128) | Optional |
| `length` | varchar(128) | Optional |
| `lining` | varchar(128) | Optional |
| `closure_type` | varchar(128) | Optional |
| `care_instructions` | text | Optional |
| `inspiration` | text | Optional |
| `ai_confidence` | numeric(5,2) | Optional |

### Image (`catalog_image`)

| Field | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key |
| `item_id` | uuid FK → item | Nullable |
| `brand_id` | uuid FK → brand | Nullable |
| `variant_id` | uuid FK → itemvariant | Nullable |
| `storage_path` | varchar(512) | Asset key |
| `type` | enum(`cover`,`gallery`,`detail`,`brand_logo`,`lookbook`) | Defaults to `gallery` |
| `caption` | text | Optional |
| `is_cover` | bool | |
| `width` | int | Optional |
| `height` | int | Optional |
| `file_size_bytes` | bigint | Optional |
| `hash_signature` | varchar(255) | Optional |
| `dominant_color` | char(7) | Optional |
| `source` | varchar(32) | Optional |
| `license` | varchar(255) | Optional |

---

## Through Tables

| Table | Purpose | Key Fields |
| --- | --- | --- |
| `catalog_itemtag` | Item ↔ Tag | `item_id`, `tag_id`, `context`, `confidence` |
| `catalog_itemcolor` | Item ↔ Color | `item_id`, `color_id`, `is_primary` |
| `catalog_itemsubstyle` | Item ↔ Substyle | `item_id`, `substyle_id`, `weight` |
| `catalog_itemfabric` | Item ↔ Fabric | `item_id`, `fabric_id`, `percentage` |
| `catalog_itemfeature` | Item ↔ Feature | `item_id`, `feature_id`, `is_prominent`, `notes` |
| `catalog_itemcollection` | Item ↔ Collection | `item_id`, `collection_id`, `role` |

Each through table inherits timestamps, enforces `unique_together` on the foreign keys, and provides ordering metadata in Django for predictable admin display.

---

## Implementation Notes

- All UUIDs are generated in Django (`uuid.uuid4`) and map to PostgreSQL `uuid` columns.
- `created_at` / `updated_at` capture audit timestamps automatically; there is no soft-delete column at present.
- JSON-heavy fields (`Brand.names`, `Item.extra_metadata`, etc.) reside in PostgreSQL `jsonb` columns to support flexible payloads.
- `Substyle.style` is currently nullable to support legacy data migration; future clean-up will enforce a non-null foreign key.
- Django admin exposes `BrandStyle`, `BrandSubstyle`, and brand translations through inlines; `filter_horizontal` is avoided due to explicit through models.
- The seed command (`management/commands/seed_catalog.py`) currently provisions a minimal baseline of languages, currencies, categories, styles/substyles, and a handful of brands.

This document should be regenerated whenever fields are added, renamed, or relationships change to keep AWS deployment artefacts and ERD diagrams accurate.
