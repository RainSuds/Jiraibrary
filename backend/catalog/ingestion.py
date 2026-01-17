from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup
from django.utils.text import slugify


@dataclass
class IngestionResult:
    raw: dict[str, Any]
    payload: dict[str, Any]


ALLOWED_SITES = {"tokyokawaiilife.com", "www.tokyokawaiilife.com", "tokyokawaiilife.jp", "www.tokyokawaiilife.jp"}


def ingest_tokyo_kawaii_life(
    url: str,
    language: str = "en",
    brand_override: str | None = None,
    brand_slug_override: str | None = None,
) -> IngestionResult:
    parsed = urlparse(url)
    if parsed.netloc not in ALLOWED_SITES:
        raise ValueError("Only Tokyo Kawaii Life domains are supported for ingestion right now.")
    response = requests.get(
        url,
        headers={"User-Agent": "JiraibraryIngestionBot/1.0 (+https://jiraibrary.com)"},
        timeout=15,
    )
    response.raise_for_status()
    html = response.text
    soup = BeautifulSoup(html, "html.parser")

    canonical = _get_canonical_url(soup)
    og_title = _get_meta_content(soup, "property", "og:title")
    og_image = _get_meta_content(soup, "property", "og:image")
    og_description = _get_meta_content(soup, "property", "og:description")

    product_schema = _extract_product_schema(soup)

    name = _first_truthy(
        product_schema.get("name") if isinstance(product_schema, dict) else None,
        og_title,
        soup.title.string.strip() if soup.title and soup.title.string else None,
    )
    description = _first_truthy(
        product_schema.get("description") if isinstance(product_schema, dict) else None,
        og_description,
    )
    brand = _extract_brand_name(product_schema)
    image = _extract_primary_image(product_schema) or og_image
    source_site = parsed.netloc

    if not name:
        raise ValueError("Unable to determine product title from the page.")
    if brand_override:
        brand = brand_override
    if not brand:
        raise ValueError("Unable to determine brand name from the page.")

    reference_urls = [entry for entry in [canonical, url] if entry]
    name_translation = {"language": language, "value": name}
    description_translation = {"language": language, "value": description} if description else None

    payload: dict[str, Any] = {
        "title": name,
        "brand_name": brand,
        "brand_slug": brand_slug_override or slugify(brand),
        "description": description or "",
        "reference_url": reference_urls[0] if reference_urls else url,
        "reference_urls": reference_urls,
        "image_url": image or "",
        "name_translations": [name_translation],
        "description_translations": [description_translation] if description_translation else [],
        "verified_source": True,
    }

    raw: dict[str, Any] = {
        "canonical": canonical,
        "og_title": og_title,
        "og_description": og_description,
        "og_image": og_image,
        "schema": product_schema,
        "source_site": source_site,
    }
    return IngestionResult(raw=raw, payload=payload)


def _get_canonical_url(soup: BeautifulSoup) -> str | None:
    link = soup.find("link", attrs={"rel": "canonical"})
    if link and link.get("href"):
        return str(link["href"]).strip()
    return None


def _get_meta_content(soup: BeautifulSoup, key: str, value: str) -> str | None:
    tag = soup.find("meta", attrs={key: value})
    if tag and tag.get("content"):
        return str(tag["content"]).strip()
    return None


def _extract_product_schema(soup: BeautifulSoup) -> dict[str, Any]:
    schemas: list[dict[str, Any]] = []
    for tag in soup.find_all("script", attrs={"type": "application/ld+json"}):
        try:
            payload = json.loads(tag.string or "")
        except json.JSONDecodeError:
            continue
        schemas.extend(_flatten_schema(payload))

    for schema in schemas:
        schema_type = schema.get("@type")
        if isinstance(schema_type, list):
            if any(entry.lower() == "product" for entry in schema_type if isinstance(entry, str)):
                return schema
        elif isinstance(schema_type, str) and schema_type.lower() == "product":
            return schema
    return {}


def _flatten_schema(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        flattened: list[dict[str, Any]] = []
        for entry in payload:
            flattened.extend(_flatten_schema(entry))
        return flattened
    if isinstance(payload, dict):
        if "@graph" in payload and isinstance(payload["@graph"], list):
            return [entry for entry in payload["@graph"] if isinstance(entry, dict)]
        return [payload]
    return []


def _extract_brand_name(schema: dict[str, Any]) -> str | None:
    brand = schema.get("brand") if isinstance(schema, dict) else None
    if isinstance(brand, dict):
        return str(brand.get("name") or "").strip() or None
    if isinstance(brand, str):
        return brand.strip() or None
    return None


def _extract_primary_image(schema: dict[str, Any]) -> str | None:
    image = schema.get("image") if isinstance(schema, dict) else None
    if isinstance(image, list):
        for entry in image:
            if isinstance(entry, str) and entry.strip():
                return entry.strip()
            if isinstance(entry, dict) and entry.get("url"):
                return str(entry["url"]).strip()
        return None
    if isinstance(image, dict) and image.get("url"):
        return str(image["url"]).strip()
    if isinstance(image, str):
        return image.strip() or None
    return None


def _first_truthy(*entries: Any) -> str | None:
    for entry in entries:
        if isinstance(entry, str) and entry.strip():
            return entry.strip()
    return None
