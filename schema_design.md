# J-Fashion Archive Database Schema

This reference captures the production-ready data model for the platform, expands the original proposal, and calls out relationships, constraints, indexing hints, and operational tables needed to support ingestion, moderation, analytics, and localization at scale.

---

## Conventions & Global Rules
- PostgreSQL 15+ with UUID primary keys (`gen_random_uuid()`); surrogate keys use the suffix `_id`.
- Every table has `created_at` and `updated_at` (`timestamptz`, default `now()` with trigger maintenance) unless otherwise noted.
- Soft deletes (if needed) surface as `deleted_at`; hard deletes reserved for GDPR-driven removals handled by stored procedures.
- Booleans default to `false`; enumerations use PostgreSQL `ENUM` types or reference tables where future extensibility is likely.
- JSONB fields store semi-structured payloads; provide GIN indexes where lookup by key/value is expected.
- Auditing and moderation rely on row-level security policies tied to the `User` role hierarchy.

---

## High-Level Entity Map
- **Core Catalog:** `Item`, `ItemTranslation`, `ItemPrice`, `ItemVariant`, `ItemMeasurement`, `ItemMetadata`
- **Reference & Taxonomy:** `Brand`, `BrandLink`, `Collection`, `Category`, `Subcategory`, `Substyle`, `Color`, `Fabric`, `Feature`, `Tag`, `TagTranslation`, `Language`, `Currency`
- **Media:** `Image`, `ImageLabel`, `ImageEmbedding`, `AssetAttribution`
- **Community & Curation:** `User`, `UserProfile`, `UserRole`, `Review`, `Comment`, `Favorite`, `OutfitSet`, `OutfitSetItem`, `UserFollow`
- **Bridge Tables:** `ItemTag`, `ItemColor`, `ItemSubstyle`, `ItemFabric`, `ItemCollection`, `ItemSetComponent`
- **Operations & Compliance:** `AuditLog`, `ModerationQueue`, `ModerationAction`, `SecurityConsent`, `Notification`, `UserActivity`, `AnalyticsSnapshot`, `SearchIndexQueue`, `PriceSyncRun`, `IngestionSource`, `IngestionJob`

---

## Core Catalog Entities

### Item (`catalog.item`)
| Column | Type | Constraints / Notes |
| --- | --- | --- |
| `item_id` | UUID PK | Primary key |
| `slug` | text | Unique per brand for SEO; unique index (`brand_id`, `slug`) |
| `brand_id` | UUID FK | References `brand.brand_id` |
| `category_id` | UUID FK | References `category.category_id`; cascade updates |
| `origin_country` | char(2) | ISO 3166-1 alpha-2 |
| `default_language` | text | ISO 639-1; FK → `language.code` |
| `default_currency` | char(3) | ISO 4217; FK → `currency.code` |
| `release_year` | smallint | Optional; check between 1970 and current_year + 1 |
| `release_date` | date | Nullable |
| `collaboration` | text | e.g., “BTSSB × Disney” |
| `limited_edition` | boolean | |
| `has_matching_set` | boolean | |
| `verified_source` | boolean | Set true after moderation |
| `status` | enum(`draft`,`pending_review`,`published`,`archived`) | Indexed for workflow |
| `submitted_by` | UUID FK | References `user.user_id` |
| `approved_at` | timestamptz | Timestamp of moderation approval |
| `extra_metadata` | jsonb | Scraped/AI data (e.g., original listing URL, vendor SKU) |

**Indexes:** `(brand_id, release_year DESC)`, `gin(extra_metadata jsonb_path_ops)`.

**Notes:** Rich text content is stored in translation tables; tagging, colors, substyles handled via M2M bridges.

### ItemTranslation (`catalog.item_translation`)
| Column | Type | Constraints / Notes |
| --- | --- | --- |
| `translation_id` | UUID PK | |
| `item_id` | UUID FK | References `catalog.item` on delete cascade |
| `language_code` | text | FK → `language.code`; unique with `item_id` & `dialect` |
| `dialect` | text | Optional (e.g., `en-US`) |
| `name` | text | Localized display name |
| `description` | text | Markdown/plain |
| `pattern` | text | |
| `fit` | text | |
| `length` | text | |
| `occasion` | text | |
| `season` | text | |
| `lining` | text | |
| `closure_type` | text | |
| `care_instructions` | text | |
| `source` | enum(`official`,`ai`,`user`) | |
| `quality` | enum(`draft`,`verified`) | |
| `auto_translated` | boolean | Flag for AI-created content |

**Indexes:** Unique (`item_id`, `language_code`, `dialect`); trigram index on `name` for search.

### ItemPrice (`catalog.item_price`)
| Column | Type | Constraints / Notes |
| --- | --- | --- |
| `price_id` | UUID PK | |
| `item_id` | UUID FK | |
| `currency_code` | char(3) | FK → `currency.code`; unique with `item_id` & `source` |
| `amount` | numeric(10,2) | Monetary amount |
| `source` | enum(`origin`,`converted`,`manual`) | |
| `rate_used` | numeric(12,6) | Exchange rate applied |
| `valid_from` | date | Range start; combine with `valid_to` for bitemporal tracking |
| `valid_to` | date | Nullable |
| `last_synced_at` | timestamptz | For currency refresh scheduling |

**Indexes:** `(item_id, currency_code)`, partial index on `source = 'origin'`.

### ItemVariant (`catalog.item_variant`)
| Column | Type | Constraints / Notes |
| --- | --- | --- |
| `variant_id` | UUID PK | |
| `item_id` | UUID FK | |
| `variant_label` | text | E.g., “Pink JSK”, “Size M” |
| `sku` | text | Optional vendor or internal SKU |
| `color_id` | UUID FK | Nullable link to canonical color |
| `size_descriptor` | text | Freeform size label |
| `stock_status` | enum(`available`,`limited`,`sold_out`,`unknown`) | Latest known availability |
| `notes` | jsonb | Additional structured variant data |

### ItemMeasurement (`catalog.item_measurement`)
| Column | Type | Constraints / Notes |
| --- | --- | --- |
| `measurement_id` | UUID PK | |
| `item_id` | UUID FK | |
| `variant_id` | UUID FK | Optional to tie measurements to variants |
| `is_one_size` | boolean | |
| `bust_cm` | numeric(6,2) | |
| `waist_cm` | numeric(6,2) | |
| `hip_cm` | numeric(6,2) | |
| `length_cm` | numeric(6,2) | |
| `sleeve_length_cm` | numeric(6,2) | |
| `hem_cm` | numeric(6,2) | |
| `heel_height_cm` | numeric(6,2) | |
| `bag_depth_cm` | numeric(6,2) | |
| `fit_notes` | text | Freeform text for sizing quirks |

### ItemMetadata (`catalog.item_metadata`)
| Column | Type | Constraints / Notes |
| --- | --- | --- |
| `metadata_id` | UUID PK | |
| `item_id` | UUID FK | Unique; one-to-one extension |
| `pattern` | enum or text | E.g., `solid`, `floral`, `print` |
| `sleeve_type` | text | |
| `occasion` | text | |
| `season` | text | |
| `fit` | text | |
| `length` | text | |
| `lining` | text | |
| `closure_type` | text | |
| `care_instructions` | text | |
| `inspiration` | text | Notes on design inspiration |
| `ai_confidence` | numeric(5,2) | Confidence score for AI-derived metadata |

---

## Reference & Taxonomy Entities

### Brand (`brand.brand`)
| Column | Type | Constraints / Notes |
| --- | --- | --- |
| `brand_id` | UUID PK | |
| `slug` | text | Unique |
| `names` | jsonb | Localized brand names |
| `descriptions` | jsonb | Localized bios |
| `country` | char(2) | Headquarters country |
| `founded_year` | smallint | |
| `icon_url` | text | |
| `official_site_url` | text | |
| `status` | enum(`active`,`discontinued`,`hiatus`) | |

**Supplements:** `BrandLink` table for social/shop URLs with type-labeled rows; `BrandSubstyle` bridge to emphasize aesthetics.

### Collection (`brand.collection`)
| Column | Type | Notes |
| --- | --- | --- |
| `collection_id` | UUID PK | |
| `brand_id` | UUID FK | |
| `name` | text | e.g., “Spring 2009 Gothic” |
| `season` | enum(`spring`,`summer`,`fall`,`winter`,`resort`) | |
| `year` | smallint | |
| `description` | text | |

### Category (`catalog.category`) & Subcategory (`catalog.subcategory`)

| Column | Type | Notes |
| --- | --- | --- |
| `category_id` | UUID PK | |
| `name` | text | Unique |
| `description` | text | |
| `is_gendered` | boolean | Flag for gender-specific cuts |

`Subcategory` references `category_id` and provides more granular taxonomy (e.g., `JSK`, `Skirt`, `Haori`). Items link to subcategories via `ItemCategoryAssignment` if multi-classification is required.

### Substyle (`catalog.substyle`)
 
| Column | Type | Notes |
| --- | --- | --- |
| `substyle_id` | UUID PK | |
| `name` | text | Unique |
| `description` | text | |
| `parent_substyle_id` | UUID FK | Allow nested hierarchies (e.g., `Sweet` → `Sailor`) |

### Color (`catalog.color`)
 
| Column | Type | Notes |
| --- | --- | --- |
| `color_id` | UUID PK | |
| `name` | text | |
| `hex_code` | char(7) | `#RRGGBB` |
| `lch_values` | jsonb | Optional color space for clustering |

### Fabric (`catalog.fabric`)
 
Records canonical fabric types (cotton, chiffon, etc.) and blends to support filtering and sustainability metrics.

### Feature (`catalog.feature`)
 
Defines repeatable construction and styling elements frequently referenced in listings.

| Column | Type | Notes |
| --- | --- | --- |
| `feature_id` | UUID PK | |
| `name` | text | Canonical term (e.g., “Ruffles”, “Elastic Waist”) |
| `description` | text | Optional definition or usage context |
| `synonyms` | jsonb | Alternate search keywords |
| `category` | enum(`construction`,`accessory`,`trim`,`attachment`) | Helps cluster similar features |
| `is_visible` | boolean | Toggle for deprecated or hidden features |

Localization follows the translation pattern if required: introduce `FeatureTranslation` mirroring `TagTranslation` (optional until needed).

### Tag (`catalog.tag`) & TagTranslation (`catalog.tag_translation`)
 
| Column | Type | Notes |
| --- | --- | --- |
| `tag_id` | UUID PK | |
| `name` | text | Base locale |
| `description` | text | |
| `type` | enum(`style`,`detail`,`material`,`motif`,`construction`) | |
| `is_featured` | boolean | Highlight for discovery |

Translations mirror the pattern used for items: unique (`tag_id`, `language_code`) with `source` and `quality` flags.

### Language (`core.language`) & Currency (`core.currency`)
 
Canonical lookup tables seeding ISO codes, English names, display order, and `is_supported` flags.

---

## Media Entities

### Image (`media.image`)
 
| Column | Type | Notes |
| --- | --- | --- |
| `image_id` | UUID PK | |
| `item_id` | UUID FK | Nullable for standalone brand assets |
| `brand_id` | UUID FK | Nullable |
| `variant_id` | UUID FK | Optional variant-level imagery |
| `storage_path` | text | S3 or CDN key |
| `type` | enum(`cover`,`gallery`,`detail`,`brand_logo`,`lookbook`) | |
| `caption` | text | Localizable via `ImageLabel` |
| `is_cover` | boolean | |
| `width`, `height` | integer | |
| `file_size_bytes` | integer | |
| `hash_signature` | text | Perceptual hash for dedupe |
| `dominant_color` | char(7) | |
| `source` | enum(`official`,`user_upload`,`ai_generated`) | |
| `license` | text | Usage rights |

**Supplementary tables:**

- `ImageLabel` records translated captions and accessibility text.
- `ImageEmbedding` stores CLIP vectors or similar for nearest-neighbor search (use `pgvector`).
- `AssetAttribution` maps credit lines and photographer metadata.

---

## Community & Curation

### User (`account.user`)
 
| Column | Type | Notes |
| --- | --- | --- |
| `user_id` | UUID PK | |
| `username` | citext | Unique, case-insensitive |
| `email` | citext | Unique |
| `password_hash` | text | BCrypt/Argon2 |
| `role_id` | UUID FK | Links to `UserRole` |
| `date_joined` | timestamptz | |
| `last_login_at` | timestamptz | |

`UserProfile` extends with bio, pronouns, location, preferred languages, linked social handles, and `profile_picture`.

### UserRole (`account.user_role`)
 
Defines RBAC permissions (`admin`, `moderator`, `contributor`, `member`, `readonly`).

### Review (`social.review`)
 
| Column | Type | Notes |
| --- | --- | --- |
| `review_id` | UUID PK | |
| `item_id` | UUID FK | |
| `user_id` | UUID FK | |
| `rating` | smallint | 1–5 with check constraint |
| `title` | text | Optional headline |
| `body` | text | Markdown supported |
| `is_verified_purchase` | boolean | |
| `date_submitted` | timestamptz | |

### Comment (`social.comment`)
 
Threaded discussions on items, collections, or outfits with `parent_comment_id` self-reference, soft-delete support, and moderation status.

### Favorite (`social.favorite`)
 
Composite PK (`user_id`, `item_id`); `created_at` timestamp.

### OutfitSet (`social.outfit_set`)
 
| Column | Type | Notes |
| --- | --- | --- |
| `set_id` | UUID PK | |
| `name` | text | |
| `description` | text | |
| `created_by` | UUID FK | |
| `visibility` | enum(`private`,`unlisted`,`public`) | |

`OutfitSetItem` bridges sets to items with ordering (`position`) and optional `styling_notes` jsonb per component.

### UserFollow (`social.user_follow`)
 
Stores follower relationships (`follower_id`, `followed_id`, `created_at`) with unique composite index.

---

## Bridge Tables (Many-to-Many)

| Table | Columns | Notes |
| --- | --- | --- |
| `catalog.item_tag` | `item_id` FK, `tag_id` FK, `context` enum(`primary`,`secondary`), `confidence` numeric(4,2) | GIN index on tag for filtering |
| `catalog.item_color` | `item_id`, `color_id`, `is_primary` boolean | |
| `catalog.item_substyle` | `item_id`, `substyle_id`, `weight` numeric(4,2) | Weight scores aesthetic alignment |
| `catalog.item_fabric` | `item_id`, `fabric_id`, `percentage` numeric(5,2) | Sum constraint via trigger |
| `catalog.item_feature` | `item_id`, `feature_id`, `is_prominent` boolean, `notes` text | Captures construction details like ruffles or detachable sleeves |
| `catalog.item_collection` | `item_id`, `collection_id`, `role` enum(`mainline`,`special`,`collaboration`) | |
| `social.item_set_component` | `set_id`, `item_id`, `position` integer | Maintains curated order |
| `brand.brand_substyle` | `brand_id`, `substyle_id` | Connects brands to core aesthetics |

All bridge tables include `created_at` for auditability; composite primary keys enforce uniqueness.

---

## Operations, Moderation & Analytics

### AuditLog (`ops.audit_log`)
 
| Column | Type | Notes |
| --- | --- | --- |
| `log_id` | UUID PK | |
| `action` | text | Machine-readable event name |
| `actor_id` | UUID FK | User performing action |
| `target_type` | text | E.g., `item`, `image`, `review` |
| `target_id` | UUID | Polymorphic reference |
| `metadata` | jsonb | Before/after snapshots |
| `ip_address` | inet | |

### ModerationQueue (`ops.moderation_queue`) & ModerationAction (`ops.moderation_action`)
 
Track submissions requiring review (new items, edits, reports). Actions capture decisions, notes, and escalation path.

### SecurityConsent (`ops.security_consent`)
 
| Column | Type | Notes |
| --- | --- | --- |
| `consent_id` | UUID PK | |
| `user_id` | UUID FK | |
| `consent_type` | enum(`data_collection`,`email_marketing`,`ai_processing`) | |
| `date_given` | timestamptz | |
| `change_description` | text | Historical log |
| `change_timestamp` | timestamptz | |

### Notification (`ops.notification`)
 
Stores system- or user-generated notifications with templated payloads and read receipts per recipient.

### UserActivity (`ops.user_activity`)
 
Event store for timeline analytics (`event_type`, `actor_id`, `target_id`, `payload` jsonb). Supports generating feed stories and measuring engagement.

### AnalyticsSnapshot (`analytics.analytics_snapshot`)
 
Time-series metrics aggregated daily (`recorded_at`, `item_id`, `views`, `likes`, `shares`, `popularity_score`, `source`). Materialized views drive dashboards.

### SearchIndexQueue (`ops.search_index_queue`)
 
Captures entities requiring re-indexing in external search services (`entity_type`, `entity_id`, `priority`, `attempts`, `last_attempt_at`).

### PriceSyncRun (`ops.price_sync_run`)
 
Logs currency conversion batches: `run_id`, `started_at`, `completed_at`, `status`, `records_processed`, `error_summary`.

### IngestionSource (`ops.ingestion_source`) & IngestionJob (`ops.ingestion_job`)
 
Maintain provenance for scraped/imported data with job-level status, last success timestamp, and error payloads for retry pipelines.

---

## Search & Indexing Considerations
 
- Use materialized views for denormalized search documents combining item, brand, tags, and latest pricing.
- Maintain trigram indexes on localized `name` fields for fuzzy matching; pair with `pg_search` or Elasticsearch.
- Consider `pgvector` for semantic similarity on `ImageEmbedding` and textual embeddings.

---

## Data Quality & Governance Notes
 
- Add unique constraints and triggers to stop duplicate items: e.g., unique `(brand_id, default_language, names->>'default')` where applicable.
- Cron-driven jobs refresh exchange rates and invalidate stale `ItemPrice` rows.
- Periodic AI translation review: queue flagged rows (`auto_translated = true`, `quality = 'draft'`) for moderator approval.
- Soft deletes cascade to dependent tables via `deleted_at` triggers where necessary (items → translations, prices, associations).
- Versioning: consider `temporal_tables` or `audit triggers` on `catalog.item` for edit history.

---

## Future Enhancements
 
- Internationalization: add `LocalePreference` per user and per brand for prioritized display order.
- Sustainability metrics: introduce `SourcingCertification`, `ManufacturingLocation`, and traceability joins to underpin ethical sourcing filters.
- AI assist: persist `Recommendation` and `Similarity` tables to store offline-computed nearest neighbors for outfits.
- Marketplace integration: add `Retailer`, `RetailerListing`, and `AffiliateLink` tables to model live availability.
- Event tracking: extend analytics with cohort tables (retention, conversion) and integrate with CDP via CDC streams.

---

This schema design can be used as the foundation for ERD tooling, migration scaffolding, and alignment with backend service boundaries. Convert sections into DDL with a consistent naming strategy (`schema.table`) to ensure maintainability across environments.
