"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent, MouseEvent } from "react";

import { useAuth } from "@/components/auth-provider";
import { deleteWardrobeEntry, listWardrobeEntries, saveWardrobeEntry, type WardrobeEntry } from "@/lib/api";

const PLACEHOLDER_IMAGE_URL = "https://placehold.co/600x800?text=Jiraibrary";

function formatWardrobeTimestamp(value: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatWardrobePrice(amount: string | null, currency: string | null): string | null {
  if (!amount || !currency) {
    return null;
  }
  const numericValue = Number(amount);
  if (Number.isNaN(numericValue)) {
    return `${amount} ${currency}`;
  }
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(numericValue);
  } catch {
    return `${amount} ${currency}`;
  }
}

type WardrobeSortOption = "recent" | "acquired_desc" | "acquired_asc" | "brand_asc" | "price_asc";

type WardrobeFilterState = {
  brand: string;
  category: string;
  colors: string[];
  hasArrival: boolean;
  hasPrice: boolean;
  giftedOnly: boolean;
  year: string;
  sort: WardrobeSortOption;
};

type WardrobeFilterOptions = {
  brands: Array<{ value: string; label: string }>;
  categories: Array<{ value: string; label: string }>;
  colors: Array<{ value: string; label: string }>;
  years: string[];
};

const createInitialFilters = (): WardrobeFilterState => ({
  brand: "",
  category: "",
  colors: [],
  hasArrival: false,
  hasPrice: false,
  giftedOnly: false,
  year: "",
  sort: "recent",
});

function extractEntryYear(entry: WardrobeEntry): string | null {
  const source = entry.acquired_date || entry.created_at;
  if (!source) {
    return null;
  }
  return source.slice(0, 4);
}

function applyFilters(entries: WardrobeEntry[], filters: WardrobeFilterState): WardrobeEntry[] {
  return entries.filter((entry) => {
    const detail = entry.item_detail;
    if (filters.brand && detail.brand?.slug !== filters.brand) {
      return false;
    }
    if (filters.category && detail.category?.id !== filters.category) {
      return false;
    }
    if (filters.colors.length > 0) {
      const entryColors = (entry.colors ?? []).map((color) => color.toLowerCase());
      const hasMatch = filters.colors.some((color) => entryColors.includes(color.toLowerCase()));
      if (!hasMatch) {
        return false;
      }
    }
    if (filters.hasArrival && !entry.arrival_date) {
      return false;
    }
    if (filters.hasPrice && !entry.price_paid) {
      return false;
    }
    if (filters.giftedOnly && !entry.was_gift) {
      return false;
    }
    if (filters.year) {
      const entryYear = extractEntryYear(entry);
      if (entryYear !== filters.year) {
        return false;
      }
    }
    return true;
  });
}

function sortEntries(entries: WardrobeEntry[], sort: WardrobeSortOption): WardrobeEntry[] {
  const copy = [...entries];
  const getAcquiredTime = (entry: WardrobeEntry): number => {
    const sourceDate = entry.acquired_date || entry.created_at;
    return sourceDate ? new Date(sourceDate).getTime() : 0;
  };
  switch (sort) {
    case "acquired_desc":
      copy.sort((a, b) => getAcquiredTime(b) - getAcquiredTime(a));
      break;
    case "acquired_asc":
      copy.sort((a, b) => getAcquiredTime(a) - getAcquiredTime(b));
      break;
    case "brand_asc":
      copy.sort((a, b) => {
        const nameA = (a.item_detail.brand?.name ?? a.item_detail.brand?.slug ?? "").toLowerCase();
        const nameB = (b.item_detail.brand?.name ?? b.item_detail.brand?.slug ?? "").toLowerCase();
        return nameA.localeCompare(nameB);
      });
      break;
    case "price_asc":
      copy.sort((a, b) => {
        const priceA = Number(a.price_paid ?? Infinity);
        const priceB = Number(b.price_paid ?? Infinity);
        return priceA - priceB;
      });
      break;
    case "recent":
    default:
      copy.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      break;
  }
  return copy;
}

const SORT_OPTIONS: Array<{ value: WardrobeSortOption; label: string }> = [
  { value: "recent", label: "Recently added" },
  { value: "acquired_desc", label: "Acquired (newest first)" },
  { value: "acquired_asc", label: "Acquired (oldest first)" },
  { value: "brand_asc", label: "Brand A–Z" },
  { value: "price_asc", label: "Lowest price first" },
];

type MoveEntryFormState = {
  note: string;
  colorsText: string;
  size: string;
  acquired_date: string;
  arrival_date: string;
  source: string;
  price_paid: string;
  currency: string;
  is_public: boolean;
  was_gift: boolean;
};

const buildMoveFormState = (entry: WardrobeEntry): MoveEntryFormState => ({
  note: entry.note ?? "",
  colorsText: (entry.colors ?? []).join(", "),
  size: entry.size ?? "",
  acquired_date: entry.acquired_date ?? "",
  arrival_date: entry.arrival_date ?? "",
  source: entry.source ?? "",
  price_paid: entry.price_paid ?? "",
  currency: entry.currency ?? "",
  is_public: entry.is_public,
  was_gift: entry.was_gift,
});

type WardrobeEntryCardVariant = "owned" | "wishlist";

type WardrobeEntryCardProps = {
  entry: WardrobeEntry;
  variant: WardrobeEntryCardVariant;
  compact?: boolean;
  onViewDetails?: (entry: WardrobeEntry) => void;
  onMoveToWardrobe?: (entry: WardrobeEntry) => void;
  onRemove?: (entry: WardrobeEntry) => void;
};

export default function ProfilePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading, logout, token } = useAuth();
  const defaultTabId = "activity";
  const [wardrobeEntries, setWardrobeEntries] = useState<WardrobeEntry[]>([]);
  const [wardrobeLoading, setWardrobeLoading] = useState(false);
  const [wardrobeError, setWardrobeError] = useState<string | null>(null);
  const [filters, setFilters] = useState<WardrobeFilterState>(() => createInitialFilters());
  const [entryDialog, setEntryDialog] = useState<{
    entry: WardrobeEntry;
    mode: "detail" | "move";
    form: MoveEntryFormState;
  } | null>(null);
  const [entryDialogSaving, setEntryDialogSaving] = useState(false);
  const [entryDialogError, setEntryDialogError] = useState<string | null>(null);
  const ownedEntries = useMemo(
    () => wardrobeEntries.filter((entry) => entry.status === "owned"),
    [wardrobeEntries],
  );
  const wishlistEntries = useMemo(
    () => wardrobeEntries.filter((entry) => entry.status === "wishlist"),
    [wardrobeEntries],
  );
  const publicEntryCount = useMemo(
    () => wardrobeEntries.filter((entry) => entry.is_public).length,
    [wardrobeEntries],
  );
  const filterOptions = useMemo<WardrobeFilterOptions>(() => {
    const brandMap = new Map<string, { value: string; label: string }>();
    const categoryMap = new Map<string, { value: string; label: string }>();
    const colorMap = new Map<string, string>();
    const yearSet = new Set<string>();
    wardrobeEntries.forEach((entry) => {
      const brand = entry.item_detail.brand;
      if (brand?.slug && !brandMap.has(brand.slug)) {
        brandMap.set(brand.slug, { value: brand.slug, label: brand.name ?? brand.slug });
      }
      const category = entry.item_detail.category;
      if (category?.id && !categoryMap.has(category.id)) {
        categoryMap.set(category.id, { value: category.id, label: category.name });
      }
      (entry.colors ?? []).forEach((color) => {
        const normalized = color.trim();
        if (!normalized) {
          return;
        }
        const key = normalized.toLowerCase();
        if (!colorMap.has(key)) {
          colorMap.set(key, normalized);
        }
      });
      const year = extractEntryYear(entry);
      if (year) {
        yearSet.add(year);
      }
    });
    return {
      brands: Array.from(brandMap.values()).sort((a, b) => a.label.localeCompare(b.label)),
      categories: Array.from(categoryMap.values()).sort((a, b) => a.label.localeCompare(b.label)),
      colors: Array.from(colorMap.entries())
        .map(([value, label]) => ({ value, label }))
        .sort((a, b) => a.label.localeCompare(b.label)),
      years: Array.from(yearSet).sort((a, b) => Number(b) - Number(a)),
    };
  }, [wardrobeEntries]);
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.brand) {
      count += 1;
    }
    if (filters.category) {
      count += 1;
    }
    count += filters.colors.length;
    if (filters.hasArrival) {
      count += 1;
    }
    if (filters.hasPrice) {
      count += 1;
    }
    if (filters.giftedOnly) {
      count += 1;
    }
    if (filters.year) {
      count += 1;
    }
    return count;
  }, [filters]);
  const filteredOwnedEntries = useMemo(() => {
    const scoped = applyFilters(ownedEntries, filters);
    return sortEntries(scoped, filters.sort);
  }, [filters, ownedEntries]);
  const filteredWishlistEntries = useMemo(() => {
    const scoped = applyFilters(wishlistEntries, filters);
    return sortEntries(scoped, filters.sort);
  }, [filters, wishlistEntries]);

  const roleName = user?.role?.name?.toLowerCase() ?? "user";
  const isModerator = roleName === "moderator" || roleName === "admin";
  const isAdmin = roleName === "admin";

  type ProfileTab = {
    id: string;
    label: string;
    description: string;
  };

  const availableTabs = useMemo<ProfileTab[]>(() => {
    const tabs: ProfileTab[] = [
      { id: "activity", label: "My Activity", description: "Recent comments & timeline" },
      { id: "submissions", label: "My Submissions", description: "Drafts and published entries" },
      { id: "wardrobe", label: "My Wardrobe", description: "Saved looks & inspiration" },
      { id: "wishlist", label: "Wishlist", description: "Pieces you're keeping an eye on" },
    ];
    if (isModerator) {
      tabs.push({ id: "moderation", label: "Moderation", description: "Queues that need review" });
    }
    if (isAdmin) {
      tabs.push({ id: "admin", label: "Admin Panel", description: "People & platform settings" });
    }
    tabs.push(
      { id: "profile", label: "Edit Profile", description: "Avatar, bio, and socials" },
      { id: "account", label: "Account Settings", description: "Preferences & access" },
    );
    return tabs;
  }, [isModerator, isAdmin]);

  useEffect(() => {
    if (!loading && !user) {
      router.replace(`/login?next=${encodeURIComponent("/profile")}`);
    }
  }, [loading, router, user]);

  useEffect(() => {
    if (!token) {
      return;
    }
    let cancelled = false;
    const loadWardrobe = async () => {
      setWardrobeLoading(true);
      setWardrobeError(null);
      try {
        const entries = await listWardrobeEntries(token);
        if (!cancelled) {
          setWardrobeEntries(entries);
        }
      } catch {
        if (!cancelled) {
          setWardrobeError("Unable to load your wardrobe right now.");
        }
      } finally {
        if (!cancelled) {
          setWardrobeLoading(false);
        }
      }
    };
    void loadWardrobe();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const selectTab = useCallback(
    (tabId: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (tabId === defaultTabId) {
        params.delete("panel");
      } else {
        params.set("panel", tabId);
      }
      const query = params.toString();
      router.replace(`/profile${query ? `?${query}` : ""}`, { scroll: false });
    },
    [defaultTabId, router, searchParams],
  );

  const panelParam = searchParams.get("panel");
  const fallbackTabId = availableTabs[0]?.id ?? defaultTabId;
  const activeTab = panelParam && availableTabs.some((tab) => tab.id === panelParam) ? panelParam : fallbackTabId;

  useEffect(() => {
    if (!panelParam) {
      return;
    }
    const exists = availableTabs.some((tab) => tab.id === panelParam);
    if (!exists && fallbackTabId) {
      selectTab(fallbackTabId);
    }
  }, [availableTabs, fallbackTabId, panelParam, selectTab]);

  useEffect(() => {
    if (!entryDialog) {
      return;
    }
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !entryDialogSaving) {
        setEntryDialog(null);
      }
    };
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [entryDialog, entryDialogSaving]);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-2xl rounded-3xl border border-rose-100 bg-white/90 p-8 shadow-lg">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-1/3 rounded-full bg-rose-100" />
          <div className="h-4 w-2/3 rounded-full bg-rose-50" />
          <div className="h-4 w-1/2 rounded-full bg-rose-50" />
          <div className="h-8 w-1/4 rounded-full bg-rose-100" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto w-full max-w-sm rounded-3xl border border-rose-100 bg-white/90 p-8 text-center shadow-lg">
        <p className="text-sm font-medium text-rose-600">Redirecting to login…</p>
      </div>
    );
  }

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };
  const hasActiveFilters = activeFilterCount > 0;
  const disableMovePriceInputs = entryDialog?.form.was_gift ?? false;
  const updateFilters = <Field extends keyof WardrobeFilterState>(field: Field, value: WardrobeFilterState[Field]) => {
    setFilters((prev) => ({
      ...prev,
      [field]: value,
    }));
  };
  const toggleColorFilter = (value: string) => {
    setFilters((prev) => {
      const exists = prev.colors.includes(value);
      return {
        ...prev,
        colors: exists ? prev.colors.filter((color) => color !== value) : [...prev.colors, value],
      };
    });
  };
  const resetFilters = () => {
    setFilters(createInitialFilters());
  };
  const handleViewEntryDetails = (entry: WardrobeEntry) => {
    openEntryDetail(entry, "detail");
  };
  const handleMoveEntryToWardrobe = (entry: WardrobeEntry) => {
    openEntryDetail(entry, "move");
  };
  const upsertWardrobeEntry = (next: WardrobeEntry) => {
    setWardrobeEntries((previous) => {
      const indexById = previous.findIndex((entry) => entry.id === next.id);
      if (indexById >= 0) {
        const clone = [...previous];
        clone[indexById] = next;
        return clone;
      }
      const indexByItem = previous.findIndex((entry) => entry.item === next.item);
      if (indexByItem >= 0) {
        const clone = [...previous];
        clone[indexByItem] = next;
        return clone;
      }
      return [...previous, next];
    });
  };
  const handleMoveFormSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || !entryDialog) {
      return;
    }
    const { entry, form } = entryDialog;
    setEntryDialogSaving(true);
    setEntryDialogError(null);
    const colorTokens = form.colorsText
      .split(",")
      .map((color) => color.trim())
      .filter((color) => color.length > 0);
    const payload: Parameters<typeof saveWardrobeEntry>[1] = {
      item: entry.item,
      status: "owned",
      note: form.note.trim(),
      is_public: form.is_public,
      colors: colorTokens,
      size: form.size.trim(),
      acquired_date: form.acquired_date ? form.acquired_date : null,
      arrival_date: form.arrival_date ? form.arrival_date : null,
      source: form.source.trim(),
      price_paid: form.was_gift || form.price_paid.trim() === "" ? null : form.price_paid.trim(),
      currency: form.was_gift ? "" : form.currency.trim().toUpperCase(),
      was_gift: form.was_gift,
    };
    try {
      const saved = await saveWardrobeEntry(token, payload);
      upsertWardrobeEntry(saved);
      setEntryDialog({ entry: saved, mode: "detail", form: buildMoveFormState(saved) });
    } catch (error) {
      console.error("Failed to move wishlist entry", error);
      setEntryDialogError("Unable to move this item into your wardrobe right now.");
    } finally {
      setEntryDialogSaving(false);
    }
  };
  const handleEntryRemoval = async (entry: WardrobeEntry) => {
    if (!token) {
      return;
    }
    const isViewingInDialog = entryDialog?.entry.id === entry.id;
    if (!isViewingInDialog) {
      const shouldRemove = window.confirm("Remove this entry from your wardrobe?");
      if (!shouldRemove) {
        return;
      }
    }
    if (isViewingInDialog) {
      setEntryDialogSaving(true);
      setEntryDialogError(null);
    }
    try {
      await deleteWardrobeEntry(token, entry.id);
      setWardrobeEntries((previous) => previous.filter((candidate) => candidate.id !== entry.id));
      if (isViewingInDialog) {
        setEntryDialog(null);
      }
    } catch (error) {
      console.error("Failed to remove wardrobe entry", error);
      if (isViewingInDialog) {
        setEntryDialogError("Unable to remove this wardrobe entry.");
      } else {
        setWardrobeError("Unable to remove this wardrobe entry.");
      }
    } finally {
      if (isViewingInDialog) {
        setEntryDialogSaving(false);
      }
    }
  };
  const openEntryDetail = (entry: WardrobeEntry, mode: "detail" | "move" = "detail") => {
    setEntryDialog({
      entry,
      mode,
      form: buildMoveFormState(entry),
    });
    setEntryDialogError(null);
  };
  const updateMoveForm = <Field extends keyof MoveEntryFormState>(field: Field, value: MoveEntryFormState[Field]) => {
    setEntryDialog((previous) => (previous ? { ...previous, form: { ...previous.form, [field]: value } } : previous));
  };
  const closeEntryDialog = () => {
    if (entryDialogSaving) {
      return;
    }
    setEntryDialog(null);
  };
  const handleEntryModalBackgroundClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      closeEntryDialog();
    }
  };

  const roleBadgeClass = {
    user: "bg-slate-200 text-slate-700",
    moderator: "bg-purple-100 text-purple-700",
    admin: "bg-rose-600 text-white",
  }[roleName] ?? "bg-slate-200 text-slate-700";

  const joinedDisplay = user.is_staff ? "Core team" : "Community member";
  const contributionStats = [
    { label: "Submissions", helper: "Stats appear after your first submission." },
    { label: "Comments", helper: "Activity syncs once you participate." },
    { label: "Wishlist", helper: "Wardrobe saves and favorites populate here." },
  ] as const;

  const WardrobeEntryCard = ({ entry, variant, compact = false, onViewDetails, onMoveToWardrobe, onRemove }: WardrobeEntryCardProps) => {
    const detail = entry.item_detail;
    const brandLabel = detail.brand?.name ?? detail.brand?.slug ?? "Unknown brand";
    const displayName = detail.name ?? detail.slug;
    const normalizedCurrency = entry.currency?.trim() ? entry.currency : null;
    const priceLabel = formatWardrobePrice(entry.price_paid, normalizedCurrency);
    const colors = entry.colors ?? [];
    const colorPreview = colors.slice(0, 3);
    const sizeLabel = entry.size?.trim().length ? entry.size : null;
    const sourceLabel = entry.source?.trim().length ? entry.source : null;
    const note = entry.note?.trim().length ? entry.note.trim() : null;
    const timelineLabel =
      variant === "owned"
        ? entry.acquired_date
          ? `Acquired ${formatWardrobeTimestamp(entry.acquired_date)}`
          : `Added ${formatWardrobeTimestamp(entry.created_at)}`
        : `Wishlisted ${formatWardrobeTimestamp(entry.created_at)}`;
    const statusStyles =
      variant === "owned"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : "border-amber-200 bg-amber-50 text-amber-700";
    const paddingClass = compact ? "p-4" : "p-5";
    const gridGap = compact ? "gap-2" : "gap-3";

    return (
      <li className={`rounded-3xl border border-rose-100 bg-white/95 ${paddingClass} shadow-sm`}>
        <Link href={`/items/${detail.slug}`} className="flex gap-4">
          <div className="w-20 flex-shrink-0 overflow-hidden rounded-2xl border border-rose-50 bg-rose-50">
            <Image
              src={detail.cover_image?.url ?? PLACEHOLDER_IMAGE_URL}
              alt={`${displayName} cover`}
              width={120}
              height={160}
              className="h-24 w-full object-cover"
            />
          </div>
          <div className="flex flex-1 flex-col gap-1 text-left">
            <p className="text-sm font-semibold text-rose-900">{displayName}</p>
            <p className="text-xs uppercase tracking-wide text-rose-400">{brandLabel}</p>
            <p className="text-xs text-rose-500">{timelineLabel}</p>
          </div>
        </Link>
        <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-wide">
          <span className={`rounded-full border px-3 py-1 ${statusStyles}`}>
            {variant === "owned" ? "Owned" : "Wishlist"}
          </span>
          {entry.was_gift ? (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-amber-700">Gifted</span>
          ) : null}
          {entry.is_public ? (
            <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-rose-600">Public</span>
          ) : null}
        </div>
        <dl className={`mt-3 grid text-xs text-rose-500 ${compact ? "" : "sm:grid-cols-2"} ${gridGap}`}>
          {sizeLabel ? (
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-rose-400">Size</dt>
              <dd className="text-rose-900">{sizeLabel}</dd>
            </div>
          ) : null}
          {priceLabel ? (
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-rose-400">Price</dt>
              <dd className="text-rose-900">{priceLabel}</dd>
            </div>
          ) : null}
          {sourceLabel ? (
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-rose-400">Source</dt>
              <dd className="text-rose-900">{sourceLabel}</dd>
            </div>
          ) : null}
        </dl>
        {colorPreview.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-rose-600">
            {colorPreview.map((color, index) => (
              <span key={`${entry.id}-color-${index}`} className="rounded-full bg-rose-50 px-3 py-1">
                {color}
              </span>
            ))}
            {colors.length > colorPreview.length ? (
              <span className="text-[11px] uppercase tracking-wide text-rose-400">
                +{colors.length - colorPreview.length} more
              </span>
            ) : null}
          </div>
        ) : null}
        {note ? <p className="mt-3 text-sm text-rose-700">“{note}”</p> : null}
        <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
          <button
            type="button"
            onClick={() => onViewDetails?.(entry)}
            className="rounded-full border border-rose-200 px-3 py-1 text-rose-700 transition hover:border-rose-300 hover:text-rose-900"
          >
            View details
          </button>
          {variant === "wishlist" ? (
            <button
              type="button"
              onClick={() => onMoveToWardrobe?.(entry)}
              className="rounded-full border border-emerald-200 px-3 py-1 text-emerald-700 transition hover:border-emerald-300 hover:text-emerald-900"
            >
              Move to wardrobe
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => onRemove?.(entry)}
            className="rounded-full border border-rose-100 px-3 py-1 text-rose-500 transition hover:border-rose-200 hover:text-rose-800"
          >
            Remove
          </button>
        </div>
      </li>
    );
  };

  const wardrobeSkeleton = (
    <div className="grid gap-4 sm:grid-cols-2">
      {[0, 1, 2, 3].map((key) => (
        <div key={`wardrobe-skeleton-${key}`} className="rounded-3xl border border-rose-100 bg-white/80 p-4">
          <div className="flex gap-4">
            <div className="h-32 w-24 animate-pulse rounded-2xl bg-rose-50" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/2 animate-pulse rounded-full bg-rose-100" />
              <div className="h-4 w-1/3 animate-pulse rounded-full bg-rose-50" />
              <div className="h-3 w-2/3 animate-pulse rounded-full bg-rose-50" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
  const renderWardrobeFilters = () => (
    <div className="rounded-3xl border border-rose-100 bg-white/90 p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <p className="text-sm font-semibold text-rose-900">Filters & sorting</p>
          <p className="text-xs text-rose-400">Dial in specific entries by metadata or acquisition details.</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
            hasActiveFilters ? "bg-rose-100 text-rose-600" : "bg-slate-100 text-slate-500"
          }`}
        >
          {hasActiveFilters ? `${activeFilterCount} active` : "No filters"}
        </span>
        <button
          type="button"
          onClick={resetFilters}
          className="ml-auto rounded-full border border-rose-200 px-4 py-1 text-xs font-semibold text-rose-700 transition hover:border-rose-300 hover:text-rose-900"
        >
          Reset
        </button>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <label className="text-xs font-semibold uppercase tracking-wide text-rose-400">
          Brand
          <select
            value={filters.brand}
            onChange={(event) => updateFilters("brand", event.target.value)}
            className="mt-2 w-full rounded-2xl border border-rose-200 px-3 py-2 text-sm text-rose-900 focus:border-rose-400 focus:outline-none"
          >
            <option value="">All brands</option>
            {filterOptions.brands.map((brand) => (
              <option key={brand.value} value={brand.value}>
                {brand.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold uppercase tracking-wide text-rose-400">
          Category
          <select
            value={filters.category}
            onChange={(event) => updateFilters("category", event.target.value)}
            className="mt-2 w-full rounded-2xl border border-rose-200 px-3 py-2 text-sm text-rose-900 focus:border-rose-400 focus:outline-none"
          >
            <option value="">All categories</option>
            {filterOptions.categories.map((category) => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold uppercase tracking-wide text-rose-400">
          Year
          <select
            value={filters.year}
            onChange={(event) => updateFilters("year", event.target.value)}
            className="mt-2 w-full rounded-2xl border border-rose-200 px-3 py-2 text-sm text-rose-900 focus:border-rose-400 focus:outline-none"
          >
            <option value="">Any year</option>
            {filterOptions.years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-rose-400">Colorway</p>
        {filterOptions.colors.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {filterOptions.colors.map((color) => {
              const isSelected = filters.colors.includes(color.value);
              return (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => toggleColorFilter(color.value)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide transition ${
                    isSelected
                      ? "border-rose-400 bg-rose-50 text-rose-900"
                      : "border-rose-100 text-rose-500 hover:border-rose-200"
                  }`}
                >
                  {color.label}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="mt-2 text-xs text-rose-400">Colors will appear once you log palettes.</p>
        )}
      </div>
      <div className="mt-4 grid gap-3 text-sm text-rose-600 md:grid-cols-2">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={filters.hasArrival}
            onChange={(event) => updateFilters("hasArrival", event.target.checked)}
            className="rounded border-rose-300 text-rose-600 focus:ring-rose-500"
          />
          Arrivals logged
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={filters.hasPrice}
            onChange={(event) => updateFilters("hasPrice", event.target.checked)}
            className="rounded border-rose-300 text-rose-600 focus:ring-rose-500"
          />
          Price recorded
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={filters.giftedOnly}
            onChange={(event) => updateFilters("giftedOnly", event.target.checked)}
            className="rounded border-rose-300 text-rose-600 focus:ring-rose-500"
          />
          Gifts only
        </label>
      </div>
      <div className="mt-4">
        <label className="text-xs font-semibold uppercase tracking-wide text-rose-400">
          Sort by
          <select
            value={filters.sort}
            onChange={(event) => updateFilters("sort", event.target.value as WardrobeSortOption)}
            className="mt-2 w-full rounded-2xl border border-rose-200 px-3 py-2 text-sm text-rose-900 focus:border-rose-400 focus:outline-none"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );

  const renderActivePanel = () => {
    switch (activeTab) {
      case "wardrobe": {
        const wardrobeStats = [
          { label: "Owned pieces", value: ownedEntries.length },
          { label: "Wishlist items", value: wishlistEntries.length },
          { label: "Public entries", value: publicEntryCount },
        ];
        return (
          <div className="space-y-6">
            <div className="rounded-3xl border border-rose-100 bg-white p-6">
              <div className="flex flex-wrap items-center gap-4">
                <h3 className="text-xl font-semibold text-rose-900">Wardrobe overview</h3>
                <span className="ml-auto text-xs uppercase tracking-wide text-rose-400">Synced automatically</span>
              </div>
              <p className="mt-2 text-sm text-rose-500">
                Use the wardrobe button on any item to log ownership details or tag it for your wishlist.
              </p>
              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                {wardrobeStats.map((stat) => (
                  <div key={stat.label} className="rounded-2xl border border-rose-100 bg-rose-50/60 p-4 text-center">
                    <p className="text-xs font-semibold uppercase tracking-wide text-rose-400">{stat.label}</p>
                    <p className="mt-2 text-2xl font-semibold text-rose-900">{stat.value}</p>
                  </div>
                ))}
              </div>
            </div>
            {renderWardrobeFilters()}
            <p className="text-sm text-rose-500">
              Showing {filteredOwnedEntries.length} of {ownedEntries.length} owned entries
              {hasActiveFilters ? " with filters applied." : "."}
            </p>
            {wardrobeError ? (
              <p className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{wardrobeError}</p>
            ) : null}
            {wardrobeLoading ? (
              wardrobeSkeleton
            ) : filteredOwnedEntries.length > 0 ? (
              <ul className="grid gap-4 md:grid-cols-2">
                {filteredOwnedEntries.map((entry) => (
                  <WardrobeEntryCard
                    key={entry.id}
                    entry={entry}
                    variant="owned"
                    onViewDetails={handleViewEntryDetails}
                    onRemove={handleEntryRemoval}
                  />
                ))}
              </ul>
            ) : hasActiveFilters ? (
              <div className="rounded-3xl border border-dashed border-rose-200 bg-white/80 p-8 text-center">
                <p className="text-sm font-semibold text-rose-900">No entries match your filters</p>
                <p className="mt-2 text-sm text-rose-500">Adjust or reset filters to see more of your wardrobe.</p>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="mt-4 inline-flex rounded-full border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:text-rose-900"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-rose-200 bg-white/80 p-8 text-center">
                <p className="text-sm font-semibold text-rose-900">No wardrobe entries yet</p>
                <p className="mt-2 text-sm text-rose-500">Save an item from the catalog and it will show up here instantly.</p>
                <Link href="/search" className="mt-4 inline-flex rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white">
                  Browse catalog
                </Link>
              </div>
            )}
            <div className="rounded-3xl border border-rose-100 bg-white/90 p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div>
                  <p className="text-sm font-semibold text-rose-900">Wishlist preview</p>
                  <p className="text-sm text-rose-500">
                    {wishlistEntries.length > 0
                      ? "Items you&rsquo;re actively hunting next."
                      : "Mark entries as wishlist to keep an eye on future finds."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => selectTab("wishlist")}
                  className="rounded-full border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:text-rose-900"
                >
                  Open wishlist
                </button>
              </div>
              {wishlistEntries.length > 0 ? (
                <ul className="mt-4 grid gap-4 md:grid-cols-2">
                  {filteredWishlistEntries.slice(0, 2).map((entry) => (
                    <WardrobeEntryCard
                      key={`wishlist-preview-${entry.id}`}
                      entry={entry}
                      variant="wishlist"
                      compact
                      onViewDetails={handleViewEntryDetails}
                      onMoveToWardrobe={handleMoveEntryToWardrobe}
                      onRemove={handleEntryRemoval}
                    />
                  ))}
                </ul>
              ) : hasActiveFilters ? (
                <p className="mt-4 text-sm text-rose-400">No wishlist items match the current filters.</p>
              ) : null}
            </div>
          </div>
        );
      }
      case "activity":
        return (
          <div className="space-y-6">
            <div className="rounded-3xl border border-rose-100 bg-white p-5">
              <h3 className="text-lg font-semibold text-rose-900">Comments</h3>
              <div className="mt-4 rounded-2xl border border-dashed border-rose-200 bg-rose-50/40 p-4 text-sm text-rose-500">
                Your catalog conversations will surface here once comments are connected to the profile view.
              </div>
            </div>
            <div className="rounded-3xl border border-rose-100 bg-white p-5">
              <h3 className="text-lg font-semibold text-rose-900">Engagement timeline</h3>
              <div className="mt-4 rounded-2xl border border-dashed border-rose-200 p-4 text-sm text-rose-500">
                Mentions, follows, and other activity signals will appear here soon. Wishlist and wardrobe saves now live under the My Wardrobe section.
              </div>
            </div>
          </div>
        );
      case "wishlist":
        return (
          <div className="space-y-6">
            <div className="rounded-3xl border border-rose-100 bg-white p-5">
              <h3 className="text-lg font-semibold text-rose-900">Wishlist</h3>
              <p className="mt-2 text-sm text-rose-500">
                Track pieces you&rsquo;re scouting for future drops or secondhand finds.
              </p>
              <div className="mt-4 flex flex-wrap gap-3 text-xs text-rose-500">
                <span className="rounded-full border border-rose-200 px-3 py-1">Items: {wishlistEntries.length}</span>
                <span className="rounded-full border border-rose-200 px-3 py-1">Owned backlog: {ownedEntries.length}</span>
              </div>
              <Link
                href="/search"
                className="mt-4 inline-flex rounded-full border border-rose-200 px-4 py-2 text-xs font-semibold text-rose-700"
              >
                Explore catalog
              </Link>
            </div>
            {renderWardrobeFilters()}
            <p className="text-sm text-rose-500">
              Showing {filteredWishlistEntries.length} of {wishlistEntries.length} wishlist items
              {hasActiveFilters ? " (filtered)" : ""}
            </p>
            {wardrobeLoading ? (
              wardrobeSkeleton
            ) : filteredWishlistEntries.length > 0 ? (
              <ul className="grid gap-4 md:grid-cols-2">
                {filteredWishlistEntries.map((entry) => (
                  <WardrobeEntryCard
                    key={entry.id}
                    entry={entry}
                    variant="wishlist"
                    onViewDetails={handleViewEntryDetails}
                    onMoveToWardrobe={handleMoveEntryToWardrobe}
                    onRemove={handleEntryRemoval}
                  />
                ))}
              </ul>
            ) : hasActiveFilters ? (
              <div className="rounded-3xl border border-dashed border-rose-200 bg-white/80 p-8 text-center">
                <p className="text-sm font-semibold text-rose-900">No wishlist entries match the current filters</p>
                <p className="mt-2 text-sm text-rose-500">Clear filters or pick a different combination to continue scouting.</p>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="mt-4 inline-flex rounded-full border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:text-rose-900"
                >
                  Reset filters
                </button>
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-rose-200 bg-white/80 p-8 text-center">
                <p className="text-sm font-semibold text-rose-900">Wishlist is empty</p>
                <p className="mt-2 text-sm text-rose-500">
                  While browsing, choose “Wishlist” in the wardrobe modal to start tracking future acquisitions.
                </p>
                <Link href="/search" className="mt-4 inline-flex rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white">
                  Find items
                </Link>
              </div>
            )}
          </div>
        );
      case "submissions":
        return (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-4">
              <h3 className="text-xl font-semibold text-rose-900">Contribution timeline</h3>
              <Link
                href="/add-entry"
                className="ml-auto rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700"
              >
                Submit new item
              </Link>
            </div>
            <div className="rounded-3xl border border-dashed border-rose-200 bg-white/70 p-6 text-sm text-rose-500">
              You have not submitted any catalog entries yet. Drafts and approvals will display here once the submissions API is connected.
            </div>
          </div>
        );
      case "profile":
        return (
          <div className="space-y-6">
            <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
              <div className="rounded-3xl border border-rose-100 bg-white p-5">
                <p className="text-xs uppercase tracking-wide text-rose-400">Display name</p>
                <input
                  type="text"
                  defaultValue={user.display_name || user.username}
                  className="mt-2 w-full rounded-2xl border border-rose-200 px-4 py-2 text-sm focus:border-rose-400 focus:outline-none"
                />
                <p className="mt-4 text-xs uppercase tracking-wide text-rose-400">Bio</p>
                <textarea
                  rows={4}
                  placeholder="Share inspirations, favorite brands, or wardrobe focus."
                  className="mt-2 w-full rounded-2xl border border-rose-200 px-4 py-2 text-sm focus:border-rose-400 focus:outline-none"
                />
                <p className="mt-4 text-xs uppercase tracking-wide text-rose-400">Website or socials</p>
                <input
                  type="url"
                  placeholder="https://"
                  className="mt-2 w-full rounded-2xl border border-rose-200 px-4 py-2 text-sm focus:border-rose-400 focus:outline-none"
                />
              </div>
              <div className="rounded-3xl border border-rose-100 bg-white p-5">
                <p className="text-xs uppercase tracking-wide text-rose-400">Avatar</p>
                <div className="mt-3 flex flex-col items-center gap-3">
                  <div className="h-24 w-24 rounded-full bg-rose-50" aria-hidden="true" />
                  <button className="rounded-full border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700">Upload photo</button>
                </div>
                <p className="mt-6 text-xs uppercase tracking-wide text-rose-400">Pronouns</p>
                <select className="mt-2 w-full rounded-2xl border border-rose-200 px-4 py-2 text-sm">
                  <option>She / Her</option>
                  <option>He / Him</option>
                  <option>They / Them</option>
                  <option>Custom</option>
                </select>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <button className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700">
                Save profile
              </button>
              <button
                type="button"
                onClick={() => selectTab("account")}
                className="rounded-full border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700"
              >
                Open settings
              </button>
            </div>
          </div>
        );
      case "moderation":
        return isModerator ? (
          <div className="space-y-6">
            <div className="rounded-3xl border border-dashed border-rose-200 bg-white/70 p-6 text-sm text-rose-500">
              Moderation queue metrics will appear once the review dashboard is connected to this view. Continue using the admin console for real-time counts.
            </div>
            <div className="rounded-3xl border border-rose-100 bg-white p-5">
              <h3 className="text-lg font-semibold text-rose-900">Quick links</h3>
              <p className="text-sm text-rose-500">Jump to the existing moderation tools while this panel is being wired up.</p>
              <div className="mt-4 flex flex-wrap gap-3 text-xs">
                <Link href="/admin/" target="_blank" className="rounded-full border border-rose-200 px-3 py-1 text-rose-700">
                  Open Django admin
                </Link>
                <Link href="/profile?panel=submissions" className="rounded-full border border-rose-200 px-3 py-1 text-rose-700">
                  Review submissions
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-rose-500">Moderation access is available to moderators and admins.</p>
        );
      case "admin":
        return isAdmin ? (
          <div className="space-y-6">
            <div className="rounded-3xl border border-dashed border-rose-200 bg-white/70 p-6 text-sm text-rose-500">
              Admin analytics and management shortcuts will appear here once the dashboard is powered by live data. Continue using the Django admin and internal tools for user or content management in the meantime.
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <Link href="/admin/" target="_blank" className="rounded-3xl border border-rose-100 bg-white p-5 text-sm text-rose-700">
                Open Django admin
              </Link>
              <Link href="/profile?panel=moderation" className="rounded-3xl border border-rose-100 bg-white p-5 text-sm text-rose-700">
                View moderation panel
              </Link>
            </div>
          </div>
        ) : (
          <p className="text-sm text-rose-500">Admin controls are restricted to platform administrators.</p>
        );
      case "account":
        return (
          <div className="space-y-8">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl border border-rose-100 bg-white p-5">
                <p className="text-xs uppercase tracking-wide text-rose-400">Email</p>
                <div className="mt-2 flex gap-2">
                  <input
                    type="email"
                    defaultValue={user.email}
                    className="w-full rounded-2xl border border-rose-200 px-4 py-2 text-sm focus:border-rose-400 focus:outline-none"
                  />
                  <button className="rounded-2xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white">Update</button>
                </div>
              </div>
              <div className="rounded-3xl border border-rose-100 bg-white p-5">
                <p className="text-xs uppercase tracking-wide text-rose-400">Password</p>
                <div className="mt-2 flex gap-2">
                  <input type="password" placeholder="New password" className="w-full rounded-2xl border border-rose-200 px-4 py-2 text-sm" />
                  <button className="rounded-2xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white">Change</button>
                </div>
              </div>
              <div className="rounded-3xl border border-rose-100 bg-white p-5">
                <p className="text-xs uppercase tracking-wide text-rose-400">Notifications</p>
                <label className="mt-3 flex items-center gap-2 text-sm text-rose-600">
                  <input type="checkbox" className="rounded border-rose-300 text-rose-600 focus:ring-rose-500" />
                  Email me about submission updates
                </label>
                <label className="mt-2 flex items-center gap-2 text-sm text-rose-600">
                  <input type="checkbox" className="rounded border-rose-300 text-rose-600 focus:ring-rose-500" />
                  New collection drops
                </label>
              </div>
              <div className="rounded-3xl border border-rose-100 bg-white p-5">
                <p className="text-xs uppercase tracking-wide text-rose-400">Profile visibility</p>
                <select className="mt-3 rounded-2xl border border-rose-200 px-4 py-2 text-sm">
                  <option>Public</option>
                  <option>Followers only</option>
                  <option>Private</option>
                </select>
              </div>
            </div>
            <div className="rounded-3xl border border-rose-100 bg-white p-5">
              <p className="text-xs uppercase tracking-wide text-rose-400">Delete account</p>
              <p className="mt-2 text-sm text-rose-500">
                Permanently remove your profile and associated data. This action cannot be undone.
              </p>
              <button className="mt-3 rounded-full border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-600">
                Delete account
              </button>
            </div>
          </div>
        );
      default:
        return <p className="text-sm text-rose-500">Select a section to get started.</p>;
    }
  };

  const entryDialogNode = entryDialog ? (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-rose-950/40 px-4 py-8"
      role="dialog"
      aria-modal="true"
      onClick={handleEntryModalBackgroundClick}
    >
      <div className="w-full max-w-3xl rounded-3xl border border-rose-100 bg-white p-6 shadow-2xl" role="document">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-rose-400">
              {entryDialog.mode === "move" ? "Move to wardrobe" : "Entry detail"}
            </p>
            <h3 className="text-xl font-semibold text-rose-900">
              {entryDialog.entry.item_detail.name ?? entryDialog.entry.item_detail.slug}
            </h3>
            <p className="text-sm text-rose-500">
              {entryDialog.entry.item_detail.brand?.name ?? entryDialog.entry.item_detail.brand?.slug ?? "Unknown brand"}
            </p>
          </div>
          <button
            type="button"
            onClick={closeEntryDialog}
            disabled={entryDialogSaving}
            className="rounded-full border border-rose-200 p-2 text-rose-500 transition hover:border-rose-300 hover:text-rose-900 disabled:opacity-60"
            aria-label="Close entry dialog"
          >
            ✕
          </button>
        </div>
        {entryDialogError ? (
          <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{entryDialogError}</p>
        ) : null}
        {entryDialog.mode === "detail" ? (
          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="space-y-4">
              <div className="flex gap-4 rounded-2xl border border-rose-100 bg-rose-50/50 p-4">
                <div className="h-36 w-28 overflow-hidden rounded-2xl border border-rose-100 bg-rose-50">
                  <Image
                    src={entryDialog.entry.item_detail.cover_image?.url ?? PLACEHOLDER_IMAGE_URL}
                    alt={`${entryDialog.entry.item_detail.name ?? entryDialog.entry.item_detail.slug} cover`}
                    width={180}
                    height={240}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="flex flex-1 flex-col gap-2 text-sm text-rose-500">
                  <p>
                    Added {formatWardrobeTimestamp(entryDialog.entry.created_at)} ·
                    {" "}
                    {entryDialog.entry.status === "owned"
                      ? entryDialog.entry.acquired_date
                        ? `Acquired ${formatWardrobeTimestamp(entryDialog.entry.acquired_date)}`
                        : "Awaiting acquisition"
                      : "Wishlist"}
                  </p>
                  <p className="text-xs uppercase tracking-wide text-rose-400">
                    Visibility: {entryDialog.entry.is_public ? "Public" : "Private"}
                  </p>
                  {entryDialog.entry.was_gift ? (
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">Marked as gift</p>
                  ) : null}
                </div>
              </div>
              {entryDialog.entry.note ? (
                <blockquote className="rounded-2xl border border-rose-100 bg-white/90 p-4 text-sm text-rose-700">
                  “{entryDialog.entry.note}”
                </blockquote>
              ) : null}
              {entryDialog.entry.colors && entryDialog.entry.colors.length > 0 ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-rose-400">Colors logged</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-rose-600">
                    {entryDialog.entry.colors.map((color, index) => (
                      <span key={`${entryDialog.entry.id}-detail-color-${index}`} className="rounded-full bg-rose-50 px-3 py-1">
                        {color}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
            <div className="space-y-4">
              <dl className="grid gap-3 text-sm text-rose-600">
                {[{
                  label: "Status",
                  value: entryDialog.entry.status === "owned" ? "Owned" : "Wishlist",
                },
                { label: "Size", value: entryDialog.entry.size?.trim() || "—" },
                { label: "Source", value: entryDialog.entry.source?.trim() || "—" },
                {
                  label: "Acquired",
                  value: entryDialog.entry.acquired_date ? formatWardrobeTimestamp(entryDialog.entry.acquired_date) : "—",
                },
                {
                  label: "Arrival",
                  value: entryDialog.entry.arrival_date ? formatWardrobeTimestamp(entryDialog.entry.arrival_date) : "—",
                },
                {
                  label: "Price",
                  value: formatWardrobePrice(entryDialog.entry.price_paid, entryDialog.entry.currency) ?? "—",
                }].map((row) => (
                  <div key={`${entryDialog.entry.id}-${row.label}`} className="rounded-2xl border border-rose-100 bg-white/90 p-3">
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-rose-400">{row.label}</dt>
                    <dd className="text-rose-900">{row.value}</dd>
                  </div>
                ))}
              </dl>
              <div className="flex flex-wrap gap-3">
                <Link
                  href={`/items/${entryDialog.entry.item_detail.slug}`}
                  className="inline-flex flex-1 justify-center rounded-full border border-rose-200 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-rose-700 transition hover:border-rose-300 hover:text-rose-900"
                >
                  View item page
                </Link>
                <button
                  type="button"
                  onClick={() => openEntryDetail(entryDialog.entry, entryDialog.entry.status === "owned" ? "move" : "move")}
                  className="rounded-full border border-emerald-200 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-700 transition hover:border-emerald-300 hover:text-emerald-900"
                >
                  {entryDialog.entry.status === "owned" ? "Edit entry" : "Move to wardrobe"}
                </button>
                <button
                  type="button"
                  onClick={() => handleEntryRemoval(entryDialog.entry)}
                  className="rounded-full border border-rose-200 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-rose-500 transition hover:border-rose-300 hover:text-rose-800"
                >
                  Remove entry
                </button>
              </div>
            </div>
          </div>
        ) : (
          <form className="mt-6 space-y-5" onSubmit={handleMoveFormSubmit}>
            <p className="text-sm text-rose-500">
              Capture acquisition details so this wishlist piece transitions into your owned wardrobe.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-rose-400">
                Acquired date
                <input
                  type="date"
                  value={entryDialog.form.acquired_date}
                  onChange={(event) => updateMoveForm("acquired_date", event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-rose-200 px-3 py-2 text-sm text-rose-900 focus:border-rose-400 focus:outline-none"
                />
              </label>
              <label className="text-xs font-semibold uppercase tracking-wide text-rose-400">
                Arrival date
                <input
                  type="date"
                  value={entryDialog.form.arrival_date}
                  onChange={(event) => updateMoveForm("arrival_date", event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-rose-200 px-3 py-2 text-sm text-rose-900 focus:border-rose-400 focus:outline-none"
                />
              </label>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-rose-400">
                Price paid
                <input
                  type="text"
                  value={entryDialog.form.price_paid}
                  onChange={(event) => updateMoveForm("price_paid", event.target.value)}
                  disabled={disableMovePriceInputs}
                  placeholder="1200"
                  className="mt-2 w-full rounded-2xl border border-rose-200 px-3 py-2 text-sm text-rose-900 focus:border-rose-400 focus:outline-none disabled:bg-rose-50"
                />
              </label>
              <label className="text-xs font-semibold uppercase tracking-wide text-rose-400">
                Currency
                <input
                  type="text"
                  value={entryDialog.form.currency}
                  onChange={(event) => updateMoveForm("currency", event.target.value.toUpperCase())}
                  disabled={disableMovePriceInputs}
                  placeholder="USD"
                  className="mt-2 w-full rounded-2xl border border-rose-200 px-3 py-2 text-sm uppercase text-rose-900 focus:border-rose-400 focus:outline-none disabled:bg-rose-50"
                />
              </label>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-rose-400">
                Size
                <input
                  type="text"
                  value={entryDialog.form.size}
                  onChange={(event) => updateMoveForm("size", event.target.value)}
                  placeholder="JP 2 / US 0"
                  className="mt-2 w-full rounded-2xl border border-rose-200 px-3 py-2 text-sm text-rose-900 focus:border-rose-400 focus:outline-none"
                />
              </label>
              <label className="text-xs font-semibold uppercase tracking-wide text-rose-400">
                Source
                <input
                  type="text"
                  value={entryDialog.form.source}
                  onChange={(event) => updateMoveForm("source", event.target.value)}
                  placeholder="Brand boutique"
                  className="mt-2 w-full rounded-2xl border border-rose-200 px-3 py-2 text-sm text-rose-900 focus:border-rose-400 focus:outline-none"
                />
              </label>
            </div>
            <label className="text-xs font-semibold uppercase tracking-wide text-rose-400">
              Colors
              <input
                type="text"
                value={entryDialog.form.colorsText}
                onChange={(event) => updateMoveForm("colorsText", event.target.value)}
                placeholder="navy, cream"
                className="mt-2 w-full rounded-2xl border border-rose-200 px-3 py-2 text-sm text-rose-900 focus:border-rose-400 focus:outline-none"
              />
            </label>
            <label className="text-xs font-semibold uppercase tracking-wide text-rose-400">
              Notes
              <textarea
                rows={3}
                value={entryDialog.form.note}
                onChange={(event) => updateMoveForm("note", event.target.value)}
                className="mt-2 w-full rounded-2xl border border-rose-200 px-3 py-2 text-sm text-rose-900 focus:border-rose-400 focus:outline-none"
              />
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex items-center gap-2 text-sm text-rose-600">
                <input
                  type="checkbox"
                  checked={entryDialog.form.was_gift}
                  onChange={(event) => updateMoveForm("was_gift", event.target.checked)}
                  className="rounded border-rose-300 text-rose-600 focus:ring-rose-500"
                />
                Marked as gift
              </label>
              <label className="flex items-center gap-2 text-sm text-rose-600">
                <input
                  type="checkbox"
                  checked={entryDialog.form.is_public}
                  onChange={(event) => updateMoveForm("is_public", event.target.checked)}
                  className="rounded border-rose-300 text-rose-600 focus:ring-rose-500"
                />
                Public on profile
              </label>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={entryDialogSaving}
                className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
              >
                {entryDialogSaving ? "Saving…" : "Save to wardrobe"}
              </button>
              <button
                type="button"
                onClick={() => openEntryDetail(entryDialog.entry, "detail")}
                disabled={entryDialogSaving}
                className="rounded-full border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:text-rose-900 disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  ) : null;

  return (
    <>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 lg:flex-row">
        <aside className="rounded-3xl border border-rose-100 bg-white/80 p-4 shadow-inner lg:w-64" aria-label="Profile sections">
        <div className="flex flex-col" role="tablist">
          {availableTabs.map((tab) => {
            const isSelected = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => selectTab(tab.id)}
                className={`mb-2 rounded-2xl border px-4 py-3 text-left transition ${
                  isSelected
                    ? "border-rose-300 bg-rose-50 text-rose-900"
                    : "border-transparent text-rose-500 hover:border-rose-100 hover:bg-rose-50"
                }`}
              >
                <span className="text-sm font-semibold">{tab.label}</span>
                <span className="block text-xs text-rose-400">{tab.description}</span>
              </button>
            );
          })}
        </div>
      </aside>
      <div className="flex-1 space-y-10">
        <header className="rounded-3xl border border-rose-100 bg-white/95 p-8 shadow-lg">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-1 items-center gap-4">
              <div className="relative h-20 w-20 overflow-hidden rounded-full border border-rose-100 bg-rose-50">
                {user.avatar_url ? (
                  <Image
                    src={user.avatar_url}
                    alt={`${user.display_name || user.username}'s profile picture`}
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-2xl font-semibold text-rose-500">
                    {(user.display_name || user.username).charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-3xl font-semibold text-rose-900">{user.display_name || user.username}</h1>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${roleBadgeClass}`}>
                    {roleName.toUpperCase()}
                  </span>
                </div>
                <p className="text-sm text-rose-500">
                  @{user.username} · {joinedDisplay}
                </p>
                <p className="text-sm text-rose-500">{user.email}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => selectTab("profile")}
                className="rounded-full border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:text-rose-900"
              >
                Edit profile
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleLogout();
                }}
                className="rounded-full border border-transparent px-4 py-2 text-sm font-semibold text-rose-500 transition hover:border-rose-200 hover:bg-rose-50"
              >
                Sign out
              </button>
            </div>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {contributionStats.map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-rose-100 p-4">
                <p className="text-xs uppercase tracking-wide text-rose-400">{stat.label}</p>
                <p className="text-2xl font-semibold text-rose-900">-</p>
                <p className="text-xs text-rose-400">{stat.helper}</p>
              </div>
            ))}
          </div>
        </header>
        <section className="rounded-3xl border border-rose-100 bg-white/95 p-8 shadow-lg" role="tabpanel">
          {renderActivePanel()}
        </section>
      </div>
      </div>
      {entryDialogNode}
    </>
  );
}
