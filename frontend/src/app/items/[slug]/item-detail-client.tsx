"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent, MouseEvent } from "react";

import FavoriteToggle from "@/components/favorite-toggle";
import ItemGallery from "@/components/item-gallery";
import { useAuth } from "@/components/auth-provider";
import { useFlash } from "@/components/flash-provider";
import {
  ImageDetail,
  ItemDetail as ItemDetailPayload,
  ItemPriceDetail,
  ItemSummary,
  PriceSummary,
  ItemReview,
  WardrobeEntry,
  createItemReview,
  deleteWardrobeEntry,
  getItemList,
  listItemReviews,
  listMyReviews,
  listWardrobeEntries,
  saveWardrobeEntry,
} from "@/lib/api";
import { useCurrencyOptions } from "@/lib/useCurrencyOptions";

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

function formatRecommendation(value: ItemReview["recommendation"]): string {
  if (value === "recommend") {
    return "Recommend";
  }
  if (value === "not_recommend") {
    return "Not recommend";
  }
  return "Mixed";
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

type WardrobeFormState = {
  status: WardrobeEntry["status"];
  note: string;
  is_public: boolean;
  colors: string[];
  size: string;
  acquired_date: string;
  arrival_date: string;
  source: string;
  price_paid: string;
  currency: string;
  was_gift: boolean;
};

const WARDROBE_STATUS_OPTIONS: WardrobeEntry["status"][] = ["owned", "wishlist"];

function buildWardrobeFormState(entry: WardrobeEntry | null): WardrobeFormState {
  return {
    status: entry?.status ?? "owned",
    note: entry?.note ?? "",
    is_public: entry?.is_public ?? false,
    colors: entry?.colors ?? [],
    size: entry?.size ?? "",
    acquired_date: entry?.acquired_date ?? "",
    arrival_date: entry?.arrival_date ?? "",
    source: entry?.source ?? "",
    price_paid: entry?.price_paid ?? "",
    currency: entry?.currency ?? "",
    was_gift: entry?.was_gift ?? false,
  };
}

type ItemDetailClientProps = {
  item: ItemDetailPayload;
};

export default function ItemDetailClient({ item }: ItemDetailClientProps) {
  const { user, token } = useAuth();
  const flash = useFlash();
  const preferredLanguage = (user?.preferred_language ?? "en").toLowerCase();
  const preferredCurrency = (user?.preferred_currency ?? "USD").toUpperCase();
  const isAuthenticated = Boolean(user && token);
  const [wardrobeEntry, setWardrobeEntry] = useState<WardrobeEntry | null>(null);
  const [wardrobeLoading, setWardrobeLoading] = useState(false);
  const [wardrobeError, setWardrobeError] = useState<string | null>(null);
  const [wardrobeModalOpen, setWardrobeModalOpen] = useState(false);
  const [wardrobeForm, setWardrobeForm] = useState<WardrobeFormState>(() => buildWardrobeFormState(null));
  const [wardrobeModalSaving, setWardrobeModalSaving] = useState(false);
  const [wardrobeModalError, setWardrobeModalError] = useState<string | null>(null);

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

  const [reviews, setReviews] = useState<ItemReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsError, setReviewsError] = useState<string | null>(null);
  const [reviewRecommendation, setReviewRecommendation] = useState<ItemReview["recommendation"]>("recommend");
  const [reviewBody, setReviewBody] = useState("");
  const [reviewImages, setReviewImages] = useState<File[]>([]);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [pendingReviewBlock, setPendingReviewBlock] = useState<null | { itemSlug?: string; itemName?: string | null }>(null);

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

    useEffect(() => {
      let cancelled = false;
      async function loadReviews() {
        setReviewsLoading(true);
        setReviewsError(null);
        try {
          const entries = await listItemReviews(item.slug);
          if (!cancelled) {
            setReviews(entries);
          }
        } catch (error) {
          if (!cancelled) {
            console.error("Failed to load reviews", error);
            setReviews([]);
            setReviewsError("Failed to load reviews.");
          }
        } finally {
          if (!cancelled) {
            setReviewsLoading(false);
          }
        }
      }
      loadReviews();
      return () => {
        cancelled = true;
      };
    }, [item.slug]);

    useEffect(() => {
      if (!token) {
        setPendingReviewBlock(null);
        return;
      }
      const authToken = token;
      let cancelled = false;
      async function checkPendingReview(activeToken: string) {
        try {
          const pending = await listMyReviews(activeToken, { status: "pending", limit: 1 });
          if (cancelled) {
            return;
          }
          const first = pending[0];
          if (!first) {
            setPendingReviewBlock(null);
            return;
          }
          setPendingReviewBlock({
            itemSlug: first.item_slug,
            itemName: first.item_name,
          });
        } catch (error) {
          if (!cancelled) {
            console.error("Failed to check pending review", error);
            setPendingReviewBlock(null);
          }
        }
      }
      checkPendingReview(authToken);
      return () => {
        cancelled = true;
      };
    }, [token]);

    async function handleSubmitReview(event: FormEvent) {
      event.preventDefault();
      if (!token) {
        flash.addFlash({ kind: "warning", message: "Log in to submit a review." });
        return;
      }
      if (pendingReviewBlock) {
        flash.addFlash({
          kind: "warning",
          message: "You already have a pending review. Please wait for moderation before submitting another.",
        });
        return;
      }
      if (reviewImages.length < 1) {
        flash.addFlash({ kind: "warning", message: "Please add at least one picture." });
        return;
      }
      setReviewSubmitting(true);
      try {
        await createItemReview(token, item.slug, {
          recommendation: reviewRecommendation,
          body: reviewBody,
          images: reviewImages,
        });
        setReviewBody("");
        setReviewImages([]);
        flash.addFlash({ kind: "success", message: "Review submitted and pending moderator approval." });
        setPendingReviewBlock({ itemSlug: item.slug, itemName: item.translations?.[0]?.name ?? item.slug });
      } catch (error) {
        console.error("Failed to submit review", error);
        const message = error instanceof Error ? error.message : "Could not submit your review.";
        flash.addFlash({ kind: "error", message });
      } finally {
        setReviewSubmitting(false);
      }
    }
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
  const isWishlistEntry = wardrobeForm.status === "wishlist";
  const disablePriceInputs = wardrobeForm.was_gift;
  const { currencyOptions } = useCurrencyOptions();

  const colorOptions = useMemo(() => {
    const optionMap = new Map<string, string>();
    item.colors.forEach((color) => {
      const label = color.name ?? color.id;
      if (!label) {
        return;
      }
      const normalized = label.trim();
      if (!normalized) {
        return;
      }
      optionMap.set(normalized.toLowerCase(), normalized);
    });
    wardrobeForm.colors.forEach((color) => {
      const normalized = color.trim();
      if (!normalized) {
        return;
      }
      const key = normalized.toLowerCase();
      if (!optionMap.has(key)) {
        optionMap.set(key, normalized);
      }
    });
    return Array.from(optionMap.values()).map((label) => ({ value: label, label }));
  }, [item.colors, wardrobeForm.colors]);

  const sizeOptions = useMemo(() => {
    const variantSizes = item.variants
      .map((variant) => variant.size_descriptor?.trim())
      .filter((value): value is string => Boolean(value));
    const unique = Array.from(new Set(variantSizes));
    const existing = wardrobeForm.size?.trim();
    if (existing && !unique.includes(existing)) {
      unique.push(existing);
    }
    return unique;
  }, [item.variants, wardrobeForm.size]);

  const currencySelectOptions = useMemo(() => {
    const registry = new Map<string, { code: string; label: string }>();
    currencyOptions.forEach((option) => registry.set(option.code, option));
    item.prices.forEach((price) => {
      const code = price.currency?.toUpperCase();
      if (code && !registry.has(code)) {
        registry.set(code, { code, label: code });
      }
    });
    const current = wardrobeForm.currency?.trim().toUpperCase();
    if (current && !registry.has(current)) {
      registry.set(current, { code: current, label: current });
    }
    return Array.from(registry.values());
  }, [currencyOptions, item.prices, wardrobeForm.currency]);

  useEffect(() => {
    if (!token) {
      setWardrobeEntry(null);
      return;
    }
    let cancelled = false;
    setWardrobeLoading(true);
    setWardrobeError(null);
    const fetchWardrobeState = async () => {
      try {
        const [existing] = await listWardrobeEntries(token, { item: item.slug });
        if (!cancelled) {
          setWardrobeEntry(existing ?? null);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load wardrobe entry", error);
          setWardrobeError("Unable to load wardrobe status right now.");
        }
      } finally {
        if (!cancelled) {
          setWardrobeLoading(false);
        }
      }
    };
    void fetchWardrobeState();
    return () => {
      cancelled = true;
    };
  }, [item.slug, token]);

  const openWardrobeModal = () => {
    if (!token) {
      return;
    }
    setWardrobeForm(buildWardrobeFormState(wardrobeEntry));
    setWardrobeModalError(null);
    setWardrobeModalOpen(true);
  };

  const closeWardrobeModal = () => {
    if (wardrobeModalSaving) {
      return;
    }
    setWardrobeModalOpen(false);
  };

  useEffect(() => {
    if (!wardrobeModalOpen) {
      return undefined;
    }
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !wardrobeModalSaving) {
        setWardrobeModalOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [wardrobeModalOpen, wardrobeModalSaving]);

  const updateWardrobeForm = <Field extends keyof WardrobeFormState>(
    field: Field,
    value: WardrobeFormState[Field],
  ) => {
    setWardrobeForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleWardrobeFormSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) {
      return;
    }
    setWardrobeModalSaving(true);
    setWardrobeModalError(null);
    const colorTokens = wardrobeForm.colors.map((color) => color.trim()).filter((color) => color.length > 0);
    const rawPrice = wardrobeForm.price_paid.trim();
    const hasPrice = !wardrobeForm.was_gift && rawPrice.length > 0;
    if (hasPrice) {
      const numericValue = Number(rawPrice);
      if (Number.isNaN(numericValue) || numericValue < 0) {
        setWardrobeModalError("Enter a valid price paid amount.");
        setWardrobeModalSaving(false);
        return;
      }
    }
    const normalizedCurrency = wardrobeForm.was_gift ? "" : wardrobeForm.currency.trim().toUpperCase();
    if (hasPrice && !normalizedCurrency) {
      setWardrobeModalError("Select the currency used for this purchase.");
      setWardrobeModalSaving(false);
      return;
    }
    const priceValue = hasPrice ? rawPrice : null;
    const payload: Parameters<typeof saveWardrobeEntry>[1] = {
      item: item.slug,
      status: wardrobeForm.status,
      note: wardrobeForm.note.trim(),
      is_public: wardrobeForm.is_public,
      colors: colorTokens,
      size: wardrobeForm.size.trim(),
      acquired_date:
        wardrobeForm.status === "owned" && wardrobeForm.acquired_date ? wardrobeForm.acquired_date : null,
      arrival_date:
        wardrobeForm.status === "owned" && wardrobeForm.arrival_date ? wardrobeForm.arrival_date : null,
      source: wardrobeForm.source.trim(),
      price_paid: priceValue,
      currency: normalizedCurrency,
      was_gift: wardrobeForm.was_gift,
    } as const;
    try {
      const saved = await saveWardrobeEntry(token, payload);
      setWardrobeEntry(saved);
      setWardrobeError(null);
      setWardrobeModalOpen(false);
    } catch (error) {
      console.error("Failed to save wardrobe entry", error);
      setWardrobeModalError("Unable to save this wardrobe entry.");
    } finally {
      setWardrobeModalSaving(false);
    }
  };

  const handleWardrobeDelete = async () => {
    if (!token || !wardrobeEntry) {
      return;
    }
    setWardrobeModalSaving(true);
    setWardrobeModalError(null);
    try {
      await deleteWardrobeEntry(token, wardrobeEntry.id);
      setWardrobeEntry(null);
      setWardrobeError(null);
      setWardrobeModalOpen(false);
    } catch (error) {
      console.error("Failed to remove wardrobe entry", error);
      setWardrobeModalError("Unable to remove this item from your wardrobe.");
    } finally {
      setWardrobeModalSaving(false);
    }
  };

  const handleModalBackgroundClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      closeWardrobeModal();
    }
  };

  return (
    <div className="flex flex-col gap-10">
      {!isAuthenticated ? (
        <div className="rounded-3xl border border-rose-100 bg-white/80 px-6 py-4 text-sm text-rose-600">
          You are not logged in. <Link href="/login" className="font-semibold text-rose-700 underline">Log in</Link> to save this item to your wardrobe.
        </div>
      ) : null}
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
            <span className="rounded-full bg-rose-600 px-4 py-1 text-sm font-medium text-white">{primaryPrice}</span>
          ) : null}
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

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-rose-100 bg-white/90 p-4 shadow-sm">
                {isAuthenticated ? (
                  <button
                    type="button"
                    onClick={openWardrobeModal}
                    disabled={wardrobeLoading}
                    className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${
                      wardrobeEntry
                        ? "border-emerald-200 bg-emerald-600"
                        : "border-rose-200 bg-rose-900/90 hover:bg-rose-900"
                    }`}
                  >
                    {wardrobeLoading ? "Loading…" : wardrobeEntry ? "In wardrobe" : "Add to wardrobe"}
                  </button>
                ) : (
                  <Link
                    href={`/login?next=${encodeURIComponent(`/items/${item.slug}`)}`}
                    className="rounded-full border border-rose-200 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-rose-600 transition hover:border-rose-300 hover:text-rose-800"
                  >
                    Log in to save
                  </Link>
                )}
                <FavoriteToggle itemSlug={item.slug} />
              </div>
              {wardrobeError ? <p className="text-xs text-rose-500">{wardrobeError}</p> : null}
            </div>
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
          </div>

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

          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-rose-900">Reviews</h2>
              {reviewsLoading ? <span className="text-xs uppercase tracking-wide text-rose-400">Loading…</span> : null}
            </div>

            {reviewsError ? <p className="text-sm text-rose-500">{reviewsError}</p> : null}

            {!reviewsLoading && reviews.length === 0 && !reviewsError ? (
              <p className="text-sm text-rose-400">No reviews yet.</p>
            ) : null}

            {reviews.length > 0 ? (
              <div className="flex flex-col gap-4">
                {reviews.map((review) => (
                  <div key={review.id} className="rounded-2xl border border-rose-100 bg-white/95 p-5 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col">
                          <Link
                            href={`/profile/${encodeURIComponent(review.author_username)}`}
                            className="text-sm font-semibold text-rose-900 hover:underline"
                          >
                            {review.author_display_name || review.author_username}
                          </Link>
                          <span className="text-xs uppercase tracking-wide text-rose-400">
                            {formatDateTime(review.created_at)}
                          </span>
                        </div>
                      </div>
                      <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">
                        {formatRecommendation(review.recommendation)}
                      </span>
                    </div>
                    {review.body ? <p className="mt-3 whitespace-pre-line text-sm text-slate-700">{review.body}</p> : null}
                    {review.images.length > 0 ? (
                      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {review.images.map((image) => (
                          <div
                            key={image.id}
                            className="relative overflow-hidden rounded-xl border border-rose-100 bg-rose-50"
                            style={{ aspectRatio: "1 / 1" }}
                          >
                            <Image src={image.url} alt="Review image" fill sizes="160px" className="object-cover" />
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}

            {isAuthenticated ? (
              pendingReviewBlock ? (
                <div className="rounded-2xl border border-rose-100 bg-white/80 p-5 text-sm text-rose-500">
                  <p className="text-sm font-semibold text-rose-900">Review submission locked</p>
                  <p className="mt-2">
                    You already have a pending review. Please wait for moderation before submitting another.
                  </p>
                  <Link href="/profile/reviews" className="mt-3 inline-flex text-sm font-semibold text-rose-700 hover:text-rose-900">
                    View your pending review
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleSubmitReview} className="rounded-2xl border border-rose-100 bg-white/95 p-5 shadow-sm">
                  <p className="text-sm font-semibold text-rose-900">Write a review</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <label className="flex flex-col gap-1 sm:col-span-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-rose-400">Recommendation</span>
                      <select
                        value={reviewRecommendation}
                        onChange={(event) => setReviewRecommendation(event.target.value as ItemReview["recommendation"])}
                        className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm text-rose-900"
                        disabled={reviewSubmitting}
                      >
                        <option value="recommend">Recommend</option>
                        <option value="not_recommend">Not recommend</option>
                        <option value="mixed">Mixed</option>
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 sm:col-span-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-rose-400">
                        Pictures (required)
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(event) => setReviewImages(event.target.files ? Array.from(event.target.files) : [])}
                        className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm text-rose-900 file:mr-4 file:rounded-full file:border-0 file:bg-rose-100 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-rose-700"
                        disabled={reviewSubmitting}
                      />
                    </label>
                  </div>
                  <label className="mt-3 flex flex-col gap-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-rose-400">Review</span>
                    <textarea
                      value={reviewBody}
                      onChange={(event) => setReviewBody(event.target.value)}
                      rows={4}
                      className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm text-slate-700"
                      placeholder="Share your experience..."
                      disabled={reviewSubmitting}
                    />
                  </label>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <p className="text-xs text-rose-400">Reviews are visible after moderation.</p>
                    <button
                      type="submit"
                      disabled={reviewSubmitting}
                      className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {reviewSubmitting ? "Submitting…" : "Submit"}
                    </button>
                  </div>
                </form>
              )
            ) : (
              <div className="rounded-2xl border border-rose-100 bg-white/80 p-5 text-sm text-rose-500">
                Log in to submit a review.
              </div>
            )}
          </div>

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
      {isAuthenticated && wardrobeModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-rose-950/40 px-4 py-8"
          role="dialog"
          aria-modal="true"
          onClick={handleModalBackgroundClick}
        >
          <div className="w-full max-w-2xl rounded-3xl border border-rose-100 bg-white p-6 shadow-2xl" role="document">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-rose-400">Wardrobe entry</p>
                <h3 className="text-xl font-semibold text-rose-900">{displayName}</h3>
              </div>
              <button
                type="button"
                onClick={closeWardrobeModal}
                disabled={wardrobeModalSaving}
                className="rounded-full border border-rose-200 p-2 text-rose-500 transition hover:border-rose-300 hover:text-rose-800 disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="Close wardrobe dialog"
              >
                ✕
              </button>
            </div>
            <p className="mt-2 text-sm text-rose-500">
              {wardrobeEntry
                ? "Update how you'd like to track this item in your wardrobe or wishlist."
                : "Add context so future-you remembers how you plan to find or style this piece."}
            </p>
            {isWishlistEntry ? (
              <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-rose-400">Wishlist entries skip acquisition details.</p>
            ) : null}
            <form className="mt-6 space-y-5" onSubmit={handleWardrobeFormSubmit}>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-rose-400">Status</p>
                <div className="mt-3 flex flex-wrap gap-3">
                  {WARDROBE_STATUS_OPTIONS.map((status) => {
                    const isSelected = wardrobeForm.status === status;
                    return (
                      <label
                        key={status}
                        className={`flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                          isSelected ? "border-rose-400 bg-rose-50 text-rose-900" : "border-rose-200 text-rose-500"
                        }`}
                      >
                        <input
                          type="radio"
                          name="wardrobe-status"
                          value={status}
                          className="sr-only"
                          checked={isSelected}
                          onChange={() => updateWardrobeForm("status", status)}
                        />
                        {status === "owned" ? "Owned" : "Wishlist"}
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm text-rose-500">
                  <span className="text-xs font-semibold uppercase tracking-wide text-rose-400">Colors</span>
                  {colorOptions.length > 0 ? (
                    <select
                      multiple
                      value={wardrobeForm.colors}
                      onChange={(event) =>
                        updateWardrobeForm(
                          "colors",
                          Array.from(event.target.selectedOptions).map((option) => option.value),
                        )
                      }
                      className="rounded-2xl border border-rose-200 px-3 py-2 text-sm text-rose-900 focus:border-rose-400 focus:outline-none"
                    >
                      {colorOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="rounded-2xl border border-dashed border-rose-200 px-3 py-2 text-sm text-rose-400">No color data available.</p>
                  )}
                  {colorOptions.length > 0 ? (
                    <span className="text-[11px] text-rose-400">Select every palette that matches this piece.</span>
                  ) : null}
                </label>
                <label className="flex flex-col gap-1 text-sm text-rose-500">
                  <span className="text-xs font-semibold uppercase tracking-wide text-rose-400">Size</span>
                  <select
                    value={wardrobeForm.size}
                    onChange={(event) => updateWardrobeForm("size", event.target.value)}
                    disabled={sizeOptions.length === 0}
                    className="rounded-2xl border border-rose-200 px-3 py-2 text-sm text-rose-900 focus:border-rose-400 focus:outline-none disabled:bg-rose-50"
                  >
                    <option value="">{sizeOptions.length === 0 ? "No sizes available" : "Select a size"}</option>
                    {sizeOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  {sizeOptions.length === 0 ? (
                    <span className="text-[11px] text-rose-400">This item doesn’t list size variants yet.</span>
                  ) : null}
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm text-rose-500">
                  <span className="text-xs font-semibold uppercase tracking-wide text-rose-400">Acquired date</span>
                  <input
                    type="date"
                    value={wardrobeForm.acquired_date}
                    onChange={(event) => updateWardrobeForm("acquired_date", event.target.value)}
                    disabled={isWishlistEntry}
                    className="rounded-2xl border border-rose-200 px-3 py-2 text-sm text-rose-900 focus:border-rose-400 focus:outline-none disabled:cursor-not-allowed disabled:bg-rose-50"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm text-rose-500">
                  <span className="text-xs font-semibold uppercase tracking-wide text-rose-400">Arrival date</span>
                  <input
                    type="date"
                    value={wardrobeForm.arrival_date}
                    onChange={(event) => updateWardrobeForm("arrival_date", event.target.value)}
                    disabled={isWishlistEntry}
                    className="rounded-2xl border border-rose-200 px-3 py-2 text-sm text-rose-900 focus:border-rose-400 focus:outline-none disabled:cursor-not-allowed disabled:bg-rose-50"
                  />
                </label>
              </div>
              <label className="flex flex-col gap-1 text-sm text-rose-500">
                <span className="text-xs font-semibold uppercase tracking-wide text-rose-400">Source / store</span>
                <input
                  type="text"
                  value={wardrobeForm.source}
                  onChange={(event) => updateWardrobeForm("source", event.target.value)}
                  placeholder="Secondhand via Closet Child"
                  className="rounded-2xl border border-rose-200 px-3 py-2 text-sm text-rose-900 focus:border-rose-400 focus:outline-none"
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
                <label className="flex flex-col gap-1 text-sm text-rose-500">
                  <span className="text-xs font-semibold uppercase tracking-wide text-rose-400">Price paid</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={wardrobeForm.price_paid}
                    onChange={(event) => updateWardrobeForm("price_paid", event.target.value)}
                    disabled={disablePriceInputs}
                    placeholder="0.00"
                    className="rounded-2xl border border-rose-200 px-3 py-2 text-sm text-rose-900 focus:border-rose-400 focus:outline-none disabled:cursor-not-allowed disabled:bg-rose-50"
                  />
                  {!disablePriceInputs ? (
                    <span className="text-[11px] text-rose-400">Enter the amount before currency conversion.</span>
                  ) : null}
                </label>
                <label className="flex flex-col gap-1 text-sm text-rose-500">
                  <span className="text-xs font-semibold uppercase tracking-wide text-rose-400">Currency</span>
                  <select
                    value={wardrobeForm.currency}
                    onChange={(event) => updateWardrobeForm("currency", event.target.value.toUpperCase())}
                    disabled={disablePriceInputs}
                    className="rounded-2xl border border-rose-200 px-3 py-2 text-sm uppercase text-rose-900 focus:border-rose-400 focus:outline-none disabled:cursor-not-allowed disabled:bg-rose-50"
                  >
                    <option value="">Select currency</option>
                    {currencySelectOptions.map((option) => (
                      <option key={option.code} value={option.code}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {!disablePriceInputs ? (
                    <span className="text-[11px] text-rose-400">Choose the currency you purchased in.</span>
                  ) : null}
                </label>
              </div>
              <div className="flex flex-wrap gap-4 text-xs text-rose-500">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={wardrobeForm.was_gift}
                    onChange={(event) => updateWardrobeForm("was_gift", event.target.checked)}
                    className="rounded border-rose-300 text-rose-600 focus:ring-rose-500"
                  />
                  Mark as gift
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={wardrobeForm.is_public}
                    onChange={(event) => updateWardrobeForm("is_public", event.target.checked)}
                    className="rounded border-rose-300 text-rose-600 focus:ring-rose-500"
                  />
                  Share this entry publicly
                </label>
              </div>
              <label className="flex flex-col gap-1 text-sm text-rose-500">
                <span className="text-xs font-semibold uppercase tracking-wide text-rose-400">Notes</span>
                <textarea
                  rows={4}
                  value={wardrobeForm.note}
                  onChange={(event) => updateWardrobeForm("note", event.target.value)}
                  placeholder="How you plan to style, hunt, or track this piece."
                  className="rounded-2xl border border-rose-200 px-3 py-2 text-sm text-rose-900 focus:border-rose-400 focus:outline-none"
                />
              </label>
              {wardrobeModalError ? (
                <p className="text-sm font-semibold text-rose-600">{wardrobeModalError}</p>
              ) : null}
              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={wardrobeModalSaving}
                  className="rounded-full bg-rose-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {wardrobeModalSaving ? "Saving…" : wardrobeEntry ? "Save changes" : "Add to wardrobe"}
                </button>
                {wardrobeEntry ? (
                  <button
                    type="button"
                    onClick={handleWardrobeDelete}
                    disabled={wardrobeModalSaving}
                    className="rounded-full border border-rose-200 px-5 py-2 text-sm font-semibold text-rose-600 transition hover:border-rose-300 hover:text-rose-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Remove entry
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={closeWardrobeModal}
                  disabled={wardrobeModalSaving}
                  className="rounded-full border border-rose-200 px-5 py-2 text-sm font-semibold text-rose-600 transition hover:border-rose-300 hover:text-rose-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
