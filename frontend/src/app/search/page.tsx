import Image from "next/image";
import Link from "next/link";

import FilterPanel from "@/components/filter-panel";
import SearchBar from "@/components/search-bar";
import {
  ActiveFilter,
  ImagePreview,
  ItemListResponse,
  ItemSummary,
  PriceSummary,
  getItemList,
} from "@/lib/api";
import { resolveMediaUrl } from "@/lib/media";
import {
  MEASUREMENT_PARAM_MAP,
  type MeasurementSelectionKey,
} from "./filter-constants";

type SearchPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type SelectedFilters = ItemListResponse["selected"];

const PLACEHOLDER_IMAGE_URL = "https://placehold.co/600x800?text=Jiraibrary";

const MULTI_VALUE_KEYS = [
  "brand",
  "category",
  "subcategory",
  "style",
  "substyle",
  "tag",
  "color",
  "collection",
  "fabric",
  "feature",
] as const;

function ensureArray(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) {
    return value.filter((entry) => entry !== undefined && entry !== null && entry !== "");
  }
  if (value === undefined || value === null || value === "") {
    return [];
  }
  return [value];
}

function ensureSingle(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    for (const entry of value) {
      if (entry !== undefined && entry !== null && entry !== "") {
        return entry;
      }
    }
    return undefined;
  }
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  return value;
}

function buildClearHref(query: string | undefined): string {
  if (!query) {
    return "/search";
  }
  const params = new URLSearchParams();
  params.set("q", query);
  return `/search?${params.toString()}`;
}

function buildRemovalHref(selected: SelectedFilters, filter: ActiveFilter): string {
  const params = new URLSearchParams();

  if (selected.q && filter.param !== "q") {
    params.set("q", selected.q);
  }

  for (const key of MULTI_VALUE_KEYS) {
    const values = selected[key];
    for (const value of values) {
      const removeAll = filter.param === key && !filter.value_key;
      const removeSpecific = filter.param === key && filter.value_key === value;
      if (removeAll || removeSpecific) {
        continue;
      }
      params.append(key, value);
    }
  }

  for (const { key, param } of MEASUREMENT_PARAM_MAP) {
    const measurementValue = selected.measurement[key as MeasurementSelectionKey];
    if (measurementValue === null || measurementValue === undefined) {
      continue;
    }
    const removeAll = filter.param === param && !filter.value_key;
    const removeSpecific = filter.param === param && filter.value_key === `${measurementValue}`;
    if (removeAll || removeSpecific) {
      continue;
    }
    params.set(param, `${measurementValue}`);
  }

  for (const yearRange of selected.release_year_ranges) {
    const valueKey = yearRange.value_key;
    const removeRange = filter.param === "release_year_range" && filter.value_key === valueKey;
    if (removeRange) {
      continue;
    }
    const minPart = yearRange.min !== null && yearRange.min !== undefined ? `${yearRange.min}` : "";
    const maxPart = yearRange.max !== null && yearRange.max !== undefined ? `${yearRange.max}` : "";
    const serialized = maxPart ? `${minPart}:${maxPart}` : minPart;
    if (serialized) {
      params.append("release_year_range", serialized);
    }
  }

  let appendedPriceRange = false;
  for (const priceRange of selected.price_ranges) {
    const valueKey = priceRange.value_key;
    const removeRange = filter.param === "price_range" && filter.value_key === valueKey;
    if (removeRange) {
      continue;
    }
    const minPart = priceRange.min !== null && priceRange.min !== undefined ? `${priceRange.min}` : "";
    const maxPart = priceRange.max !== null && priceRange.max !== undefined ? `${priceRange.max}` : "";
    const serialized = `${priceRange.currency}:${minPart}:${maxPart}`;
    params.append("price_range", serialized);
    appendedPriceRange = true;
  }

  if (appendedPriceRange && selected.price_currency && !params.has("price_currency")) {
    params.set("price_currency", selected.price_currency);
  }

  const query = params.toString();
  return query ? `/search?${query}` : "/search";
}

function formatPrice(price: PriceSummary | null): string | null {
  if (!price) {
    return null;
  }

  const amount = Number(price.amount);
  if (Number.isNaN(amount)) {
    return `${price.amount} ${price.currency}`;
  }

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: price.currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${price.amount} ${price.currency}`;
  }
}

function ActiveFilterChips({
  activeFilters,
  selected,
}: {
  activeFilters: ActiveFilter[];
  selected: SelectedFilters;
}) {
  if (activeFilters.length === 0) {
    return null;
  }

  const clearHref = buildClearHref(selected.q ?? undefined);

  return (
    <ul className="flex flex-wrap gap-2">
      {activeFilters.map((filter) => (
        <li
          key={`${filter.param}-${filter.value}-${filter.value_key ?? ""}`}
        >
          <Link
            href={buildRemovalHref(selected, filter)}
            className="group inline-flex items-center gap-2 rounded-full border border-rose-200 bg-white/90 px-4 py-1.5 text-sm text-rose-600 transition hover:border-rose-300 hover:text-rose-800"
          >
            <span className="font-medium text-rose-800 group-hover:text-rose-900">
              {filter.label}:
            </span>
            <span>{filter.value}</span>
            <span aria-hidden="true">×</span>
          </Link>
        </li>
      ))}
      <li>
        <Link
          href={clearHref}
          className="inline-flex items-center gap-2 rounded-full border border-transparent bg-rose-100 px-4 py-1.5 text-sm font-medium text-rose-600 transition hover:bg-rose-200 hover:text-rose-800"
        >
          Clear all
        </Link>
      </li>
    </ul>
  );
}

function resolveImage(preview: ImagePreview | null): string {
  if (!preview || !preview.url) {
    return PLACEHOLDER_IMAGE_URL;
  }
  return resolveMediaUrl(preview.url) ?? PLACEHOLDER_IMAGE_URL;
}

function ItemCard({ item }: { item: ItemSummary }) {
  const price = formatPrice(item.primary_price);
  const imageUrl = resolveImage(item.cover_image);

  return (
    <Link
      href={`/items/${encodeURIComponent(item.slug)}`}
      className="group flex flex-col gap-3 rounded-2xl border border-rose-100 bg-white/90 p-5 shadow-sm transition hover:-translate-y-1 hover:border-rose-200 hover:shadow-lg"
    >
      <div
        className="relative overflow-hidden rounded-xl border border-rose-50 bg-rose-50"
        style={{ aspectRatio: "3 / 4" }}
      >
        <Image
          src={imageUrl}
          alt={`${item.name} cover`}
          fill
          sizes="(min-width: 1280px) 18vw, (min-width: 640px) 40vw, 80vw"
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          loading="lazy"
          unoptimized
        />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-rose-400">
          {item.brand?.name ?? "Independent"}
        </span>
        {price ? (
          <span className="text-sm font-medium text-rose-700 group-hover:text-rose-900">
            {price}
          </span>
        ) : null}
      </div>
      <h3 className="text-lg font-semibold text-rose-900 group-hover:text-rose-700">
        {item.name}
      </h3>
      <div className="flex flex-wrap gap-2 text-xs text-rose-500">
        {item.category ? <span>{item.category.name}</span> : null}
        {item.release_year ? <span>• {item.release_year}</span> : null}
        {item.has_matching_set ? <span>• Matching set</span> : null}
        {item.verified_source ? <span>• Verified source</span> : null}
      </div>
      {item.tags.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {item.tags.slice(0, 4).map((tag) => (
            <span
              key={tag.id}
              className="rounded-full bg-rose-100 px-3 py-1 text-xs font-medium text-rose-600"
            >
              {tag.name}
            </span>
          ))}
          {item.tags.length > 4 ? (
            <span className="text-xs text-rose-400">
              +{item.tags.length - 4} more
            </span>
          ) : null}
        </div>
      ) : null}
      {item.colors.length > 0 ? (
        <div className="flex items-center gap-2">
          {item.colors.slice(0, 5).map((color) => (
            <span
              key={color.id}
              className="h-3 w-3 rounded-full border border-rose-200/70"
              style={{ backgroundColor: color.hex ?? "#d4d4d8" }}
            />
          ))}
        </div>
      ) : null}
    </Link>
  );
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const resolvedSearchParams = await searchParams;

  const q = ensureSingle(resolvedSearchParams.q);
  const apiParams: Record<string, string | string[] | undefined> = {};

  if (q) {
    apiParams.q = q;
  }

  for (const key of MULTI_VALUE_KEYS) {
    const values = ensureArray(resolvedSearchParams[key]);
    if (values.length > 0) {
      apiParams[key] = values;
    }
  }

  for (const { param } of MEASUREMENT_PARAM_MAP) {
    const value = ensureSingle(resolvedSearchParams[param]);
    if (value !== undefined) {
      apiParams[param] = value;
    }
  }

  const yearRanges = ensureArray(resolvedSearchParams.release_year_range);
  if (yearRanges.length > 0) {
    apiParams.release_year_range = yearRanges;
  }

  const priceRanges = ensureArray(resolvedSearchParams.price_range);
  if (priceRanges.length > 0) {
    apiParams.price_range = priceRanges;
  }

  const priceCurrency = ensureSingle(resolvedSearchParams.price_currency);
  if (priceCurrency) {
    apiParams.price_currency = priceCurrency;
  }

  const data = await getItemList(apiParams);

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight text-rose-900">
            Catalog search
          </h1>
          <p className="text-sm text-rose-500">
            Combine keywords with filters to narrow down specific silhouettes, colors, and collections.
          </p>
        </div>
  <SearchBar initialQuery={q ?? ""} />
        <div className="flex flex-wrap items-center gap-3 text-sm text-rose-500">
          <span>
            {data.result_count.toLocaleString()} {data.result_count === 1 ? "result" : "results"}
          </span>
          {q ? (
            <span>
              for <strong className="font-semibold text-rose-700">“{q}”</strong>
            </span>
          ) : null}
        </div>
        <ActiveFilterChips
          activeFilters={data.active_filters}
          selected={data.selected}
        />
      </section>

      <div className="grid gap-12 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="flex flex-col gap-8">
          <FilterPanel
            filters={data.filters}
            selected={data.selected}
            query={q}
          />
        </aside>

        <section className="flex flex-col gap-6">
          {data.result_count === 0 ? (
            <div className="rounded-2xl border border-dashed border-rose-100 bg-white/90 p-10 text-center text-sm text-rose-500">
              <p className="font-medium text-rose-600">No matches yet.</p>
              <p>Adjust filters or try a different keyword.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {data.results.map((item) => (
                <ItemCard key={item.slug} item={item} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
