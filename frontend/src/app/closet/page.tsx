"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent, MouseEvent } from "react";
import jsPDF from "jspdf";

import { useAuth } from "@/components/auth-provider";
import {
  deleteWardrobeEntry,
  getItemDetail,
  listWardrobeEntries,
  saveWardrobeEntry,
  type ItemDetail,
  type WardrobeEntry,
} from "@/lib/api";
import { useCurrencyOptions } from "@/lib/useCurrencyOptions";

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

type WardrobeExportScope = "owned" | "wishlist";
type ShareTarget = "owned" | "wishlist";

const imageDataUrlCache = new Map<string, string>();

async function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Failed to read image data"));
      }
    };
    reader.onerror = () => reject(new Error("Unable to process image"));
    reader.readAsDataURL(blob);
  });
}

async function fetchImageDataUrl(src: string): Promise<string | null> {
  if (imageDataUrlCache.has(src)) {
    return imageDataUrlCache.get(src) ?? null;
  }
  try {
    const response = await fetch(src, { mode: "cors" });
    if (!response.ok) {
      return null;
    }
    const blob = await response.blob();
    const dataUrl = await readBlobAsDataUrl(blob);
    imageDataUrlCache.set(src, dataUrl);
    return dataUrl;
  } catch (error) {
    console.warn("Failed to fetch image for export", error);
    return null;
  }
}

function getImageFormat(dataUrl: string): "JPEG" | "PNG" {
  if (dataUrl.startsWith("data:image/png")) {
    return "PNG";
  }
  return "JPEG";
}

async function resolveEntryImage(entry: WardrobeEntry): Promise<{ dataUrl: string; format: "JPEG" | "PNG" } | null> {
  const candidates = [entry.item_detail.cover_image?.url, PLACEHOLDER_IMAGE_URL];
  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }
    const dataUrl = await fetchImageDataUrl(candidate);
    if (dataUrl) {
      return { dataUrl, format: getImageFormat(dataUrl) };
    }
  }
  return null;
}

async function exportEntriesToPdfGallery(entries: WardrobeEntry[], scope: WardrobeExportScope) {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
  const marginX = 40;
  const marginY = 48;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const gutter = 20;
  const availableWidth = pageWidth - marginX * 2;
  const cardsPerRow = 2;
  const cardWidth = (availableWidth - gutter) / cardsPerRow;
  const cardHeight = 320;
  const imageHeight = 190;
  const imageWidth = cardWidth - 24;
  const title = `Jiraibrary ${scope === "owned" ? "Owned wardrobe" : "Wishlist"} gallery`;

  const addPageHeader = () => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(title, marginX, marginY - 12);
  };

  addPageHeader();

  let cursorX = marginX;
  let cursorY = marginY;

  for (const entry of entries) {
    if (cursorY + cardHeight > pageHeight - marginY) {
      doc.addPage();
      addPageHeader();
      cursorY = marginY;
      cursorX = marginX;
    }

    doc.setDrawColor(244, 228, 233);
    doc.setFillColor(255, 252, 253);
    doc.roundedRect(cursorX, cursorY, cardWidth, cardHeight, 16, 16, "FD");

    const media = await resolveEntryImage(entry);
    if (media) {
      doc.addImage(
        media.dataUrl,
        media.format,
        cursorX + 12,
        cursorY + 18,
        imageWidth,
        imageHeight,
        undefined,
        "FAST",
      );
    }

    let textY = cursorY + 18 + imageHeight + 18;
    const textX = cursorX + 12;
    const textWidth = cardWidth - 24;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    const name = entry.item_detail.name ?? entry.item_detail.slug;
    const nameLines = doc.splitTextToSize(name, textWidth);
    nameLines.forEach((line: string) => {
      doc.text(line, textX, textY);
      textY += 14;
    });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    const brand = entry.item_detail.brand?.name ?? entry.item_detail.brand?.slug ?? "Unknown brand";
    doc.text(brand, textX, textY);
    textY += 12;

    doc.setFontSize(10);
    doc.text(`Status: ${entry.status === "owned" ? "Owned" : "Wishlist"}`, textX, textY);
    textY += 12;
    if (entry.colors && entry.colors.length > 0) {
      const colorLine = `Colors: ${entry.colors.slice(0, 3).join(", ")}${entry.colors.length > 3 ? "…" : ""}`;
      const colorLines = doc.splitTextToSize(colorLine, textWidth);
      colorLines.forEach((line: string) => {
        doc.text(line, textX, textY);
        textY += 12;
      });
    }

    cursorX += cardWidth + gutter;
    if (cursorX + cardWidth > pageWidth - marginX + 1) {
      cursorX = marginX;
      cursorY += cardHeight + gutter;
    }
  }

  const timestamp = new Date().toISOString().slice(0, 10);
  doc.save(`jiraibrary-${scope}-gallery-${timestamp}.pdf`);
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
  colors: string[];
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
  colors: entry.colors ?? [],
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

type ClosetTab = {
  id: "owned" | "wishlist" | "stats";
  label: string;
  description: string;
};

export default function ClosetPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, token, loading } = useAuth();
  const defaultTabId: ClosetTab["id"] = "owned";
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
  const [itemDetails, setItemDetails] = useState<Record<string, ItemDetail | null>>({});
  const [itemDetailsLoading, setItemDetailsLoading] = useState<Record<string, boolean>>({});
  const [exportingScope, setExportingScope] = useState<WardrobeExportScope | null>(null);
  const [shareTarget, setShareTarget] = useState<ShareTarget>("owned");
  const [shareOrigin, setShareOrigin] = useState("");
  const [copyFeedback, setCopyFeedback] = useState<ShareTarget | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [sharePromptOpen, setSharePromptOpen] = useState(false);
  const { currencyOptions } = useCurrencyOptions();

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
    if (filters.brand) count += 1;
    if (filters.category) count += 1;
    count += filters.colors.length;
    if (filters.hasArrival) count += 1;
    if (filters.hasPrice) count += 1;
    if (filters.giftedOnly) count += 1;
    if (filters.year) count += 1;
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

  const handleExportEntries = useCallback(
    async (entries: WardrobeEntry[], scopeLabel: WardrobeExportScope) => {
      if (entries.length === 0) {
        window.alert("No entries to export yet. Add a few pieces first.");
        return;
      }
      setExportingScope(scopeLabel);
      try {
        await exportEntriesToPdfGallery(entries, scopeLabel);
      } catch (error) {
        console.error("Failed to export closet", error);
        window.alert("Unable to generate your export. Please try again shortly.");
      } finally {
        setExportingScope(null);
      }
    },
    [],
  );

  const closetStats = useMemo(() => {
    const brandCounts = new Map<string, number>();
    const colorCounts = new Map<string, number>();
    const timelineCounts = new Map<string, number>();
    const spendByCurrency = new Map<string, number>();

    ownedEntries.forEach((entry) => {
      const brandLabel = entry.item_detail.brand?.name ?? entry.item_detail.brand?.slug ?? "Unknown";
      brandCounts.set(brandLabel, (brandCounts.get(brandLabel) ?? 0) + 1);

      (entry.colors ?? []).forEach((color) => {
        const normalized = color.trim();
        if (!normalized) {
          return;
        }
        const key = normalized.toLowerCase();
        colorCounts.set(key, (colorCounts.get(key) ?? 0) + 1);
      });

      const year = extractEntryYear(entry);
      if (year) {
        timelineCounts.set(year, (timelineCounts.get(year) ?? 0) + 1);
      }

      if (entry.price_paid && entry.currency) {
        const amount = Number(entry.price_paid);
        if (!Number.isNaN(amount)) {
          const currency = entry.currency.toUpperCase();
          spendByCurrency.set(currency, (spendByCurrency.get(currency) ?? 0) + amount);
        }
      }
    });

    wishlistEntries.forEach((entry) => {
      (entry.colors ?? []).forEach((color) => {
        const normalized = color.trim();
        if (!normalized) {
          return;
        }
        const key = normalized.toLowerCase();
        colorCounts.set(key, (colorCounts.get(key) ?? 0) + 1);
      });
    });

    const toSortedArray = (map: Map<string, number>) =>
      Array.from(map.entries())
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count);

    const brandTotals = toSortedArray(brandCounts).slice(0, 6);
    const rawColorTotals = Array.from(colorCounts.entries()).map(([key, count]) => ({
      label: key
        .split(" ")
        .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
        .join(" "),
      count,
    }));
    const colorTotals = rawColorTotals.sort((a, b) => b.count - a.count).slice(0, 8);
    const timelineTotals = toSortedArray(timelineCounts).sort((a, b) => Number(b.label) - Number(a.label));
    const spendTotals = Array.from(spendByCurrency.entries()).map(([currency, amount]) => ({ currency, amount }));

    return { brandTotals, colorTotals, timelineTotals, spendTotals };
  }, [ownedEntries, wishlistEntries]);

  const closetTabs: ClosetTab[] = useMemo(
    () => [
      { id: "owned", label: "Owned", description: "Pieces that already live in your closet" },
      { id: "wishlist", label: "Wishlist", description: "Items you're manifesting next" },
      { id: "stats", label: "Stats", description: "Color, brand, and spend insights" },
    ],
    [],
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    setShareOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (!copyFeedback) {
      return;
    }
    const timeout = window.setTimeout(() => setCopyFeedback(null), 2000);
    return () => window.clearTimeout(timeout);
  }, [copyFeedback]);

  const shareOwnedUrl = useMemo(() => {
    if (!user || !shareOrigin) {
      return "";
    }
    return `${shareOrigin}/closet?tab=owned&user=${encodeURIComponent(user.username)}`;
  }, [shareOrigin, user]);

  const shareWishlistUrl = useMemo(() => {
    if (!user || !shareOrigin) {
      return "";
    }
    return `${shareOrigin}/closet?tab=wishlist&user=${encodeURIComponent(user.username)}`;
  }, [shareOrigin, user]);

  const handleShareCopy = useCallback(
    async (target: ShareTarget) => {
      const url = target === "owned" ? shareOwnedUrl : shareWishlistUrl;
      if (!url) {
        return;
      }
      setShareError(null);
      try {
        if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(url);
        } else {
          const textarea = document.createElement("textarea");
          textarea.value = url;
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand("copy");
          document.body.removeChild(textarea);
        }
        setCopyFeedback(target);
      } catch (error) {
        console.error("Failed to copy share link", error);
        setShareError("Unable to copy link automatically. Use the text field to copy it manually.");
      }
    },
    [shareOwnedUrl, shareWishlistUrl],
  );

  const shareOwnedEnabled = Boolean(user?.share_owned_public);
  const shareWishlistEnabled = Boolean(user?.share_wishlist_public);
  const shareTargetsAvailable = shareOwnedEnabled || shareWishlistEnabled;
  const shareTargetUrl = shareTarget === "owned" ? shareOwnedUrl : shareWishlistUrl;
  const shareTargetEnabled = shareTarget === "owned" ? shareOwnedEnabled : shareWishlistEnabled;

  useEffect(() => {
    if (!sharePromptOpen) {
      return;
    }
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSharePromptOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [sharePromptOpen]);

  useEffect(() => {
    if (!loading && !user) {
      router.replace(`/login?next=${encodeURIComponent("/closet")}`);
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
          setWardrobeError("Unable to load your closet right now.");
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
    (tabId: ClosetTab["id"]) => {
      const params = new URLSearchParams(searchParams.toString());
      if (tabId === defaultTabId) {
        params.delete("tab");
      } else {
        params.set("tab", tabId);
      }
      const query = params.toString();
      router.replace(`/closet${query ? `?${query}` : ""}`, { scroll: false });
    },
    [defaultTabId, router, searchParams],
  );

  const tabParam = searchParams.get("tab") as ClosetTab["id"] | null;
  const activeTab = tabParam && closetTabs.some((tab) => tab.id === tabParam) ? tabParam : defaultTabId;

  useEffect(() => {
    if (!tabParam) {
      return;
    }
    const exists = closetTabs.some((tab) => tab.id === tabParam);
    if (!exists) {
      selectTab(defaultTabId);
    }
  }, [closetTabs, defaultTabId, selectTab, tabParam]);

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

  useEffect(() => {
    const slug = entryDialog?.entry.item_detail.slug;
    if (!slug || itemDetails[slug] || itemDetailsLoading[slug]) {
      return;
    }
    let cancelled = false;
    setItemDetailsLoading((previous) => ({ ...previous, [slug]: true }));
    const loadDetail = async () => {
      try {
        const detail = await getItemDetail(slug);
        if (!cancelled) {
          setItemDetails((previous) => ({ ...previous, [slug]: detail }));
        }
      } catch (error) {
        console.error("Failed to load item detail", error);
        if (!cancelled) {
          setItemDetails((previous) => ({ ...previous, [slug]: null }));
        }
      } finally {
        if (!cancelled) {
          setItemDetailsLoading((previous) => ({ ...previous, [slug]: false }));
        }
      }
    };
    void loadDetail();
    return () => {
      cancelled = true;
    };
  }, [entryDialog, itemDetails, itemDetailsLoading]);

  const hasActiveFilters = activeFilterCount > 0;
  const disableMovePriceInputs = entryDialog?.form.was_gift ?? false;
  const entryItemDetail = entryDialog ? itemDetails[entryDialog.entry.item_detail.slug] : null;

  const colorOptions = useMemo(() => {
    if (!entryDialog) {
      return [];
    }
    const optionMap = new Map<string, string>();
    const palette = [...(entryItemDetail?.colors ?? []), ...(entryDialog.entry.item_detail.colors ?? [])];
    palette.forEach((color) => {
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
    (entryDialog.form.colors ?? []).forEach((color) => {
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
  }, [entryDialog, entryItemDetail]);

  const sizeOptions = useMemo(() => {
    if (!entryDialog) {
      return [];
    }
    const variantSizes = (entryItemDetail?.variants ?? [])
      .map((variant) => variant.size_descriptor?.trim())
      .filter((value): value is string => Boolean(value));
    const unique = Array.from(new Set(variantSizes));
    const existingSize = entryDialog.form.size?.trim();
    if (existingSize && !unique.includes(existingSize)) {
      unique.push(existingSize);
    }
    return unique;
  }, [entryDialog, entryItemDetail]);

  const currencySelectOptions = useMemo(() => {
    const registry = new Map(currencyOptions.map((option) => [option.code, option]));
    const itemCurrency = entryDialog?.entry.item_detail.primary_price?.currency?.toUpperCase();
    if (itemCurrency && !registry.has(itemCurrency)) {
      registry.set(itemCurrency, { code: itemCurrency, label: itemCurrency });
    }
    const current = entryDialog?.form.currency?.trim().toUpperCase();
    if (current && !registry.has(current)) {
      registry.set(current, { code: current, label: current });
    }
    return Array.from(registry.values());
  }, [currencyOptions, entryDialog?.entry.item_detail.primary_price?.currency, entryDialog?.form.currency]);

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
    const colorTokens = form.colors.map((color) => color.trim()).filter((color) => color.length > 0);
    const rawPrice = form.price_paid.trim();
    const hasPrice = !form.was_gift && rawPrice.length > 0;
    if (hasPrice) {
      const numericValue = Number(rawPrice);
      if (Number.isNaN(numericValue) || numericValue < 0) {
        setEntryDialogError("Enter a valid price paid amount.");
        setEntryDialogSaving(false);
        return;
      }
    }
    const normalizedCurrency = form.was_gift ? "" : form.currency.trim().toUpperCase();
    if (hasPrice && !normalizedCurrency) {
      setEntryDialogError("Select the currency used for this purchase.");
      setEntryDialogSaving(false);
      return;
    }
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
      price_paid: hasPrice ? rawPrice : null,
      currency: form.was_gift ? "" : normalizedCurrency,
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
      const shouldRemove = window.confirm("Remove this entry from your closet?");
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
      <div className="mt-4 space-y-4">
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

  const summaryCards = [
    { label: "Owned pieces", value: ownedEntries.length },
    { label: "Wishlist", value: wishlistEntries.length },
    { label: "Public entries", value: publicEntryCount },
  ];

  const isExportingScope = (scope: WardrobeExportScope) => exportingScope === scope;
  const anyExporting = exportingScope !== null;

  const renderOwnedTab = () => (
    <div className="space-y-6">
      <div className="rounded-3xl border border-rose-100 bg-white p-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[220px]">
            <h3 className="text-xl font-semibold text-rose-900">Owned wardrobe</h3>
            <p className="text-sm text-rose-500">Everything you&rsquo;ve logged as part of your real-life closet.</p>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={anyExporting}
              onClick={() => void handleExportEntries(hasActiveFilters ? filteredOwnedEntries : ownedEntries, "owned")}
              className="rounded-full border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:text-rose-900 disabled:opacity-60"
            >
              {isExportingScope("owned") ? "Building gallery…" : "Export gallery (.pdf)"}
            </button>
            <Link
              href="/search"
              className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700"
            >
              Add to wardrobe
            </Link>
          </div>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {summaryCards.map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-rose-100 bg-rose-50/60 p-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-rose-400">{stat.label}</p>
              <p className="mt-2 text-2xl font-semibold text-rose-900">{stat.value}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-4">
        <p className="text-sm text-rose-500">
          Showing {filteredOwnedEntries.length} of {ownedEntries.length} pieces{hasActiveFilters ? " (filtered)" : ""}
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
            <p className="mt-2 text-sm text-rose-500">Adjust filter combos to see more of your closet.</p>
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
      </div>
    </div>
  );

  const renderWishlistTab = () => (
    <div className="space-y-6">
      <div className="rounded-3xl border border-rose-100 bg-white p-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[220px]">
            <h3 className="text-xl font-semibold text-rose-900">Wishlist</h3>
            <p className="text-sm text-rose-500">Pieces you&rsquo;re manifesting or hunting on the resale market.</p>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={anyExporting}
              onClick={() => void handleExportEntries(hasActiveFilters ? filteredWishlistEntries : wishlistEntries, "wishlist")}
              className="rounded-full border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:text-rose-900 disabled:opacity-60"
            >
              {isExportingScope("wishlist") ? "Building gallery…" : "Export gallery (.pdf)"}
            </button>
            <Link
              href="/search"
              className="rounded-full border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:text-rose-900"
            >
              Explore catalog
            </Link>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3 text-xs text-rose-500">
          <span className="rounded-full border border-rose-200 px-3 py-1">Wishlist items: {wishlistEntries.length}</span>
          <span className="rounded-full border border-rose-200 px-3 py-1">Owned backlog: {ownedEntries.length}</span>
        </div>
      </div>
      <div className="space-y-4">
        <p className="text-sm text-rose-500">
          Showing {filteredWishlistEntries.length} of {wishlistEntries.length} wishlist items{hasActiveFilters ? " (filtered)" : ""}
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
            <p className="mt-2 text-sm text-rose-500">Clear filters or try a lighter combo.</p>
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
            <p className="mt-2 text-sm text-rose-500">While browsing, choose “Wishlist” in the wardrobe modal to start tracking future finds.</p>
            <Link href="/search" className="mt-4 inline-flex rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white">
              Find items
            </Link>
          </div>
        )}
      </div>
    </div>
  );

  const renderStatsTab = () => (
    <div className="space-y-6">
      <div className="rounded-3xl border border-rose-100 bg-white p-6">
        <h3 className="text-xl font-semibold text-rose-900">Closet analytics</h3>
        <p className="text-sm text-rose-500">A quick look at the colors, brands, spending, and timelines defining your style archive.</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border border-rose-100 bg-white/95 p-5 shadow-sm">
          <h4 className="text-sm font-semibold uppercase tracking-wide text-rose-500">Top brands</h4>
          {closetStats.brandTotals.length > 0 ? (
            <ul className="mt-3 space-y-2 text-sm text-rose-700">
              {closetStats.brandTotals.map((brand) => (
                <li key={brand.label} className="flex items-center justify-between rounded-2xl border border-rose-50 bg-rose-50/70 px-3 py-2">
                  <span>{brand.label}</span>
                  <span className="text-xs font-semibold text-rose-500">{brand.count}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-rose-400">Brands will appear after you log a few pieces.</p>
          )}
        </section>
        <section className="rounded-3xl border border-rose-100 bg-white/95 p-5 shadow-sm">
          <h4 className="text-sm font-semibold uppercase tracking-wide text-rose-500">Color palette</h4>
          {closetStats.colorTotals.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-rose-700">
              {closetStats.colorTotals.map((color) => (
                <span key={color.label} className="rounded-full border border-rose-100 bg-rose-50 px-3 py-1">
                  {color.label} · {color.count}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-rose-400">Log a few colors to unlock this palette view.</p>
          )}
        </section>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border border-rose-100 bg-white/95 p-5 shadow-sm">
          <h4 className="text-sm font-semibold uppercase tracking-wide text-rose-500">Spending summary</h4>
          {closetStats.spendTotals.length > 0 ? (
            <ul className="mt-3 space-y-2 text-sm text-rose-700">
              {closetStats.spendTotals.map((spend) => (
                <li key={spend.currency} className="flex items-center justify-between rounded-2xl border border-rose-50 bg-rose-50/70 px-3 py-2">
                  <span>{spend.currency}</span>
                  <span className="text-xs font-semibold text-rose-500">
                    {new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: spend.currency,
                      maximumFractionDigits: 0,
                    }).format(spend.amount)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-rose-400">Record purchase prices to surface this breakdown.</p>
          )}
        </section>
        <section className="rounded-3xl border border-rose-100 bg-white/95 p-5 shadow-sm">
          <h4 className="text-sm font-semibold uppercase tracking-wide text-rose-500">Year acquired</h4>
          {closetStats.timelineTotals.length > 0 ? (
            <ul className="mt-3 space-y-2 text-sm text-rose-700">
              {closetStats.timelineTotals.map((year) => (
                <li key={year.label} className="flex items-center justify-between rounded-2xl border border-rose-50 bg-rose-50/70 px-3 py-2">
                  <span>{year.label}</span>
                  <span className="text-xs font-semibold text-rose-500">{year.count}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-rose-400">Add acquisition dates to unlock a timeline.</p>
          )}
        </section>
      </div>
    </div>
  );

  const renderActiveTab = () => {
    switch (activeTab) {
      case "owned":
        return renderOwnedTab();
      case "wishlist":
        return renderWishlistTab();
      case "stats":
        return renderStatsTab();
      default:
        return renderOwnedTab();
    }
  };

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
              <span className="text-[11px] uppercase tracking-wide text-rose-400">+{colors.length - colorPreview.length} more</span>
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
              Move to owned
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
                    Added {formatWardrobeTimestamp(entryDialog.entry.created_at)} · {" "}
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
                {[
                  {
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
                  },
                ].map((row) => (
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
                  {entryDialog.entry.status === "owned" ? "Edit entry" : "Move to owned"}
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
            <p className="text-sm text-rose-500">Capture acquisition details so this wishlist piece transitions into your owned wardrobe.</p>
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
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={entryDialog.form.price_paid}
                  onChange={(event) => updateMoveForm("price_paid", event.target.value)}
                  disabled={disableMovePriceInputs}
                  placeholder="0.00"
                  className="mt-2 w-full rounded-2xl border border-rose-200 px-3 py-2 text-sm text-rose-900 focus:border-rose-400 focus:outline-none disabled:bg-rose-50"
                />
                {!disableMovePriceInputs ? (
                  <span className="mt-2 block text-[11px] text-rose-400">Enter the amount you paid, before currency conversion.</span>
                ) : null}
              </label>
              <label className="text-xs font-semibold uppercase tracking-wide text-rose-400">
                Currency
                <select
                  value={entryDialog.form.currency}
                  onChange={(event) => updateMoveForm("currency", event.target.value.toUpperCase())}
                  disabled={disableMovePriceInputs}
                  className="mt-2 w-full rounded-2xl border border-rose-200 px-3 py-2 text-sm uppercase text-rose-900 focus:border-rose-400 focus:outline-none disabled:bg-rose-50"
                >
                  <option value="">Select currency</option>
                  {currencySelectOptions.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {!disableMovePriceInputs ? (
                  <span className="mt-2 block text-[11px] text-rose-400">Choose the currency you purchased in.</span>
                ) : null}
              </label>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-rose-400">
                Size
                <select
                  value={entryDialog.form.size}
                  onChange={(event) => updateMoveForm("size", event.target.value)}
                  disabled={sizeOptions.length === 0}
                  className="mt-2 w-full rounded-2xl border border-rose-200 px-3 py-2 text-sm text-rose-900 focus:border-rose-400 focus:outline-none disabled:bg-rose-50"
                >
                  <option value="">{sizeOptions.length === 0 ? "No sizes available" : "Select a size"}</option>
                  {sizeOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                {sizeOptions.length === 0 ? (
                  <span className="mt-2 block text-[11px] text-rose-400">Size data is unavailable for this item.</span>
                ) : null}
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
              {colorOptions.length > 0 ? (
                <select
                  multiple
                  value={entryDialog.form.colors}
                  onChange={(event) =>
                    updateMoveForm(
                      "colors",
                      Array.from(event.target.selectedOptions).map((option) => option.value),
                    )
                  }
                  className="mt-2 w-full min-h-[7.5rem] rounded-2xl border border-rose-200 px-3 py-2 text-sm text-rose-900 focus:border-rose-400 focus:outline-none"
                >
                  {colorOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="mt-2 text-sm text-rose-400">No color data captured for this item yet.</p>
              )}
              {colorOptions.length > 0 ? (
                <span className="mt-2 block text-[11px] text-rose-400">Select all colors that apply.</span>
              ) : null}
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

  const shouldShowFilterSidebar = activeTab === "owned" || activeTab === "wishlist";

  return (
    <>
      <div className="mx-auto w-full max-w-6xl space-y-8">
        <header className="rounded-3xl border border-rose-100 bg-white/95 p-8 shadow-lg">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-rose-400">My Closet</p>
              <h1 className="mt-2 text-4xl font-semibold tracking-tight text-rose-900">Dream closet, logged.</h1>
              <p className="mt-3 max-w-2xl text-sm text-rose-500">
                Track what you own, wishlist new grails, and keep tabs on the story behind every piece. Filters, stats, and quick actions keep your wardrobe archive tidy.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/search"
                className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700"
              >
                Add to wardrobe
              </Link>
              <Link
                href="/profile"
                className="rounded-full border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:text-rose-900"
              >
                Back to profile
              </Link>
            </div>
          </div>
          <div className="mt-6 rounded-3xl border border-rose-100 bg-rose-50/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-rose-400">Shareable links</p>
                <p className="mt-1 text-xs text-rose-500">
                  {shareTargetsAvailable
                    ? "Copy a link for whichever tab you&apos;ve made public."
                    : "Both closet tabs are private. Enable sharing in Profile → Account → Closet sharing to generate links."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShareError(null);
                  setSharePromptOpen(true);
                }}
                className="rounded-full border border-rose-200 px-4 py-2 text-xs font-semibold text-rose-700 transition hover:border-rose-300 hover:text-rose-900"
              >
                Share closet link
              </button>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-2" role="tablist">
            {closetTabs.map((tab) => {
              const isSelected = tab.id === activeTab;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => selectTab(tab.id)}
                  className={`rounded-2xl border px-4 py-3 text-left transition ${
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
        </header>
        <div className={shouldShowFilterSidebar ? "grid gap-8 lg:grid-cols-[320px_minmax(0,1fr)]" : ""}>
          {shouldShowFilterSidebar ? <aside className="self-start space-y-4">{renderWardrobeFilters()}</aside> : null}
          <section className="rounded-3xl border border-rose-100 bg-white/95 p-8 shadow-lg" role="tabpanel">
            {renderActiveTab()}
          </section>
        </div>
      </div>
      {sharePromptOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-rose-900/30 px-4 py-10"
          onClick={() => setSharePromptOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="closet-share-dialog-title"
            className="relative w-full max-w-lg rounded-3xl border border-rose-100 bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p id="closet-share-dialog-title" className="text-sm font-semibold text-rose-900">
                  Share your closet
                </p>
                <p className="mt-1 text-xs text-rose-500">
                  Choose a tab and copy the link to send to friends. Links only work when that tab is set to public.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close share dialog"
                onClick={() => setSharePromptOpen(false)}
                className="rounded-full border border-rose-100 p-2 text-xs font-semibold text-rose-500 transition hover:border-rose-200 hover:text-rose-700"
              >
                <span aria-hidden="true">X</span>
              </button>
            </div>
            <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-rose-400">
              Share view
              <select
                value={shareTarget}
                onChange={(event) => setShareTarget(event.target.value as ShareTarget)}
                className="mt-1 w-full rounded-2xl border border-rose-200 px-3 py-2 text-sm text-rose-900 focus:border-rose-400 focus:outline-none"
              >
                <option value="owned">Closet (owned)</option>
                <option value="wishlist">Wishlist</option>
              </select>
            </label>
            <div className="mt-4 flex flex-wrap gap-2">
              <input
                type="text"
                value={shareTargetUrl}
                readOnly
                disabled={!shareTargetEnabled || !shareTargetUrl}
                placeholder="Sharing disabled until this tab is public."
                className="min-w-0 flex-1 rounded-2xl border border-rose-200 bg-white px-3 py-2 text-xs text-rose-700 disabled:border-rose-100 disabled:bg-white"
              />
              <button
                type="button"
                onClick={() => {
                  void handleShareCopy(shareTarget);
                }}
                disabled={!shareTargetEnabled || !shareTargetUrl}
                className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
                  shareTargetEnabled && shareTargetUrl
                    ? "border-rose-200 text-rose-700 hover:border-rose-300 hover:text-rose-900"
                    : "border-rose-100 text-rose-300"
                }`}
              >
                {copyFeedback === shareTarget
                  ? "Copied!"
                  : shareTarget === "owned"
                    ? "Copy closet link"
                    : "Copy wishlist link"}
              </button>
            </div>
            <div className="mt-2 space-y-1">
              {shareTargetEnabled ? (
                <p className="text-xs text-emerald-600">Anyone with the link can view this tab.</p>
              ) : (
                <p className="text-xs text-rose-500">
                  Make this tab public in Profile → Account → Closet sharing before the link becomes active.
                </p>
              )}
              {shareError ? <p className="text-xs text-rose-600">{shareError}</p> : null}
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setSharePromptOpen(false)}
                className="rounded-full border border-rose-200 px-4 py-2 text-xs font-semibold text-rose-700 transition hover:border-rose-300 hover:text-rose-900"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {entryDialogNode}
    </>
  );
}
