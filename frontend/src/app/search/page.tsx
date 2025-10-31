import Link from "next/link";

import SearchBar from "@/components/search-bar";
import {
  ActiveFilter,
  BrandFilterOption,
  CollectionFilterOption,
  FilterOption,
  ItemListResponse,
  ItemSummary,
  PriceSummary,
  getItemList,
} from "@/lib/api";

type SearchPageProps = {
  searchParams: Record<string, string | string[] | undefined>;
};

type SelectedFilters = ItemListResponse["selected"];

type OverrideRecord = Record<string, string | undefined | null>;

function normalizeParam(
  value: string | string[] | undefined
): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value ?? undefined;
}

function buildHref(selected: SelectedFilters, overrides: OverrideRecord): string {
  const params = new URLSearchParams();
  const keys = Object.keys(selected) as Array<keyof SelectedFilters>;

  for (const key of keys) {
    const override = overrides[key as string];
    if (override !== undefined && override !== null && override !== "") {
      params.set(key, override);
      continue;
    }

    if (override === "" || override === null) {
      continue;
    }

    const value = selected[key];
    if (value) {
      params.set(key, value);
    }
  }

  for (const [key, value] of Object.entries(overrides)) {
    if (!(key in selected) && value) {
      params.set(key, value);
    }
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
  } catch (error) {
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

  return (
    <ul className="flex flex-wrap gap-2">
      {activeFilters.map((filter) => (
        <li key={`${filter.param}-${filter.value}`}>
          <Link
            href={buildHref(selected, { [filter.param]: undefined })}
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
          href="/search"
          className="inline-flex items-center gap-2 rounded-full border border-transparent bg-rose-100 px-4 py-1.5 text-sm font-medium text-rose-600 transition hover:bg-rose-200 hover:text-rose-800"
        >
          Clear all
        </Link>
      </li>
    </ul>
  );
}

function FilterSection<T extends { name: string; selected: boolean }>({
  title,
  options,
  param,
  selected,
  getValue,
  renderSubtitle,
}: {
  title: string;
  options: T[];
  param: keyof SelectedFilters;
  selected: SelectedFilters;
  getValue: (option: T) => string;
  renderSubtitle?: (option: T) => string | null;
}) {
  if (options.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-rose-500">
        {title}
      </h3>
      <ul className="flex flex-col gap-2">
        {options.map((option) => {
          const value = getValue(option);
          const isSelected = option.selected;
          const nextValue = isSelected ? undefined : value;
          const href = buildHref(selected, { [param]: nextValue });
          const subtitle = renderSubtitle?.(option);

          return (
            <li key={`${param}-${value}`}>
              <Link
                href={href}
                className={`block rounded-xl border px-4 py-3 text-sm transition ${
                  isSelected
                    ? "border-rose-600 bg-rose-600 text-white"
                    : "border-rose-200 bg-white/90 text-rose-600 hover:border-rose-300 hover:text-rose-800"
                }`}
              >
                <span className="font-medium">{option.name}</span>
                {subtitle ? (
                  <span
                    className={`block text-xs ${
                      isSelected ? "text-rose-100" : "text-rose-300"
                    }`}
                  >
                    {subtitle}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ColorFilterSection({
  options,
  selected,
}: {
  options: FilterOption[];
  selected: SelectedFilters;
}) {
  if (options.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-rose-500">
        Colors
      </h3>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const value = option.id;
          const isSelected = option.selected;
          const nextValue = isSelected ? undefined : value;
          const href = buildHref(selected, { color: nextValue });

          return (
            <Link
              key={`color-${value}`}
              href={href}
              className={`flex items-center gap-2 rounded-full border px-3 py-1 text-sm transition ${
                isSelected
                  ? "border-rose-600 bg-rose-600 text-white"
                  : "border-rose-200 bg-white/90 text-rose-600 hover:border-rose-300 hover:text-rose-800"
              }`}
            >
              <span
                className="h-3 w-3 rounded-full border border-rose-200/70"
                style={{ backgroundColor: option.hex ?? "#d4d4d8" }}
              />
              <span>{option.name}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function ItemCard({ item }: { item: ItemSummary }) {
  const price = formatPrice(item.primary_price);

  return (
    <Link
      href={`/items/${encodeURIComponent(item.slug)}`}
      className="group flex flex-col gap-3 rounded-2xl border border-rose-100 bg-white/90 p-5 shadow-sm transition hover:-translate-y-1 hover:border-rose-200 hover:shadow-lg"
    >
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
  const normalizedParams = {
    q: normalizeParam(searchParams.q),
    brand: normalizeParam(searchParams.brand),
    category: normalizeParam(searchParams.category),
    tag: normalizeParam(searchParams.tag),
    color: normalizeParam(searchParams.color),
    collection: normalizeParam(searchParams.collection),
  };

  const data = await getItemList(normalizedParams);

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
        <SearchBar initialQuery={normalizedParams.q ?? ""} />
        <div className="flex flex-wrap items-center gap-3 text-sm text-rose-500">
          <span>
            {data.result_count.toLocaleString()} {data.result_count === 1 ? "result" : "results"}
          </span>
          {normalizedParams.q ? (
            <span>
              for <strong className="font-semibold text-rose-700">“{normalizedParams.q}”</strong>
            </span>
          ) : null}
        </div>
        <ActiveFilterChips activeFilters={data.active_filters} selected={data.selected} />
      </section>

      <div className="grid gap-12 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="flex flex-col gap-8">
          <FilterSection
            title="Brands"
            options={data.filters.brands}
            param="brand"
            selected={data.selected}
            getValue={(option) => option.slug}
            renderSubtitle={(option) =>
              option.item_count ? `${option.item_count} styles` : null
            }
          />
          <FilterSection
            title="Categories"
            options={data.filters.categories}
            param="category"
            selected={data.selected}
            getValue={(option) => option.id}
          />
          <FilterSection
            title="Tags"
            options={data.filters.tags}
            param="tag"
            selected={data.selected}
            getValue={(option) => option.id}
            renderSubtitle={(option) => (option.type ? option.type : null)}
          />
          <ColorFilterSection options={data.filters.colors} selected={data.selected} />
          <FilterSection
            title="Collections"
            options={data.filters.collections}
            param="collection"
            selected={data.selected}
            getValue={(option) => option.id}
            renderSubtitle={(option) =>
              option.year ? `${option.year} • ${option.brand_slug}` : option.brand_slug
            }
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
