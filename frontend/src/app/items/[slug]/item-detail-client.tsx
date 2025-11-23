"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import FavoriteToggle from "@/components/favorite-toggle";
import ItemGallery from "@/components/item-gallery";
import { useAuth } from "@/components/auth-provider";
import {
  ImageDetail,
  ItemDetail as ItemDetailPayload,
  ItemPriceDetail,
  ItemSummary,
  PriceSummary,
  getItemList,
} from "@/lib/api";

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

function titleCase(value: string): string {
  return value
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }
  try {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function getMetadataText(meta: Record<string, unknown> | null | undefined, key: string): string | null {
  if (!meta) {
    return null;
  }
  const raw = meta[key];
  if (typeof raw === "string" && raw.trim().length > 0) {
    return raw.trim();
  }
  return null;
}

function formatPrice(price: ItemPriceDetail | null): string | null {
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

function formatPriceSummary(price: PriceSummary | null | undefined): string | null {
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

function selectPrice(prices: ItemPriceDetail[], preferredCurrency: string): ItemPriceDetail | null {
  if (!prices || prices.length === 0) {
    return null;
  }
  const preferred = prices.find((price) => price.currency?.toUpperCase() === preferredCurrency.toUpperCase());
  return preferred ?? prices[0];
}

function resolveDisplayName(item: ItemDetailPayload, preferredLanguage: string): string {
  const normalized = preferredLanguage.toLowerCase();
  const direct = item.translations.find((translation) => translation.language?.toLowerCase() === normalized && translation.name);
  if (direct?.name) {
    return direct.name;
  }
  const defaultLanguage = item.default_language?.toLowerCase();
  const defaultMatch = defaultLanguage
    ? item.translations.find((translation) => translation.language?.toLowerCase() === defaultLanguage && translation.name)
    : undefined;
  if (defaultMatch?.name) {
    return defaultMatch.name;
  }
  const fallback = item.translations.find((translation) => translation.name);
  return fallback?.name ?? item.slug;
}

function filterTranslations(item: ItemDetailPayload, preferredLanguage: string) {
  const normalized = preferredLanguage.toLowerCase();
  const entries = item.translations.filter((translation) => translation.language?.toLowerCase() === normalized);
  return entries.length > 0 ? entries : item.translations;
}

type ItemDetailClientProps = {
  item: ItemDetailPayload;
};

export default function ItemDetailClient({ item }: ItemDetailClientProps) {
  const { user } = useAuth();
  const preferredLanguage = (user?.preferred_language ?? "en").toLowerCase();
  const preferredCurrency = (user?.preferred_currency ?? "USD").toUpperCase();

  const displayName = useMemo(() => resolveDisplayName(item, preferredLanguage), [item, preferredLanguage]);
  const visibleTranslations = useMemo(() => filterTranslations(item, preferredLanguage), [item, preferredLanguage]);
  const primaryPriceEntry = useMemo(() => selectPrice(item.prices, preferredCurrency), [item.prices, preferredCurrency]);
  const primaryPrice = formatPrice(primaryPriceEntry);
  const galleryImages: ImageDetail[] = item.gallery ?? [];
  const orderedPrices = useMemo(() => {
    if (!primaryPriceEntry) {
      return item.prices;
    }
    return [primaryPriceEntry, ...item.prices.filter((price) => price !== primaryPriceEntry)];
  }, [item.prices, primaryPriceEntry]);
  const styleFamilies = useMemo(() => {
    const map = new Map<string, { slug: string; name: string }>();
    item.substyles.forEach((substyle) => {
      if (substyle.style && !map.has(substyle.style.slug)) {
        map.set(substyle.style.slug, {
          slug: substyle.style.slug,
          name: substyle.style.name,
        });
      }
    });
    return Array.from(map.values());
  }, [item.substyles]);
  const primaryCollectionId = item.collections[0]?.id ?? null;
  const brandSlug = item.brand?.slug ?? null;
  const subcategoryId = item.subcategory?.id ?? null;
  const categoryId = item.category?.id ?? null;
  const primaryTagId = item.tags[0]?.id ?? null;
  const relatedSeed = useMemo(() => {
    if (primaryCollectionId) {
      return { param: "collection", value: primaryCollectionId } as const;
    }
    if (brandSlug) {
      return { param: "brand", value: brandSlug } as const;
    }
    if (subcategoryId) {
      return { param: "subcategory", value: subcategoryId } as const;
    }
    if (categoryId) {
      return { param: "category", value: categoryId } as const;
    }
    if (primaryTagId) {
      return { param: "tag", value: primaryTagId } as const;
    }
    return null;
  }, [primaryCollectionId, brandSlug, subcategoryId, categoryId, primaryTagId]);
  const [relatedItems, setRelatedItems] = useState<ItemSummary[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(false);

  useEffect(() => {
    const seed = relatedSeed;
    if (!seed) {
      setRelatedItems([]);
      return;
    }
    const { param, value } = seed;
    let cancelled = false;
    async function loadRelatedItems() {
      setRelatedLoading(true);
      try {
        const response = await getItemList({
          [param]: value,
          page_size: "12",
        });
        if (cancelled) {
          return;
        }
        const filtered = response.results.filter((candidate) => candidate.slug !== item.slug);
        setRelatedItems(filtered.slice(0, 4));
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load related items", error);
          setRelatedItems([]);
        }
      } finally {
        if (!cancelled) {
          setRelatedLoading(false);
        }
      }
    }
    loadRelatedItems();
    return () => {
      cancelled = true;
    };
  }, [item.slug, relatedSeed]);
  const importantInfoRows = useMemo(
    () => [
      {
        label: "Brand",
        chips: item.brand
          ? [
              {
                key: `brand-${item.brand.slug}`,
                label: item.brand.name ?? item.brand.slug,
                href: buildSearchUrl({ brand: item.brand.slug }),
              },
            ]
          : [],
      },
      {
        label: "Category",
        chips: item.category
          ? [
              {
                key: `category-${item.category.id}`,
                label: item.category.name,
                href: buildSearchUrl({ category: item.category.id }),
              },
            ]
          : [],
      },
      {
        label: "Subcategory",
        chips: item.subcategory
          ? [
              {
                key: `subcategory-${item.subcategory.id}`,
                label: item.subcategory.name,
                href: buildSearchUrl({ subcategory: item.subcategory.id }),
              },
            ]
          : [],
      },
      {
        label: "Style",
        chips: styleFamilies.map((style) => ({
          key: `style-${style.slug}`,
          label: style.name,
          href: buildSearchUrl({ style: style.slug }),
        })),
      },
      {
        label: "Substyle",
        chips: item.substyles.map((substyle) => ({
          key: `substyle-${substyle.id}`,
          label: substyle.name,
          href: buildSearchUrl({ substyle: substyle.slug }),
        })),
      },
      {
        label: "Feature",
        chips: item.features.map((feature) => ({
          key: `feature-${feature.id}`,
          label: feature.name,
          href: buildSearchUrl({ feature: feature.id }),
        })),
      },
      {
        label: "Tags",
        chips: item.tags.map((tag) => ({
          key: `tag-${tag.id}`,
          label: tag.name,
          href: buildSearchUrl({ tag: tag.id }),
        })),
      },
    ],
    [item.brand, item.category, item.features, item.subcategory, item.substyles, item.tags, styleFamilies]
  );
  const extraMetadataEntries = Object.entries(item.extra_metadata ?? {}).filter(
    ([, value]) => value !== null && value !== "",
  );
  const metadataSeason =
    typeof item.metadata?.season === "string" && item.metadata.season.trim().length > 0
      ? item.metadata.season.trim()
      : null;
  const metadataFit =
    typeof item.metadata?.fit === "string" && item.metadata.fit.trim().length > 0
      ? item.metadata.fit.trim()
      : null;
  const approverName =
    getMetadataText(item.extra_metadata, "approver") ?? getMetadataText(item.extra_metadata, "approved_by");
  const editorName =
    getMetadataText(item.extra_metadata, "editor") ?? getMetadataText(item.extra_metadata, "last_editor");
  const releaseLabel = (() => {
    if (item.release_year) {
      return String(item.release_year);
    }
    if (!item.release_date) {
      return null;
    }
    try {
      return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(item.release_date));
    } catch {
      return item.release_date;
    }
  })();

  const contributorRows = [
    {
      label: "Uploader",
      value: item.submitted_by?.display_name ?? "Unknown",
    },
    {
      label: "Uploaded",
      value: formatDateTime(item.created_at),
    },
    {
      label: "Editor",
      value: editorName ?? "—",
    },
    {
      label: "Last updated",
      value: formatDateTime(item.updated_at),
    },
    {
      label: "Approver",
      value: approverName ?? "Unassigned",
    },
    {
      label: "Approved",
      value: item.approved_at ? formatDateTime(item.approved_at) : "Pending",
    },
  ];

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
          <h1 className="text-4xl font-semibold tracking-tight text-rose-900">{displayName}</h1>
          {primaryPrice ? (
            <span className="rounded-full bg-rose-600 px-4 py-1 text-sm font-medium text-white">
              {primaryPrice}
            </span>
          ) : null}
          <FavoriteToggle itemSlug={item.slug} />
        </div>
        <div className="flex flex-wrap gap-2">
          {item.brand ? (
            <Link
              href={buildSearchUrl({ brand: item.brand.slug })}
              className="inline-flex items-center rounded-full border border-rose-200 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-rose-500 transition hover:border-rose-300 hover:text-rose-800"
            >
              {item.brand.name ?? item.brand.slug}
            </Link>
          ) : null}
          {item.release_year ? (
            <span className="inline-flex items-center rounded-full border border-rose-200 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-rose-500">
              Release {item.release_year}
            </span>
          ) : null}
          {item.status ? (
            <span className="inline-flex items-center rounded-full border border-rose-200 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-rose-500">
              {titleCase(item.status)}
            </span>
          ) : null}
          {item.has_matching_set ? (
            <span className="inline-flex items-center rounded-full border border-rose-200 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-rose-500">
              Matching set
            </span>
          ) : null}
          {item.limited_edition ? (
            <span className="inline-flex items-center rounded-full border border-rose-200 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-rose-500">
              Limited edition
            </span>
          ) : null}
        </div>
      </header>

      <section className="grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <article className="flex flex-col gap-8">
          <ItemGallery images={galleryImages} alt={displayName} placeholderUrl={PLACEHOLDER_IMAGE_URL} />

          {extraMetadataEntries.length > 0 ? (
            <div className="flex flex-col gap-4">
              <h2 className="text-lg font-semibold text-rose-900">Extra metadata</h2>
              <dl className="grid gap-3 sm:grid-cols-2">
                {extraMetadataEntries.map(([key, value]) => (
                  <div key={key} className="rounded-xl border border-rose-100 bg-white/90 p-4">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-rose-400">{titleCase(key)}</dt>
                    <dd className="mt-1 text-sm text-slate-700">{String(value)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}

          {visibleTranslations.length > 0 ? (
            <div className="flex flex-col gap-4">
              <h2 className="text-lg font-semibold text-rose-900">Description</h2>
              <ul className="flex flex-col gap-3">
                {visibleTranslations.map((translation) => (
                  <li
                    key={`${translation.language}-${translation.name}`}
                    className="rounded-2xl border border-rose-100 bg-white/90 p-4 shadow-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-rose-900">{translation.name}</span>
                      <span className="text-xs uppercase tracking-wide text-rose-400">{translation.language}</span>
                    </div>
                    {translation.description ? (
                      <p className="mt-2 text-sm text-rose-500">{translation.description}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {relatedItems.length > 0 || relatedLoading ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-rose-900">Related items</h2>
                {relatedLoading ? <span className="text-xs uppercase tracking-wide text-rose-400">Loading…</span> : null}
              </div>
              {relatedItems.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {relatedItems.map((related) => {
                    const metaBadges: string[] = [];
                    if (related.category?.name) {
                      metaBadges.push(related.category.name);
                    }
                    if (related.release_year) {
                      metaBadges.push(`• ${related.release_year}`);
                    }
                    if (related.has_matching_set) {
                      metaBadges.push("• Matching set");
                    }
                    if (related.verified_source) {
                      metaBadges.push("• Verified source");
                    }
                    return (
                      <Link
                        key={related.slug}
                        href={`/items/${related.slug}`}
                        className="group flex flex-col gap-3 rounded-2xl border border-rose-100 bg-white/90 p-5 shadow-sm transition hover:-translate-y-1 hover:border-rose-200 hover:shadow-lg"
                      >
                        <div className="relative overflow-hidden rounded-xl border border-rose-50 bg-rose-50" style={{ aspectRatio: "3 / 4" }}>
                          <Image
                            src={related.cover_image?.url ?? PLACEHOLDER_IMAGE_URL}
                            alt={`${related.name} cover`}
                            fill
                            sizes="(min-width: 1024px) 220px, 50vw"
                            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold uppercase tracking-wide text-rose-400">
                            {related.brand?.name ?? related.brand?.slug ?? "Unknown brand"}
                          </span>
                          <span className="text-sm font-medium text-rose-700 transition group-hover:text-rose-900">
                            {formatPriceSummary(related.primary_price) ?? "—"}
                          </span>
                        </div>
                        <h3 className="text-lg font-semibold text-rose-900 group-hover:text-rose-700">{related.name}</h3>
                        {metaBadges.length > 0 ? (
                          <div className="flex flex-wrap gap-2 text-xs text-rose-500">
                            {metaBadges.map((badge, index) => (
                              <span key={`${related.slug}-meta-${index}`}>{badge}</span>
                            ))}
                          </div>
                        ) : null}
                        {related.tags.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {related.tags.slice(0, 2).map((tag) => (
                              <span
                                key={tag.id}
                                className="rounded-full bg-rose-100 px-3 py-1 text-xs font-medium text-rose-600"
                              >
                                {tag.name}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        {related.colors.length > 0 ? (
                          <div className="flex items-center gap-2">
                            {related.colors.slice(0, 3).map((color) => (
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
                  })}
                </div>
              ) : !relatedLoading ? (
                <p className="text-sm text-rose-400">No related items yet.</p>
              ) : null}
            </div>
          ) : null}

        </article>

        <aside className="flex flex-col gap-8">
          <div className="rounded-2xl border border-rose-100 bg-white/95 p-5 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-rose-500">Item overview</h2>
            <dl className="mt-4 space-y-4">
              {importantInfoRows.map((row) => (
                <div key={row.label} className="flex flex-col gap-1">
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-rose-400">{row.label}</dt>
                  <dd>
                    {row.chips.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {row.chips.map((chip) =>
                          chip.href ? (
                            <Link
                              key={chip.key}
                              href={chip.href}
                              className="rounded-full bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700 transition hover:bg-rose-100 hover:text-rose-900"
                            >
                              {chip.label}
                            </Link>
                          ) : (
                            <span key={chip.key} className="text-sm text-slate-500">
                              {chip.label}
                            </span>
                          ),
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-slate-400">—</span>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {orderedPrices.length > 0 ? (
            <div className="rounded-2xl border border-rose-100 bg-white/95 p-5 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-rose-500">Price</h2>
              <ul className="mt-3 flex flex-col gap-2 text-sm text-rose-500">
                {orderedPrices.map((price) => (
                  <li key={`${price.currency}-${price.amount}-${price.source}`} className="flex flex-col">
                    <span className="font-medium text-rose-900">
                      {formatPrice(price) ?? `${price.amount} ${price.currency}`}
                    </span>
                    <span className="text-xs uppercase tracking-wide text-rose-400">
                      {price.source}
                      {price.rate_used ? ` • rate ${price.rate_used}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {item.colors.length > 0 ? (
            <div className="rounded-2xl border border-rose-100 bg-white/90 p-5 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-rose-500">Colorway</h2>
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

          <div className="rounded-2xl border border-rose-100 bg-white/90 p-5 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-rose-500">Release & context</h2>
            <dl className="mt-4 space-y-4">
              <div className="flex flex-col gap-1">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-rose-400">Release year</dt>
                <dd className="text-sm text-slate-700">{releaseLabel ?? "—"}</dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-rose-400">Collections</dt>
                <dd>
                  {item.collections.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {item.collections.map((collection) => (
                        <Link
                          key={collection.id}
                          href={buildSearchUrl({ collection: collection.id })}
                          className="rounded-full bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700 transition hover:bg-rose-100 hover:text-rose-900"
                        >
                          {collection.name}
                          {collection.year ? ` · ${collection.year}` : ""}
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <span className="text-sm text-slate-400">—</span>
                  )}
                </dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-rose-400">Season</dt>
                <dd className="text-sm text-slate-700">{metadataSeason ?? "—"}</dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-rose-400">Fit</dt>
                <dd className="text-sm text-slate-700">{metadataFit ?? "—"}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-2xl border border-rose-100 bg-white/90 p-5 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-rose-500">Contributors</h2>
            <dl className="mt-4 space-y-4">
              {contributorRows.map((row) => (
                <div key={row.label} className="flex flex-col gap-1">
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-rose-400">{row.label}</dt>
                  <dd className="text-sm text-slate-700">{row.value}</dd>
                </div>
              ))}
            </dl>
          </div>

        </aside>
      </section>
    </div>
  );
}
