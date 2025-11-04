import Link from "next/link";
import { notFound } from "next/navigation";

import FavoriteToggle from "@/components/favorite-toggle";
import ItemGallery from "@/components/item-gallery";
import {
  ColorSummary,
  ImageDetail,
  ItemDetail as ItemDetailPayload,
  ItemMetadataPayload,
  ItemVariantPayload,
  PriceSummary,
  getItemDetail,
} from "@/lib/api";

type ItemDetailPageProps = {
  params: Promise<{ slug: string }>;
};

const PLACEHOLDER_IMAGE_URL = "https://placehold.co/600x800?text=Jiraibrary";

function buildSearchUrl(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      search.set(key, value);
    }
  });
  const query = search.toString();
  return query ? `/search?${query}` : "/search";
}

function resolveDisplayName(item: ItemDetailPayload): string {
  const defaultLanguage = item.default_language;
  const exactMatch = defaultLanguage
    ? item.translations.find((translation) => translation.language === defaultLanguage)
    : undefined;
  if (exactMatch?.name) {
    return exactMatch.name;
  }
  const fallback = item.translations.find((translation) => translation.name);
  return fallback?.name ?? item.slug;
}

function formatPrice(price: PriceSummary | undefined | null): string | null {
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

function titleCase(value: string): string {
  return value
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function formatSlugLabel(value: string): string {
  return value
    .split("-")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function MetadataGrid({ metadata }: { metadata: ItemMetadataPayload }) {
  const entries = Object.entries(metadata).filter(([, value]) => value !== null && value !== "");
  if (entries.length === 0) {
    return null;
  }

  const labels: Record<string, string> = {
    pattern: "Pattern",
    sleeve_type: "Sleeve type",
    occasion: "Occasion",
    season: "Season",
    fit: "Fit",
    length: "Length",
    lining: "Lining",
    closure_type: "Closure",
    care_instructions: "Care",
    inspiration: "Inspiration",
    ai_confidence: "AI confidence",
  };

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-rose-900">Design notes</h2>
      <dl className="grid gap-4 sm:grid-cols-2">
        {entries.map(([key, rawValue]) => (
          <div key={key} className="rounded-xl border border-rose-100 bg-white/90 p-4">
            <dt className="text-xs font-semibold uppercase tracking-wide text-rose-400">
              {labels[key] ?? titleCase(key)}
            </dt>
            <dd className="mt-1 text-sm text-slate-700">{String(rawValue)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function VariantList({
  variants,
  colors,
}: {
  variants: ItemVariantPayload[];
  colors: ColorSummary[];
}) {
  if (variants.length === 0) {
    return null;
  }

  const colorById = new Map(colors.map((color) => [color.id, color.name]));

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-rose-900">Variants</h2>
      <ul className="flex flex-col gap-3">
        {variants.map((variant) => {
          const colorName = variant.color ? colorById.get(variant.color) : null;
          const noteEntries = Object.entries(variant.notes ?? {}).filter(
            ([, value]) => value !== null && value !== ""
          );

          return (
            <li
              key={variant.sku || variant.label}
              className="rounded-2xl border border-rose-100 bg-white/90 p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-rose-900">{variant.label}</p>
                  <p className="text-xs uppercase tracking-wide text-rose-400">
                    {titleCase(variant.stock_status)}
                  </p>
                </div>
                {variant.sku ? (
                  <span className="text-xs font-mono text-rose-400">SKU {variant.sku}</span>
                ) : null}
              </div>
              <div className="mt-3 flex flex-wrap gap-3 text-sm text-rose-500">
                {colorName ? <span>Color: {colorName}</span> : null}
                {variant.size_descriptor ? <span>Size: {variant.size_descriptor}</span> : null}
              </div>
              {noteEntries.length > 0 ? (
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-rose-500">
                  {noteEntries.map(([key, value]) => (
                    <li key={key}>
                      <span className="font-medium">{titleCase(key)}:</span> {String(value)}
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default async function ItemDetail({ params }: ItemDetailPageProps) {
  const resolvedParams = await params;
  let item: ItemDetailPayload;
  try {
    item = await getItemDetail(resolvedParams.slug);
  } catch {
    notFound();
  }

  if (!item) {
    notFound();
  }

  const displayName = resolveDisplayName(item);
  const primaryPrice = formatPrice(item.prices[0]);
  const metadata = item.metadata;
  const galleryImages: ImageDetail[] = item.gallery ?? [];
  const referenceGroups: Array<{ title: string; links: Array<{ label: string; href: string }> }> = [];

  if (item.brand) {
    referenceGroups.push({
      title: "Brand",
      links: [
        {
          label: item.brand.name ?? item.brand.slug,
          href: buildSearchUrl({ brand: item.brand.slug }),
        },
      ],
    });
  }

  if (item.category) {
    referenceGroups.push({
      title: "Category",
      links: [
        {
          label: item.category.name,
          href: buildSearchUrl({ category: item.category.id }),
        },
      ],
    });
  }

  if (item.tags.length > 0) {
    referenceGroups.push({
      title: "Tags",
      links: item.tags.map((tag) => ({
        label: tag.name,
        href: buildSearchUrl({ tag: tag.id }),
      })),
    });
  }

  if (item.colors.length > 0) {
    referenceGroups.push({
      title: "Colors",
      links: item.colors.map((color) => ({
        label: color.name,
        href: buildSearchUrl({ color: color.id }),
      })),
    });
  }

  if (item.collections.length > 0) {
    referenceGroups.push({
      title: "Collections",
      links: item.collections.map((collection) => ({
        label: `${collection.year ? `${collection.year} ` : ""}${collection.name}`.trim(),
        href: buildSearchUrl({ collection: collection.id }),
      })),
    });
  }

  const metadataEntries = metadata
    ? Object.entries(metadata).filter(([, value]) => value !== null && value !== "")
    : [];

  const extraMetadataEntries = Object.entries(item.extra_metadata ?? {}).filter(
    ([, value]) => value !== null && value !== ""
  );

  return (
    <div className="flex flex-col gap-10">
      <nav className="flex flex-wrap items-center gap-2 text-sm text-rose-500">
        <Link href="/" className="transition hover:text-rose-800">
          Home
        </Link>
        <span aria-hidden="true">/</span>
        <Link href="/search" className="transition hover:text-rose-800">
          Catalog
        </Link>
        {item.brand ? (
          <>
            <span aria-hidden="true">/</span>
            <Link
              href={buildSearchUrl({ brand: item.brand.slug })}
              className="transition hover:text-rose-800"
            >
              {item.brand.name ?? item.brand.slug}
            </Link>
          </>
        ) : null}
        <span aria-hidden="true">/</span>
        <span className="text-rose-900">{displayName}</span>
      </nav>

      <header className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <h1 className="text-4xl font-semibold tracking-tight text-rose-900">
            {displayName}
          </h1>
          {primaryPrice ? (
            <span className="rounded-full bg-rose-600 px-4 py-1 text-sm font-medium text-white">
              {primaryPrice}
            </span>
          ) : null}
          <FavoriteToggle itemSlug={item.slug} />
        </div>
        <div className="flex flex-wrap gap-3 text-sm text-rose-500">
          {item.brand ? <span>{item.brand.name ?? item.brand.slug}</span> : null}
          {item.release_year ? <span>• {item.release_year}</span> : null}
          {item.status ? <span>• {titleCase(item.status)}</span> : null}
          {item.has_matching_set ? <span>• Matching set</span> : null}
          {item.limited_edition ? <span>• Limited edition</span> : null}
        </div>
      </header>

      <section className="grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <article className="flex flex-col gap-8">
          <ItemGallery
            images={galleryImages}
            alt={displayName}
            placeholderUrl={PLACEHOLDER_IMAGE_URL}
          />
          <div className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold text-rose-900">Overview</h2>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-rose-100 bg-white/90 p-4">
                <dt className="text-xs font-semibold uppercase tracking-wide text-rose-400">
                  Default language
                </dt>
                <dd className="mt-1 text-sm text-slate-700">
                  {item.default_language ?? "Not specified"}
                </dd>
              </div>
              <div className="rounded-xl border border-rose-100 bg-white/90 p-4">
                <dt className="text-xs font-semibold uppercase tracking-wide text-rose-400">
                  Default currency
                </dt>
                <dd className="mt-1 text-sm text-slate-700">
                  {item.default_currency ?? "Not specified"}
                </dd>
              </div>
              <div className="rounded-xl border border-rose-100 bg-white/90 p-4">
                <dt className="text-xs font-semibold uppercase tracking-wide text-rose-400">
                  Release year
                </dt>
                <dd className="mt-1 text-sm text-slate-700">
                  {item.release_year ?? "Unknown"}
                </dd>
              </div>
              <div className="rounded-xl border border-rose-100 bg-white/90 p-4">
                <dt className="text-xs font-semibold uppercase tracking-wide text-rose-400">
                  Release date
                </dt>
                <dd className="mt-1 text-sm text-slate-700">
                  {item.release_date ?? "Unknown"}
                </dd>
              </div>
            </dl>
          </div>

          {metadata ? <MetadataGrid metadata={metadata} /> : null}

          {metadataEntries.length === 0 && metadata ? null : null}

          {item.substyles.length > 0 ? (
            <div className="flex flex-col gap-4">
              <h2 className="text-lg font-semibold text-rose-900">Substyles</h2>
              <div className="flex flex-wrap gap-2">
                {item.substyles.map((substyle) => (
                  <span
                    key={substyle.id}
                    className="rounded-full bg-rose-100 px-3 py-1 text-xs font-medium text-rose-600"
                  >
                    {substyle.name}
                    {substyle.weight ? ` · ${substyle.weight}` : ""}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {extraMetadataEntries.length > 0 ? (
            <div className="flex flex-col gap-4">
              <h2 className="text-lg font-semibold text-rose-900">Extra metadata</h2>
              <dl className="grid gap-3 sm:grid-cols-2">
                {extraMetadataEntries.map(([key, value]) => (
                  <div key={key} className="rounded-xl border border-rose-100 bg-white/90 p-4">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-rose-400">
                      {titleCase(key)}
                    </dt>
                    <dd className="mt-1 text-sm text-slate-700">{String(value)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}

          {item.translations.length > 0 ? (
            <div className="flex flex-col gap-4">
              <h2 className="text-lg font-semibold text-rose-900">Translations</h2>
              <ul className="flex flex-col gap-3">
                {item.translations.map((translation) => (
                  <li
                    key={`${translation.language}-${translation.name}`}
                    className="rounded-2xl border border-rose-100 bg-white/90 p-4 shadow-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-rose-900">
                        {translation.name}
                      </span>
                      <span className="text-xs uppercase tracking-wide text-rose-400">
                        {translation.language}
                      </span>
                    </div>
                    {translation.description ? (
                      <p className="mt-2 text-sm text-rose-500">
                        {translation.description}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <VariantList variants={item.variants} colors={item.colors} />

          {item.collections.length > 0 ? (
            <div className="flex flex-col gap-4">
              <h2 className="text-lg font-semibold text-rose-900">Collection placement</h2>
              <ul className="flex flex-col gap-3">
                {item.collections.map((collection) => {
                  const brandLabel = collection.brand_slug
                    ? formatSlugLabel(collection.brand_slug)
                    : null;

                  return (
                    <li
                      key={collection.id}
                      className="rounded-2xl border border-rose-100 bg-white/90 p-4 shadow-sm"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-rose-900">{collection.name}</p>
                          <p className="text-xs uppercase tracking-wide text-rose-400">
                            {collection.year ? `${collection.year}` : "Unknown year"}
                            {collection.season ? ` • ${titleCase(collection.season)}` : ""}
                          </p>
                        </div>
                        <span className="text-xs rounded-full bg-rose-100 px-3 py-1 font-medium text-rose-600">
                          {titleCase(collection.role)}
                        </span>
                      </div>
                      {collection.brand_slug && brandLabel ? (
                        <Link
                          href={buildSearchUrl({ brand: collection.brand_slug })}
                          className="mt-3 inline-flex text-xs text-rose-500 transition hover:text-rose-800"
                        >
                          View more from {brandLabel}
                        </Link>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          {item.fabrics.length > 0 ? (
            <div className="flex flex-col gap-4">
              <h2 className="text-lg font-semibold text-rose-900">Fabric composition</h2>
              <ul className="grid gap-3 sm:grid-cols-2">
                {item.fabrics.map((fabric) => (
                  <li
                    key={fabric.id}
                    className="rounded-xl border border-rose-100 bg-white/90 p-4"
                  >
                    <p className="text-sm font-semibold text-rose-900">{fabric.name}</p>
                    <p className="text-xs uppercase tracking-wide text-rose-400">
                      {fabric.percentage ? `${fabric.percentage}%` : "Blend"}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {item.features.length > 0 ? (
            <div className="flex flex-col gap-4">
              <h2 className="text-lg font-semibold text-rose-900">Features</h2>
              <ul className="flex flex-col gap-3">
                {item.features.map((feature) => (
                  <li
                    key={feature.id}
                    className="rounded-2xl border border-rose-100 bg-white/90 p-4 shadow-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-rose-900">{feature.name}</p>
                      <span className="text-xs uppercase tracking-wide text-rose-400">
                        {titleCase(feature.category)}
                      </span>
                    </div>
                    {feature.notes ? (
                      <p className="mt-2 text-sm text-rose-500">{feature.notes}</p>
                    ) : null}
                    {feature.is_prominent ? (
                      <span className="mt-3 inline-flex rounded-full bg-rose-100 px-3 py-1 text-xs font-medium text-rose-600">
                        Highlighted detail
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </article>

        <aside className="flex flex-col gap-8">
          {item.tags.length > 0 ? (
            <div className="rounded-2xl border border-rose-100 bg-white/90 p-5 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-rose-500">
                Tags
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {item.tags.map((tag) => (
                  <Link
                    key={tag.id}
                    href={buildSearchUrl({ tag: tag.id })}
                    className="rounded-full bg-rose-100 px-3 py-1 text-xs font-medium text-rose-600 transition hover:bg-rose-200 hover:text-rose-800"
                  >
                    {tag.name}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}

          {item.colors.length > 0 ? (
            <div className="rounded-2xl border border-rose-100 bg-white/90 p-5 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-rose-500">
                Palette
              </h2>
              <div className="mt-3 flex flex-wrap gap-3">
                {item.colors.map((color) => (
                  <Link
                    key={color.id}
                    href={buildSearchUrl({ color: color.id })}
                    className="flex items-center gap-2 rounded-full border border-rose-200 px-3 py-1 text-xs text-rose-600 transition hover:border-rose-300 hover:text-rose-800"
                  >
                    <span
                      className="h-3 w-3 rounded-full border border-rose-200/70"
                      style={{ backgroundColor: color.hex ?? "#d4d4d8" }}
                    />
                    {color.name}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}

          {item.prices.length > 0 ? (
            <div className="rounded-2xl border border-rose-100 bg-white/90 p-5 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-rose-500">
                Price history
              </h2>
              <ul className="mt-3 flex flex-col gap-2 text-sm text-rose-500">
                {item.prices.map((price) => (
                  <li key={`${price.currency}-${price.amount}-${price.source}`}>
                    <span className="font-medium text-rose-900">
                      {formatPrice(price) ?? `${price.amount} ${price.currency}`}
                    </span>{" "}
                    <span className="text-xs uppercase tracking-wide text-rose-400">
                      {price.source}
                    </span>
                    {price.rate_used ? (
                      <span className="text-xs text-rose-400"> • rate {price.rate_used}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {referenceGroups.length > 0 ? (
            <div className="rounded-2xl border border-rose-100 bg-white/90 p-5 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-rose-500">
                Related searches
              </h2>
              <div className="mt-3 flex flex-col gap-4">
                {referenceGroups.map((group) => (
                  <div key={group.title} className="flex flex-col gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-rose-400">
                      {group.title}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {group.links.map((link) => (
                        <Link
                          key={`${group.title}-${link.label}`}
                          href={link.href}
                          className="rounded-full bg-rose-100 px-3 py-1 text-xs font-medium text-rose-600 transition hover:bg-rose-200 hover:text-rose-800"
                        >
                          {link.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </aside>
      </section>
    </div>
  );
}
