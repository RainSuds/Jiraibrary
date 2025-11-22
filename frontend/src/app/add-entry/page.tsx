"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import ImageUploadManager from "@/components/image-upload-manager";
import FilterDropdown, { type FilterDropdownOption } from "@/components/filter-dropdown";
import {
  CreateSubmissionPayload,
  type CollectionProposalPayload,
  createSubmission,
  listBrandSummaries,
  listCategories,
  listSubcategories,
  listStyles,
  listSubstyles,
  listTags,
  listLanguages,
  listColors,
  listFabrics,
  listFeatures,
  listCollections,
  listCurrencies,
  type LanguageSummary,
  type SubmissionNameTranslation,
  type SubmissionDescriptionTranslation,
  type SubmissionFabricBreakdown,
  type SubmissionPriceAmount,
  type CreateSubmissionSizeMeasurementEntry,
  type CategorySummary,
  type SubcategorySummary,
  type StyleSummary,
  type SubstyleSummary,
  type ColorOptionSummary,
  type FabricSummary,
  type FeatureSummary,
  type CollectionSummary,
  type CurrencySummary,
  UploadedImageSummary,
} from "@/lib/api";
import { COUNTRY_OPTIONS } from "@/lib/countries";

const initialForm: CreateSubmissionPayload = {
  title: "",
  brand_name: "",
  description: "",
  tags: [],
};

type NameEntry = {
  id: string;
  language: string;
  value: string;
};

type DescriptionEntry = NameEntry;

type FabricEntry = {
  id: string;
  fabric: string;
  percentage: string;
};

type PriceEntry = {
  id: string;
  currency: string;
  amount: string;
};

type ReferenceLinkEntry = {
  id: string;
  value: string;
};

type DraftData = {
  form: CreateSubmissionPayload;
  selectedBrand: string | null;
  selectedTags: string[];
  nameEntries: NameEntry[];
  descriptionEntries: DescriptionEntry[];
  releaseYear: string;
  selectedCategory: string | null;
  selectedSubcategory: string | null;
  selectedStyles: string[];
  selectedSubstyles: string[];
  selectedColors: string[];
  fabricEntries: FabricEntry[];
  selectedFeatures: string[];
  selectedCollection: string | null;
  collectionMode: CollectionMode;
  newCollectionName: string;
  newCollectionSeason: string;
  newCollectionYear: string;
  newCollectionNotes: string;
  priceEntries: PriceEntry[];
  originCountry: string;
  productionCountry: string;
  limitedEdition: boolean;
  hasMatchingSetFlag: boolean;
  verifiedSource: boolean;
  referenceLinks: ReferenceLinkEntry[];
  sizeEntries: SizeEntry[];
  uploadedImages: UploadedImageSummary[];
};

type DraftState = {
  version: number;
  updatedAt: string;
  data: DraftData;
};

type PreviewSnapshot = {
  title: string;
  names: NameEntry[];
  descriptions: DescriptionEntry[];
  brandLabel: string;
  tags: string[];
  categoryLabel: string | null;
  subcategoryLabel: string | null;
  styles: string[];
  substyles: string[];
  colors: string[];
  features: string[];
  fabrics: Array<{ name: string; percentage: string }>;
  referenceLinks: string[];
  releaseYear: string;
  originCountry: string;
  productionCountry: string;
  limitedEdition: boolean;
  hasMatchingSetFlag: boolean;
  verifiedSource: boolean;
  priceEntries: PriceEntry[];
  sizeEntries: SizeEntry[];
  images: UploadedImageSummary[];
};

const DRAFT_STORAGE_KEY = "jiraibrary:add-entry-draft-v1";

type MeasurementFieldKey =
  | "bust"
  | "waist"
  | "hip"
  | "length"
  | "sleeve_length"
  | "hem"
  | "heel_height"
  | "bag_depth";
type MeasurementUnit = CreateSubmissionSizeMeasurementEntry["unit_system"];

type SizeEntryMeasurements = Partial<Record<MeasurementFieldKey, string>>;

type SizeEntry = {
  id: string;
  sizeLabel: string;
  sizeCategory: string;
  unitSystem: MeasurementUnit;
  notes: string;
  measurements: SizeEntryMeasurements;
  activeFields: MeasurementFieldKey[];
};

type CollectionMode = "existing" | "new";

const COLLECTION_SEASON_OPTIONS = [
  { value: "", label: "Season (optional)" },
  { value: "spring", label: "Spring" },
  { value: "summer", label: "Summer" },
  { value: "fall", label: "Fall" },
  { value: "winter", label: "Winter" },
  { value: "resort", label: "Resort" },
];

const SIZE_CATEGORY_OPTIONS = [
  { value: "alpha", label: "Alpha (XS/S/M/etc.)" },
  { value: "numeric", label: "Numeric (2/4/6)" },
  { value: "shoe", label: "Shoe" },
  { value: "one_size", label: "One size" },
];

const SIZE_CATEGORY_LABEL_MAP = SIZE_CATEGORY_OPTIONS.reduce<Record<string, string>>((map, option) => {
  map[option.value] = option.label;
  return map;
}, {});

const MEASUREMENT_FIELDS: Array<{ key: MeasurementFieldKey; label: string }> = [
  { key: "bust", label: "Bust" },
  { key: "waist", label: "Waist" },
  { key: "hip", label: "Hip" },
  { key: "length", label: "Length" },
  { key: "sleeve_length", label: "Sleeve length" },
  { key: "hem", label: "Hem" },
  { key: "heel_height", label: "Heel height" },
  { key: "bag_depth", label: "Bag depth" },
];

const MEASUREMENT_LABEL_MAP: Record<MeasurementFieldKey, string> = MEASUREMENT_FIELDS.reduce(
  (map, field) => {
    map[field.key] = field.label;
    return map;
  },
  {} as Record<MeasurementFieldKey, string>
);

const UNIT_BADGES = [
  { value: "metric" as const, label: "Metric (cm)" },
  { value: "imperial" as const, label: "Imperial (in)" },
];

const UNIT_LABEL_MAP: Record<MeasurementUnit, string> = UNIT_BADGES.reduce(
  (map, badge) => {
    map[badge.value] = badge.label;
    return map;
  },
  {} as Record<MeasurementUnit, string>
);

function RequiredStar() {
  return <span className="ml-1 align-middle text-rose-500">*</span>;
}

function normalizeMeasurementValue(rawValue: string): string | null {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    return "";
  }
  const normalized = trimmed.replace(/,/g, ".");
  const measurementPattern = /^[-+]?\d{0,4}(?:\.\d{0,4})?$/;
  if (!measurementPattern.test(normalized)) {
    return null;
  }
  return normalized;
}

const FALLBACK_LANGUAGE: LanguageSummary = {
  id: "en",
  code: "en",
  name: "English",
  native_name: "English",
  is_supported: true,
};

function generateEntryId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

type SizeEntryFactoryOptions = {
  unitSystem?: MeasurementUnit;
  sizeCategory?: string;
  sizeLabel?: string;
  activeFields?: MeasurementFieldKey[];
};

function createEmptySizeEntry(options: SizeEntryFactoryOptions = {}): SizeEntry {
  const sizeCategory = options.sizeCategory ?? "alpha";
  const fallbackField = MEASUREMENT_FIELDS[0]?.key;
  const activeFields = options.activeFields ?? (fallbackField ? [fallbackField] : []);
  const measurements: SizeEntryMeasurements = {};
  activeFields.forEach((field) => {
    measurements[field] = "";
  });
  const isOneSizeCategory = sizeCategory === "one_size";
  return {
    id: generateEntryId(),
    sizeLabel: isOneSizeCategory ? "One size" : options.sizeLabel ?? "",
    sizeCategory,
    unitSystem: options.unitSystem ?? "metric",
    notes: "",
    measurements,
    activeFields,
  };
}

function slugifySegment(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

function buildItemSlug(brandSlug: string | null, name: string): string | null {
  const brandSegment = slugifySegment(brandSlug ?? "");
  const nameSegment = slugifySegment(name);
  if (!brandSegment || !nameSegment) {
    return null;
  }
  return `${brandSegment}-${nameSegment}`.replace(/-+/g, "-").slice(0, 120);
}

export default function AddEntryPage() {
  const { user, token, loading, refresh } = useAuth();
  const [form, setForm] = useState<CreateSubmissionPayload>(initialForm);
  const [pending, setPending] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadedImages, setUploadedImages] = useState<UploadedImageSummary[]>([]);
  const [uploaderKey, setUploaderKey] = useState(0);
  const [brandOptions, setBrandOptions] = useState<FilterDropdownOption[]>([]);
  const [tagOptions, setTagOptions] = useState<FilterDropdownOption[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [brandError, setBrandError] = useState<string | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [languages, setLanguages] = useState<LanguageSummary[]>([]);
  const [nameEntries, setNameEntries] = useState<NameEntry[]>(() => [
    { id: generateEntryId(), language: FALLBACK_LANGUAGE.code, value: "" },
  ]);
  const [nameError, setNameError] = useState<string | null>(null);
  const [descriptionEntries, setDescriptionEntries] = useState<DescriptionEntry[]>(() => [
    { id: generateEntryId(), language: FALLBACK_LANGUAGE.code, value: "" },
  ]);
  const [descriptionError, setDescriptionError] = useState<string | null>(null);
  const [categorySummaries, setCategorySummaries] = useState<CategorySummary[]>([]);
  const [subcategorySummaries, setSubcategorySummaries] = useState<SubcategorySummary[]>([]);
  const [styleSummaries, setStyleSummaries] = useState<StyleSummary[]>([]);
  const [substyleSummaries, setSubstyleSummaries] = useState<SubstyleSummary[]>([]);
  const [colorSummaries, setColorSummaries] = useState<ColorOptionSummary[]>([]);
  const [fabricSummaries, setFabricSummaries] = useState<FabricSummary[]>([]);
  const [featureSummaries, setFeatureSummaries] = useState<FeatureSummary[]>([]);
  const [collectionSummaries, setCollectionSummaries] = useState<CollectionSummary[]>([]);
  const [currencySummaries, setCurrencySummaries] = useState<CurrencySummary[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [selectedSubstyles, setSelectedSubstyles] = useState<string[]>([]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [fabricEntries, setFabricEntries] = useState<FabricEntry[]>(() => [
    { id: generateEntryId(), fabric: "", percentage: "" },
  ]);
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [priceEntries, setPriceEntries] = useState<PriceEntry[]>(() => [
    { id: generateEntryId(), currency: "", amount: "" },
  ]);
  const [releaseYear, setReleaseYear] = useState<string>("");
  const [originCountry, setOriginCountry] = useState("");
  const [productionCountry, setProductionCountry] = useState("");
  const [limitedEdition, setLimitedEdition] = useState(false);
  const [hasMatchingSetFlag, setHasMatchingSetFlag] = useState(false);
  const [verifiedSource, setVerifiedSource] = useState(false);
  const [referenceLinks, setReferenceLinks] = useState<ReferenceLinkEntry[]>(() => [
    { id: generateEntryId(), value: "" },
  ]);
  const [sizeEntries, setSizeEntries] = useState<SizeEntry[]>(() => [createEmptySizeEntry()]);
  const [sizeLabelErrors, setSizeLabelErrors] = useState<Record<string, string>>({});
  const [collectionMode, setCollectionMode] = useState<CollectionMode>("existing");
  const [newCollectionName, setNewCollectionName] = useState("");
  const [newCollectionSeason, setNewCollectionSeason] = useState("");
  const [newCollectionYear, setNewCollectionYear] = useState("");
  const [newCollectionNotes, setNewCollectionNotes] = useState("");
  const [previewSnapshot, setPreviewSnapshot] = useState<PreviewSnapshot | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const [draftStatus, setDraftStatus] = useState<string | null>(null);

  const previewImages = previewSnapshot?.images ?? [];
  const previewHeroImage = previewImages[0] ?? null;
  const previewSecondaryImages = previewImages.slice(1, 5);
  const previewAttributeGroups = previewSnapshot
    ? [
        { label: "Tags", items: previewSnapshot.tags },
        { label: "Styles", items: previewSnapshot.styles },
        { label: "Substyles", items: previewSnapshot.substyles },
        { label: "Colors", items: previewSnapshot.colors },
        { label: "Features", items: previewSnapshot.features },
      ]
    : [];
  const previewHasAttributes = previewAttributeGroups.some((group) => group.items.length > 0);
  const previewStatusBadges = previewSnapshot
    ? [
        previewSnapshot.limitedEdition ? "Limited edition" : null,
        previewSnapshot.hasMatchingSetFlag ? "Has matching set" : null,
        previewSnapshot.verifiedSource ? "Source verified" : null,
      ].filter((badge): badge is string => Boolean(badge))
    : [];
  const previewQuickFacts = previewSnapshot
    ? [
        { label: "Category", value: previewSnapshot.categoryLabel ?? "—" },
        { label: "Subcategory", value: previewSnapshot.subcategoryLabel ?? "—" },
        { label: "Release year", value: previewSnapshot.releaseYear || "—" },
        { label: "Origin country", value: previewSnapshot.originCountry || "—" },
        { label: "Production country", value: previewSnapshot.productionCountry || "—" },
      ]
    : [];

  const languageOptions = useMemo(() => {
    const registry = new Map<string, LanguageSummary>();
    for (const language of languages) {
      const normalizedCode = language.code.toLowerCase();
      registry.set(normalizedCode, { ...language, code: normalizedCode });
    }
    if (!registry.has(FALLBACK_LANGUAGE.code)) {
      registry.set(FALLBACK_LANGUAGE.code, FALLBACK_LANGUAGE);
    }
    return Array.from(registry.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [languages]);

  const defaultLanguageCode = useMemo(() => {
    const english = languageOptions.find((language) => language.code === FALLBACK_LANGUAGE.code);
    if (english) {
      return english.code.toLowerCase();
    }
    const fallback = languageOptions[0]?.code ?? FALLBACK_LANGUAGE.code;
    return fallback.toLowerCase();
  }, [languageOptions]);
  const countryOptions = useMemo(() => COUNTRY_OPTIONS, []);

  const brandOptionMap = useMemo(() => new Map(brandOptions.map((option) => [option.value, option])), [brandOptions]);
  const tagOptionMap = useMemo(() => new Map(tagOptions.map((option) => [option.value, option])), [tagOptions]);
  const categoryLabelMap = useMemo(
    () => new Map(categorySummaries.map((category) => [category.slug, category.name])),
    [categorySummaries]
  );
  const subcategoryLabelMap = useMemo(
    () => new Map(subcategorySummaries.map((subcategory) => [subcategory.slug, subcategory.name])),
    [subcategorySummaries]
  );
  const categoryOptions = useMemo(() => {
    return categorySummaries.map((category) => ({
      value: category.slug,
      label: category.name,
    }));
  }, [categorySummaries]);
  const filteredSubcategories = useMemo(() => {
    if (!selectedCategory) {
      return [];
    }
    return subcategorySummaries.filter((subcategory) => subcategory.category?.slug === selectedCategory);
  }, [selectedCategory, subcategorySummaries]);
  const styleLabelMap = useMemo(() => new Map(styleSummaries.map((style) => [style.slug, style.name])), [styleSummaries]);
  const styleOptions = useMemo<FilterDropdownOption[]>(
    () =>
      styleSummaries.map((style) => ({
        value: style.slug,
        label: style.name,
        description: style.description ?? undefined,
      })),
    [styleSummaries]
  );
  const filteredSubstyles = useMemo(() => {
    if (selectedStyles.length === 0) {
      return [];
    }
    const selectedSet = new Set(selectedStyles);
    return substyleSummaries.filter((substyle) => {
      const parentSlug = substyle.style?.slug;
      return parentSlug ? selectedSet.has(parentSlug) : true;
    });
  }, [selectedStyles, substyleSummaries]);
  const substyleLabelMap = useMemo(
    () => new Map(substyleSummaries.map((substyle) => [substyle.slug, substyle.name])),
    [substyleSummaries]
  );
  const substyleOptions = useMemo<FilterDropdownOption[]>(
    () =>
      filteredSubstyles.map((substyle) => ({
        value: substyle.slug,
        label: substyle.name,
        description: substyle.description ?? undefined,
        group: substyle.style?.name ?? null,
      })),
    [filteredSubstyles]
  );
  const colorLabelMap = useMemo(() => new Map(colorSummaries.map((color) => [color.id, color.name])), [colorSummaries]);
  const colorOptions = useMemo<FilterDropdownOption[]>(
    () =>
      colorSummaries.map((color) => ({
        value: color.id,
        label: color.name,
        swatch: color.hex_code ?? undefined,
      })),
    [colorSummaries]
  );
  const featureLabelMap = useMemo(
    () => new Map(featureSummaries.map((feature) => [feature.id, feature.name])),
    [featureSummaries]
  );
  const featureOptions = useMemo<FilterDropdownOption[]>(
    () =>
      featureSummaries.map((feature) => ({
        value: feature.id,
        label: feature.name,
        description: feature.category ?? undefined,
      })),
    [featureSummaries]
  );
  const fabricLabelMap = useMemo(
    () => new Map(fabricSummaries.map((fabric) => [fabric.id, fabric.name])),
    [fabricSummaries]
  );
  const fabricOptions = useMemo(
    () =>
      fabricSummaries.map((fabric) => ({
        value: fabric.id,
        label: fabric.name,
      })),
    [fabricSummaries]
  );
  const activeCurrencyOptions = useMemo(
    () =>
      currencySummaries
        .filter((currency) => currency.is_active)
        .map((currency) => ({
          value: currency.code,
          label: `${currency.code} — ${currency.name}`,
        })),
    [currencySummaries]
  );
  const collectionOptions = useMemo(
    () =>
      collectionSummaries.map((collection) => {
        const brandPrefix = collection.brand?.name ? `${collection.brand.name} — ` : "";
        const seasonSuffix = collection.year ? ` (${collection.year})` : "";
        return {
          value: collection.id,
          label: `${brandPrefix}${collection.name}${seasonSuffix}`,
        };
      }),
    [collectionSummaries]
  );
  const primaryNameValue = useMemo(() => {
    if (nameEntries.length === 0) {
      return "";
    }
    const englishEntry = nameEntries.find(
      (entry) => entry.language?.toLowerCase() === FALLBACK_LANGUAGE.code.toLowerCase()
    );
    return (englishEntry ?? nameEntries[0]).value.trim();
  }, [nameEntries]);
  const generatedItemSlug = useMemo(() => {
    return buildItemSlug(selectedBrand, primaryNameValue) ?? "";
  }, [selectedBrand, primaryNameValue]);

  const activeSizeCategory = sizeEntries[0]?.sizeCategory ?? "alpha";
  const isOneSizeCategory = activeSizeCategory === "one_size";

  useEffect(() => {
    const coverUrl = uploadedImages[0]?.url ?? "";
    setForm((previous) => (previous.image_url === coverUrl ? previous : { ...previous, image_url: coverUrl }));
  }, [uploadedImages]);

  useEffect(() => {
    setNameEntries((previous) =>
      previous.map((entry) => {
        if (entry.language && entry.language.trim()) {
          return entry;
        }
        return { ...entry, language: defaultLanguageCode };
      })
    );
  }, [defaultLanguageCode]);

  useEffect(() => {
    const trimmedTranslations = nameEntries
      .map((entry) => ({
        language: (entry.language || defaultLanguageCode).trim().toLowerCase(),
        value: entry.value.trim(),
      }))
      .filter((entry) => entry.value.length > 0);
    const primary =
      trimmedTranslations.find((entry) => entry.language === FALLBACK_LANGUAGE.code) ??
      trimmedTranslations[0];
    const nextTitle = primary?.value ?? "";
    setForm((previous) => (previous.title === nextTitle ? previous : { ...previous, title: nextTitle }));
    if (trimmedTranslations.length > 0) {
      setNameError(null);
    }
  }, [defaultLanguageCode, nameEntries]);

  useEffect(() => {
    const normalizedDescriptions = descriptionEntries
      .map((entry) => ({
        language: (entry.language || defaultLanguageCode).trim().toLowerCase(),
        value: entry.value.trim(),
      }))
      .filter((entry) => entry.value.length > 0);
    const primaryDescription =
      normalizedDescriptions.find((entry) => entry.language === FALLBACK_LANGUAGE.code) ??
      normalizedDescriptions[0];
    const nextDescription = primaryDescription?.value ?? "";
    setForm((previous) =>
      previous.description === nextDescription ? previous : { ...previous, description: nextDescription }
    );
    if (normalizedDescriptions.length > 0) {
      setDescriptionError(null);
    }
  }, [defaultLanguageCode, descriptionEntries]);

  useEffect(() => {
    let active = true;
    const loadOptions = async () => {
      setOptionsLoading(true);
      setOptionsError(null);
      try {
        const [
          brandSummaries,
          tagSummaries,
          languageSummaries,
          categories,
          subcategories,
          styles,
          substyles,
          colors,
          fabrics,
          features,
          collections,
          currencies,
        ] = await Promise.all([
          listBrandSummaries(),
          listTags(),
          listLanguages().catch((languageError) => {
            console.error("Failed to load supported languages", languageError);
            return null;
          }),
          listCategories(),
          listSubcategories(),
          listStyles(),
          listSubstyles(),
          listColors(),
          listFabrics(),
          listFeatures(),
          listCollections(),
          listCurrencies(),
        ]);
        if (!active) {
          return;
        }
        setBrandOptions(
          brandSummaries.map<FilterDropdownOption>((brand) => ({
            value: brand.slug,
            label: brand.name,
            description: brand.country ?? undefined,
            badge: brand.item_count > 0 ? `${brand.item_count.toLocaleString()} items` : null,
          }))
        );
        setTagOptions(
          tagSummaries.map<FilterDropdownOption>((tag) => ({
            value: tag.id,
            label: tag.name,
            description: tag.type ?? undefined,
          }))
        );
        if (Array.isArray(languageSummaries)) {
          setLanguages(languageSummaries.filter((language) => language.is_supported));
        }
        setCategorySummaries(categories);
        setSubcategorySummaries(subcategories);
        setStyleSummaries(styles);
        setSubstyleSummaries(substyles);
        setColorSummaries(colors);
        setFabricSummaries(fabrics);
        setFeatureSummaries(features);
        setCollectionSummaries(collections);
        setCurrencySummaries(currencies);
      } catch (loadError) {
        if (active) {
          setOptionsError(loadError instanceof Error ? loadError.message : "Unable to load catalog options.");
        }
      } finally {
        if (active) {
          setOptionsLoading(false);
        }
      }
    };
    void loadOptions();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      const stored = window.localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!stored) {
        return;
      }
      const parsed = JSON.parse(stored) as DraftState;
      if (!parsed || !parsed.data) {
        window.localStorage.removeItem(DRAFT_STORAGE_KEY);
        return;
      }
      setHasDraft(true);
      if (parsed.updatedAt) {
        const formatted = new Date(parsed.updatedAt).toLocaleString();
        setDraftStatus(`Draft saved ${formatted}.`);
      } else {
        setDraftStatus("Draft available.");
      }
    } catch (draftError) {
      console.error("Failed to load draft metadata", draftError);
    }
  }, []);

  useEffect(() => {
    if (!isPreviewOpen) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsPreviewOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isPreviewOpen]);
  const handleBrandToggle = useCallback(
    (value: string) => {
      setSelectedBrand((previous) => {
        const next = previous === value ? null : value;
        const option = next ? brandOptionMap.get(next) : null;
        setForm((current) => {
          const nextName = option?.label ?? "";
          return current.brand_name === nextName ? current : { ...current, brand_name: nextName };
        });
        setBrandError(next ? null : "Brand is required.");
        return next;
      });
    },
    [brandOptionMap]
  );

  const handleBrandRemove = useCallback(() => {
    setSelectedBrand(null);
    setForm((current) => (current.brand_name === "" ? current : { ...current, brand_name: "" }));
    setBrandError("Brand is required.");
  }, []);

  const handleTagToggle = useCallback(
    (value: string) => {
      setSelectedTags((previous) => {
        const exists = previous.includes(value);
        const next = exists ? previous.filter((tag) => tag !== value) : [...previous, value];
        setForm((current) => ({
          ...current,
          tags: next.map((tagValue) => tagOptionMap.get(tagValue)?.label ?? tagValue),
        }));
        return next;
      });
    },
    [tagOptionMap]
  );

  const handleTagRemove = useCallback(
    (value: string) => {
      setSelectedTags((previous) => {
        const next = previous.filter((tag) => tag !== value);
        setForm((current) => ({
          ...current,
          tags: next.map((tagValue) => tagOptionMap.get(tagValue)?.label ?? tagValue),
        }));
        return next;
      });
    },
    [tagOptionMap]
  );

  const handleNameValueChange = useCallback((id: string, value: string) => {
    setNameEntries((previous) => {
      const nextEntries = previous.map((entry) => (entry.id === id ? { ...entry, value } : entry));
      const primaryEntry =
        nextEntries.find((entry) => entry.language?.toLowerCase() === FALLBACK_LANGUAGE.code) ?? nextEntries[0];
      if (!primaryEntry || primaryEntry.value.trim().length === 0) {
        setNameError("Please add at least one name before submitting.");
      } else {
        setNameError(null);
      }
      return nextEntries;
    });
  }, []);

  const handleNameLanguageChange = useCallback((id: string, language: string) => {
    setNameEntries((previous) => previous.map((entry) => (entry.id === id ? { ...entry, language } : entry)));
    setNameError(null);
  }, []);

  const handleNameRemove = useCallback((id: string) => {
    setNameEntries((previous) => {
      if (previous.length <= 1) {
        return previous;
      }
      const next = previous.filter((entry) => entry.id !== id);
      return next.length > 0 ? next : previous;
    });
    setNameError(null);
  }, []);

  const handleNameAdd = useCallback(() => {
    setNameEntries((previous) => [...previous, { id: generateEntryId(), language: defaultLanguageCode, value: "" }]);
    setNameError(null);
  }, [defaultLanguageCode]);

  const handleDescriptionValueChange = useCallback((id: string, value: string) => {
    setDescriptionEntries((previous) => {
      const nextEntries = previous.map((entry) => (entry.id === id ? { ...entry, value } : entry));
      const primaryEntry =
        nextEntries.find((entry) => entry.language?.toLowerCase() === FALLBACK_LANGUAGE.code) ?? nextEntries[0];
      if (!primaryEntry || primaryEntry.value.trim().length === 0) {
        setDescriptionError("Please provide at least one description.");
      } else {
        setDescriptionError(null);
      }
      return nextEntries;
    });
  }, []);

  const handleDescriptionLanguageChange = useCallback((id: string, language: string) => {
    setDescriptionEntries((previous) => previous.map((entry) => (entry.id === id ? { ...entry, language } : entry)));
    setDescriptionError(null);
  }, []);

  const handleDescriptionRemove = useCallback((id: string) => {
    setDescriptionEntries((previous) => {
      if (previous.length <= 1) {
        return previous;
      }
      const next = previous.filter((entry) => entry.id !== id);
      return next.length > 0 ? next : previous;
    });
    setDescriptionError(null);
  }, []);

  const handleDescriptionAdd = useCallback(() => {
    setDescriptionEntries((previous) => [
      ...previous,
      { id: generateEntryId(), language: defaultLanguageCode, value: "" },
    ]);
    setDescriptionError(null);
  }, [defaultLanguageCode]);

  const buildPreviewSnapshot = useCallback((): PreviewSnapshot => {
    const brandLabel = selectedBrand ? brandOptionMap.get(selectedBrand)?.label ?? selectedBrand : "Unassigned";
    const tagLabels = selectedTags.map((tag) => tagOptionMap.get(tag)?.label ?? tag);
    const styleLabels = selectedStyles.map((slug) => styleLabelMap.get(slug) ?? slug);
    const substyleLabels = selectedSubstyles.map((slug) => substyleLabelMap.get(slug) ?? slug);
    const colorLabels = selectedColors.map((colorId) => colorLabelMap.get(colorId) ?? colorId);
    const featureLabels = selectedFeatures.map((featureId) => featureLabelMap.get(featureId) ?? featureId);
    const fabrics = fabricEntries
      .filter((entry) => entry.fabric || entry.percentage)
      .map((entry) => ({
        name: entry.fabric ? fabricLabelMap.get(entry.fabric) ?? entry.fabric : "",
        percentage: entry.percentage,
      }))
      .filter((entry) => entry.name);
    const filteredReferenceLinks = referenceLinks.map((entry) => entry.value.trim()).filter(Boolean);
    const filteredPrices = priceEntries.filter((entry) => entry.currency.trim() || entry.amount.trim());
    const meaningfulSizeEntries = sizeEntries.filter((entry) => {
      const trimmedLabel = entry.sizeLabel.trim();
      const hasMeasurements = entry.activeFields.some((fieldKey) => entry.measurements[fieldKey]?.trim());
      const hasNotes = Boolean(entry.notes.trim());
      return trimmedLabel || hasMeasurements || hasNotes;
    });
    return {
      title: primaryNameValue || "(Untitled entry)",
      names: nameEntries,
      descriptions: descriptionEntries,
      brandLabel,
      tags: tagLabels,
      categoryLabel: selectedCategory ? categoryLabelMap.get(selectedCategory) ?? selectedCategory : null,
      subcategoryLabel: selectedSubcategory ? subcategoryLabelMap.get(selectedSubcategory) ?? selectedSubcategory : null,
      styles: styleLabels,
      substyles: substyleLabels,
      colors: colorLabels,
      features: featureLabels,
      fabrics,
      referenceLinks: filteredReferenceLinks,
      releaseYear,
      originCountry,
      productionCountry,
      limitedEdition,
      hasMatchingSetFlag,
      verifiedSource,
      priceEntries: filteredPrices,
      sizeEntries: meaningfulSizeEntries,
      images: uploadedImages,
    };
  }, [
    brandOptionMap,
    categoryLabelMap,
    colorLabelMap,
    descriptionEntries,
    fabricEntries,
    fabricLabelMap,
    featureLabelMap,
    limitedEdition,
    nameEntries,
    originCountry,
    priceEntries,
    primaryNameValue,
    productionCountry,
    referenceLinks,
    releaseYear,
    selectedBrand,
    selectedCategory,
    selectedColors,
    selectedFeatures,
    selectedStyles,
    selectedSubcategory,
    selectedSubstyles,
    selectedTags,
    sizeEntries,
    styleLabelMap,
    subcategoryLabelMap,
    substyleLabelMap,
    hasMatchingSetFlag,
    verifiedSource,
    tagOptionMap,
    uploadedImages,
  ]);

  const buildDraftPayload = useCallback((): DraftData => {
    return {
      form,
      selectedBrand,
      selectedTags,
      nameEntries,
      descriptionEntries,
      releaseYear,
      selectedCategory,
      selectedSubcategory,
      selectedStyles,
      selectedSubstyles,
      selectedColors,
      fabricEntries,
      selectedFeatures,
      selectedCollection,
      collectionMode,
      newCollectionName,
      newCollectionSeason,
      newCollectionYear,
      newCollectionNotes,
      priceEntries,
      originCountry,
      productionCountry,
      limitedEdition,
      hasMatchingSetFlag,
      verifiedSource,
      referenceLinks,
      sizeEntries,
      uploadedImages,
    };
  }, [
    collectionMode,
    descriptionEntries,
    fabricEntries,
    form,
    hasMatchingSetFlag,
    limitedEdition,
    nameEntries,
    newCollectionName,
    newCollectionNotes,
    newCollectionSeason,
    newCollectionYear,
    originCountry,
    priceEntries,
    productionCountry,
    referenceLinks,
    releaseYear,
    selectedBrand,
    selectedCategory,
    selectedCollection,
    selectedColors,
    selectedFeatures,
    selectedStyles,
    selectedSubcategory,
    selectedSubstyles,
    selectedTags,
    sizeEntries,
    uploadedImages,
    verifiedSource,
  ]);

  const applyDraftData = useCallback(
    (data: DraftData) => {
      setForm(data.form ?? initialForm);
      setSelectedBrand(data.selectedBrand ?? null);
      setSelectedTags(data.selectedTags ?? []);
      setNameEntries(data.nameEntries?.length ? data.nameEntries : [{ id: generateEntryId(), language: defaultLanguageCode, value: "" }]);
      setDescriptionEntries(
        data.descriptionEntries?.length ? data.descriptionEntries : [{ id: generateEntryId(), language: defaultLanguageCode, value: "" }]
      );
      setReleaseYear(data.releaseYear ?? "");
      setSelectedCategory(data.selectedCategory ?? null);
      setSelectedSubcategory(data.selectedSubcategory ?? null);
      setSelectedStyles(data.selectedStyles ?? []);
      setSelectedSubstyles(data.selectedSubstyles ?? []);
      setSelectedColors(data.selectedColors ?? []);
      setFabricEntries(data.fabricEntries?.length ? data.fabricEntries : [{ id: generateEntryId(), fabric: "", percentage: "" }]);
      setSelectedFeatures(data.selectedFeatures ?? []);
      setSelectedCollection(data.selectedCollection ?? null);
      setCollectionMode(data.collectionMode ?? "existing");
      setNewCollectionName(data.newCollectionName ?? "");
      setNewCollectionSeason(data.newCollectionSeason ?? "");
      setNewCollectionYear(data.newCollectionYear ?? "");
      setNewCollectionNotes(data.newCollectionNotes ?? "");
      setPriceEntries(data.priceEntries?.length ? data.priceEntries : [{ id: generateEntryId(), currency: "", amount: "" }]);
      setOriginCountry(data.originCountry ?? "");
      setProductionCountry(data.productionCountry ?? "");
      setLimitedEdition(Boolean(data.limitedEdition));
      setHasMatchingSetFlag(Boolean(data.hasMatchingSetFlag));
      setVerifiedSource(Boolean(data.verifiedSource));
      setReferenceLinks(data.referenceLinks?.length ? data.referenceLinks : [{ id: generateEntryId(), value: "" }]);
      setSizeEntries(data.sizeEntries?.length ? data.sizeEntries : [createEmptySizeEntry()]);
      setUploadedImages(data.uploadedImages ?? []);
      setUploaderKey((value) => value + 1);
      setErrorMessage(null);
      setSuccessMessage(null);
      setBrandError(null);
      setCategoryError(null);
      setSizeLabelErrors({});
    },
    [defaultLanguageCode]
  );

  const handleSaveDraft = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      const payload: DraftState = {
        version: 1,
        updatedAt: new Date().toISOString(),
        data: buildDraftPayload(),
      };
      window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(payload));
      setHasDraft(true);
      setDraftStatus(`Draft saved ${new Date(payload.updatedAt).toLocaleString()}.`);
    } catch (draftError) {
      console.error("Failed to save draft", draftError);
      setDraftStatus("Unable to save draft. Please try again.");
    }
  }, [buildDraftPayload]);

  const handleRestoreDraft = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }
    const stored = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!stored) {
      setDraftStatus("No saved draft found.");
      setHasDraft(false);
      return;
    }
    try {
      const parsed = JSON.parse(stored) as DraftState;
      if (!parsed || !parsed.data) {
        throw new Error("Draft is missing data.");
      }
      applyDraftData(parsed.data);
      setDraftStatus(`Draft restored ${new Date().toLocaleTimeString()}.`);
      setHasDraft(true);
    } catch (draftError) {
      console.error("Failed to restore draft", draftError);
      setDraftStatus("Unable to restore draft.");
    }
  }, [applyDraftData]);

  const handleClearDraft = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.removeItem(DRAFT_STORAGE_KEY);
    setHasDraft(false);
    setDraftStatus("Draft cleared.");
  }, []);

  const handlePreviewOpen = useCallback(() => {
    setPreviewSnapshot(buildPreviewSnapshot());
    setIsPreviewOpen(true);
  }, [buildPreviewSnapshot]);

  const handlePreviewClose = useCallback(() => {
    setIsPreviewOpen(false);
  }, []);

  const handleCategoryChange = useCallback(
    (value: string) => {
      setSelectedCategory(value || null);
      setSelectedSubcategory((previous) => {
        if (!value) {
          return null;
        }
        const matching = subcategorySummaries.find((subcategory) => subcategory.slug === previous);
        if (matching && matching.category?.slug === value) {
          return previous;
        }
        return null;
      });
      if (value) {
        setCategoryError(null);
      }
    },
    [subcategorySummaries]
  );

  const handleSubcategoryChange = useCallback((value: string) => {
    setSelectedSubcategory(value || null);
  }, []);

  const handleStyleToggle = useCallback(
    (value: string) => {
      setSelectedStyles((previous) => {
        const exists = previous.includes(value);
        const next = exists ? previous.filter((style) => style !== value) : [...previous, value];
        setSelectedSubstyles((current) =>
          current.filter((substyleSlug) => {
            const substyle = substyleSummaries.find((entry) => entry.slug === substyleSlug);
            const parentSlug = substyle?.style?.slug;
            return parentSlug ? next.includes(parentSlug) : true;
          })
        );
        return next;
      });
    },
    [substyleSummaries]
  );

  const handleStyleRemove = useCallback((value: string) => {
    setSelectedStyles((previous) => previous.filter((style) => style !== value));
    setSelectedSubstyles((current) =>
      current.filter((substyleSlug) => {
        const substyle = substyleSummaries.find((entry) => entry.slug === substyleSlug);
        const parentSlug = substyle?.style?.slug;
        return parentSlug ? parentSlug !== value : true;
      })
    );
  }, [substyleSummaries]);

  const handleSubstyleToggle = useCallback((value: string) => {
    setSelectedSubstyles((previous) => {
      const exists = previous.includes(value);
      return exists ? previous.filter((substyle) => substyle !== value) : [...previous, value];
    });
  }, []);

  const handleSubstyleRemove = useCallback((value: string) => {
    setSelectedSubstyles((previous) => previous.filter((substyle) => substyle !== value));
  }, []);

  const handleColorToggle = useCallback((value: string) => {
    setSelectedColors((previous) => {
      const exists = previous.includes(value);
      return exists ? previous.filter((color) => color !== value) : [...previous, value];
    });
  }, []);

  const handleColorRemove = useCallback((value: string) => {
    setSelectedColors((previous) => previous.filter((color) => color !== value));
  }, []);

  const handleFeatureToggle = useCallback((value: string) => {
    setSelectedFeatures((previous) => {
      const exists = previous.includes(value);
      return exists ? previous.filter((feature) => feature !== value) : [...previous, value];
    });
  }, []);

  const handleFeatureRemove = useCallback((value: string) => {
    setSelectedFeatures((previous) => previous.filter((feature) => feature !== value));
  }, []);

  const handleFabricFieldChange = useCallback((id: string, key: "fabric" | "percentage", value: string) => {
    setFabricEntries((previous) => previous.map((entry) => (entry.id === id ? { ...entry, [key]: value } : entry)));
  }, []);

  const handleFabricRemove = useCallback((id: string) => {
    setFabricEntries((previous) => {
      if (previous.length <= 1) {
        const fallback = previous[0] ?? { id: generateEntryId(), fabric: "", percentage: "" };
        return [{ ...fallback, fabric: "", percentage: "" }];
      }
      return previous.filter((entry) => entry.id !== id);
    });
  }, []);

  const handleFabricAdd = useCallback(() => {
    setFabricEntries((previous) => [...previous, { id: generateEntryId(), fabric: "", percentage: "" }]);
  }, []);

  const handleSizeEntryAdd = useCallback(() => {
    setSizeEntries((previous) => {
      const baseCategory = previous[0]?.sizeCategory ?? "alpha";
      if (baseCategory === "one_size") {
        return previous;
      }
      const lastUnit = previous[previous.length - 1]?.unitSystem ?? "metric";
      return [...previous, createEmptySizeEntry({ unitSystem: lastUnit, sizeCategory: baseCategory })];
    });
  }, []);

  const handleSizeEntryRemove = useCallback((id: string) => {
    setSizeEntries((previous) => {
      if (previous.length === 1) {
        const current = previous[0];
        if (current.id !== id) {
          return previous;
        }
        return [createEmptySizeEntry({ unitSystem: current.unitSystem, sizeCategory: current.sizeCategory })];
      }
      return previous.filter((entry) => entry.id !== id);
    });
    setSizeLabelErrors((previous) => {
      if (!(id in previous)) {
        return previous;
      }
      const next = { ...previous };
      delete next[id];
      return next;
    });
  }, []);

  const handleSizeLabelChange = useCallback((id: string, value: string) => {
    setSizeEntries((previous) => {
      const nextEntries = previous.map((entry) => {
        if (entry.id !== id) {
          return entry;
        }
        if (entry.sizeCategory === "one_size") {
          return entry;
        }
        return { ...entry, sizeLabel: value };
      });
      const target = nextEntries.find((entry) => entry.id === id);
      if (!target) {
        return nextEntries;
      }
      setSizeLabelErrors((current) => {
        if (target.sizeCategory === "one_size") {
          if (!(id in current)) {
            return current;
          }
          const next = { ...current };
          delete next[id];
          return next;
        }
        if (target.sizeLabel.trim().length === 0) {
          if (current[id] === "Size label is required.") {
            return current;
          }
          return { ...current, [id]: "Size label is required." };
        }
        if (!(id in current)) {
          return current;
        }
        const next = { ...current };
        delete next[id];
        return next;
      });
      return nextEntries;
    });
  }, []);

  const handleSizeCategoryChange = useCallback((value: string) => {
    const nextCategory = value || "alpha";
    setSizeEntries((previous) => {
      if (previous.length === 0) {
        if (nextCategory === "one_size") {
          setSizeLabelErrors({});
        }
        return [createEmptySizeEntry({ sizeCategory: nextCategory })];
      }
      const updatedEntries = previous.map((entry) => ({
        ...entry,
        sizeCategory: nextCategory,
        sizeLabel: nextCategory === "one_size" ? "One size" : entry.sizeLabel,
      }));
      if (nextCategory === "one_size") {
        setSizeLabelErrors({});
        return [updatedEntries[0]];
      }
      const nextErrors: Record<string, string> = {};
      updatedEntries.forEach((entry) => {
        if (!entry.sizeLabel.trim()) {
          nextErrors[entry.id] = "Size label is required.";
        }
      });
      setSizeLabelErrors(nextErrors);
      return updatedEntries;
    });
  }, []);

  const handlePriceFieldChange = useCallback((id: string, key: "currency" | "amount", value: string) => {
    setPriceEntries((previous) => previous.map((entry) => (entry.id === id ? { ...entry, [key]: value } : entry)));
  }, []);

  const handlePriceRemove = useCallback((id: string) => {
    setPriceEntries((previous) => {
      if (previous.length <= 1) {
        return previous.map((entry) => (entry.id === id ? { ...entry, currency: "", amount: "" } : entry));
      }
      return previous.filter((entry) => entry.id !== id);
    });
  }, []);

  const handlePriceAdd = useCallback(() => {
    setPriceEntries((previous) => [...previous, { id: generateEntryId(), currency: "", amount: "" }]);
  }, []);

  const handleCollectionChange = useCallback((value: string) => {
    setSelectedCollection(value || null);
  }, []);

  const handleReferenceChange = useCallback((id: string, value: string) => {
    setReferenceLinks((previous) => previous.map((entry) => (entry.id === id ? { ...entry, value } : entry)));
  }, []);

  const handleReferenceRemove = useCallback((id: string) => {
    setReferenceLinks((previous) => {
      if (previous.length === 1) {
        return [{ ...previous[0], value: "" }];
      }
      return previous.filter((entry) => entry.id !== id);
    });
  }, []);

  const handleReferenceAdd = useCallback(() => {
    setReferenceLinks((previous) => [...previous, { id: generateEntryId(), value: "" }]);
  }, []);

  const handleSizeUnitChange = useCallback((id: string, unit: MeasurementUnit) => {
    setSizeEntries((previous) => previous.map((entry) => (entry.id === id ? { ...entry, unitSystem: unit } : entry)));
  }, []);

  const handleSizeMeasurementChange = useCallback((id: string, field: MeasurementFieldKey, value: string) => {
    const normalizedValue = normalizeMeasurementValue(value);
    if (normalizedValue === null) {
      return;
    }
    setSizeEntries((previous) =>
      previous.map((entry) =>
        entry.id === id
          ? { ...entry, measurements: { ...entry.measurements, [field]: normalizedValue } }
          : entry
      )
    );
  }, []);

  const handleSizeNotesChange = useCallback((id: string, value: string) => {
    setSizeEntries((previous) => previous.map((entry) => (entry.id === id ? { ...entry, notes: value } : entry)));
  }, []);
  const handleSizeMeasurementFieldAdd = useCallback((id: string) => {
    setSizeEntries((previous) =>
      previous.map((entry) => {
        if (entry.id !== id) {
          return entry;
        }
        const nextField = MEASUREMENT_FIELDS.find((field) => !entry.activeFields.includes(field.key));
        if (!nextField) {
          return entry;
        }
        return {
          ...entry,
          activeFields: [...entry.activeFields, nextField.key],
          measurements: { ...entry.measurements, [nextField.key]: entry.measurements[nextField.key] ?? "" },
        };
      })
    );
  }, []);

  const handleSizeMeasurementFieldSelectChange = useCallback(
    (id: string, previousField: MeasurementFieldKey, nextField: MeasurementFieldKey) => {
      if (previousField === nextField) {
        return;
      }
      setSizeEntries((previous) =>
        previous.map((entry) => {
          if (entry.id !== id) {
            return entry;
          }
          if (entry.activeFields.includes(nextField)) {
            return entry;
          }
          const nextFields = entry.activeFields.map((field) => (field === previousField ? nextField : field));
          const nextMeasurements = { ...entry.measurements } as SizeEntryMeasurements;
          nextMeasurements[nextField] = nextMeasurements[previousField] ?? "";
          delete nextMeasurements[previousField];
          return {
            ...entry,
            activeFields: nextFields,
            measurements: nextMeasurements,
          };
        })
      );
    },
    []
  );

  const handleSizeMeasurementFieldRemove = useCallback((id: string, field: MeasurementFieldKey) => {
    setSizeEntries((previous) =>
      previous.map((entry) => {
        if (entry.id !== id) {
          return entry;
        }
        if (entry.activeFields.length <= 1) {
          return entry;
        }
        const nextFields = entry.activeFields.filter((key) => key !== field);
        const nextMeasurements = { ...entry.measurements } as SizeEntryMeasurements;
        delete nextMeasurements[field];
        return {
          ...entry,
          activeFields: nextFields,
          measurements: nextMeasurements,
        };
      })
    );
  }, []);

  const handleCollectionModeChange = useCallback(
    (mode: CollectionMode) => {
      setCollectionMode(mode);
      if (mode === "existing") {
        setNewCollectionName("");
        setNewCollectionSeason("");
        setNewCollectionYear("");
        setNewCollectionNotes("");
      } else {
        setSelectedCollection(null);
      }
    },
    [setCollectionMode, setNewCollectionName, setNewCollectionNotes, setNewCollectionSeason, setNewCollectionYear, setSelectedCollection]
  );

  if (!user && !loading) {
    return (
      <div className="mx-auto max-w-2xl rounded-3xl border border-rose-100 bg-white/90 p-8 text-center shadow-lg">
        <h1 className="text-2xl font-semibold text-rose-900">Add Entry</h1>
        <p className="mt-3 text-sm text-rose-500">
          Please
          {" "}
          <Link
            href="/login?next=%2Fadd-entry"
            className="font-semibold text-rose-700 hover:text-rose-900"
          >
            login
          </Link>
          {" "}
          to submit new Jiraibrary catalog entries.
        </p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl rounded-3xl border border-rose-100 bg-white/90 p-8 text-center shadow-lg">
        <p className="text-sm text-rose-500">Loading account details…</p>
      </div>
    );
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) {
      setErrorMessage("You must be logged in to submit an entry.");
      return;
    }
    let hasBlockingError = false;
    if (!form.brand_name.trim()) {
      setBrandError("Brand is required.");
      hasBlockingError = true;
    } else {
      setBrandError(null);
    }
    if (!selectedCategory) {
      setCategoryError("Category is required.");
      hasBlockingError = true;
    } else {
      setCategoryError(null);
    }
    const pendingSizeLabelErrors: Record<string, string> = {};
    sizeEntries.forEach((entry) => {
      if (entry.sizeCategory === "one_size") {
        return;
      }
      const trimmedLabel = entry.sizeLabel.trim();
      const trimmedNotes = entry.notes.trim();
      const hasMeasurements = entry.activeFields.some((fieldKey) => {
        const rawValue = entry.measurements[fieldKey];
        return Boolean(rawValue && rawValue.trim());
      });
      const requiresLabel = hasMeasurements || trimmedNotes.length > 0;
      if (!trimmedLabel && requiresLabel) {
        pendingSizeLabelErrors[entry.id] = "Size label is required.";
      }
    });
    if (Object.keys(pendingSizeLabelErrors).length > 0) {
      setSizeLabelErrors(pendingSizeLabelErrors);
      hasBlockingError = true;
    } else {
      setSizeLabelErrors({});
    }
    if (hasBlockingError) {
      setErrorMessage("Please fix the highlighted fields and try again.");
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setNameError(null);
    setDescriptionError(null);

    const normalizedTranslations: SubmissionNameTranslation[] = nameEntries
      .map((entry) => ({
        language: (entry.language || defaultLanguageCode).trim().toLowerCase(),
        value: entry.value.trim(),
      }))
      .filter((entry) => entry.value.length > 0);

    if (normalizedTranslations.length === 0) {
      setNameError("Please add at least one name before submitting.");
      setErrorMessage("Please fix the highlighted fields and try again.");
      return;
    }

    if (normalizedTranslations.some((entry) => entry.language.length === 0)) {
      setNameError("Each name must include a language selection.");
      return;
    }

    const dedupedTranslations: SubmissionNameTranslation[] = [];
    const languageOrder = new Map<string, number>();
    normalizedTranslations.forEach((translation) => {
      const existingIndex = languageOrder.get(translation.language);
      if (existingIndex !== undefined) {
        dedupedTranslations[existingIndex] = translation;
        return;
      }
      languageOrder.set(translation.language, dedupedTranslations.length);
      dedupedTranslations.push(translation);
    });

    const primaryName =
      dedupedTranslations.find((entry) => entry.language === FALLBACK_LANGUAGE.code) ??
      dedupedTranslations[0];

    const normalizedDescriptions: SubmissionDescriptionTranslation[] = descriptionEntries
      .map((entry) => ({
        language: (entry.language || defaultLanguageCode).trim().toLowerCase(),
        value: entry.value.trim(),
      }))
      .filter((entry) => entry.value.length > 0);

    if (normalizedDescriptions.length === 0) {
      setDescriptionError("Please provide at least one description.");
      setErrorMessage("Please fix the highlighted fields and try again.");
      return;
    }

    if (normalizedDescriptions.some((entry) => entry.language.length === 0)) {
      setDescriptionError("Each description must include a language selection.");
      return;
    }

    const dedupedDescriptions: SubmissionDescriptionTranslation[] = [];
    const descriptionOrder = new Map<string, number>();
    normalizedDescriptions.forEach((translation) => {
      const existingIndex = descriptionOrder.get(translation.language);
      if (existingIndex !== undefined) {
        dedupedDescriptions[existingIndex] = translation;
        return;
      }
      descriptionOrder.set(translation.language, dedupedDescriptions.length);
      dedupedDescriptions.push(translation);
    });

    const primaryDescription =
      dedupedDescriptions.find((entry) => entry.language === FALLBACK_LANGUAGE.code) ??
      dedupedDescriptions[0];

    const trimmedReleaseYear = releaseYear.trim();
    let parsedReleaseYear: number | null = null;
    if (trimmedReleaseYear) {
      const numericYear = Number.parseInt(trimmedReleaseYear, 10);
      if (!Number.isFinite(numericYear) || Number.isNaN(numericYear) || numericYear < 1900 || numericYear > 2100) {
        setErrorMessage("Please enter a release year between 1900 and 2100 or leave it blank.");
        return;
      }
      parsedReleaseYear = numericYear;
    }

    const normalizedFabrics: SubmissionFabricBreakdown[] = fabricEntries
      .map((entry) => ({
        fabric: entry.fabric.trim(),
        percentage: entry.percentage.trim() || undefined,
      }))
      .filter((entry) => entry.fabric.length > 0);

    const normalizedPrices: SubmissionPriceAmount[] = priceEntries
      .map((entry) => ({
        currency: entry.currency.trim().toUpperCase(),
        amount: entry.amount.trim(),
      }))
      .filter((entry) => entry.currency.length > 0 && entry.amount.length > 0);

    const sanitizedOriginCountry = originCountry.trim().toUpperCase();
    const sanitizedProductionCountry = productionCountry.trim().toUpperCase();
    const normalizedReferenceLinks = referenceLinks
      .map((entry) => entry.value.trim())
      .filter((entry, index, source) => entry && source.indexOf(entry) === index);
    const slugFromName = buildItemSlug(selectedBrand, primaryName?.value ?? "");

    let collectionProposal: CollectionProposalPayload | undefined;
    if (collectionMode === "new") {
      const trimmedName = newCollectionName.trim();
      if (!trimmedName) {
        setErrorMessage("Please provide a collection name or choose an existing collection.");
        return;
      }
      const trimmedCollectionYear = newCollectionYear.trim();
      let proposalYear: number | null = null;
      if (trimmedCollectionYear) {
        const numericYear = Number.parseInt(trimmedCollectionYear, 10);
        if (!Number.isFinite(numericYear) || Number.isNaN(numericYear) || numericYear < 1900 || numericYear > 2100) {
          setErrorMessage("Please enter a collection year between 1900 and 2100 or leave it blank.");
          return;
        }
        proposalYear = numericYear;
      }
      collectionProposal = {
        name: trimmedName,
        season: newCollectionSeason || undefined,
        year: proposalYear,
        notes: newCollectionNotes.trim() || undefined,
        brand_slug: selectedBrand ?? undefined,
      };
    }

    const normalizedSizeEntries: CreateSubmissionSizeMeasurementEntry[] = [];
    for (const entry of sizeEntries) {
      const trimmedLabel = entry.sizeLabel.trim();
      const trimmedNotes = entry.notes.trim();
      const measurementPairs = entry.activeFields
        .map((fieldKey) => {
          const rawValue = entry.measurements[fieldKey];
          const cleanedValue = rawValue ? rawValue.trim() : "";
          return cleanedValue ? ([fieldKey, cleanedValue] as [MeasurementFieldKey, string]) : null;
        })
        .filter(Boolean) as Array<[MeasurementFieldKey, string]>;
      const hasMeasurements = measurementPairs.length > 0;
      const hasContent = hasMeasurements || trimmedNotes.length > 0;
      if (!trimmedLabel && !hasContent) {
        continue;
      }
      if (!trimmedLabel && hasContent) {
        setSizeLabelErrors((current) => ({ ...current, [entry.id]: "Size label is required." }));
        setErrorMessage("Please fix the highlighted fields and try again.");
        return;
      }
      if (trimmedLabel && !hasContent) {
        setErrorMessage("Add at least one measurement or note for every size entry.");
        return;
      }
      const measurementPayload: Partial<Record<MeasurementFieldKey, string>> = {};
      for (const [field, value] of measurementPairs) {
        measurementPayload[field] = value;
      }
      normalizedSizeEntries.push({
        size_label: trimmedLabel,
        size_category: entry.sizeCategory || undefined,
        unit_system: entry.unitSystem,
        is_one_size: entry.sizeCategory === "one_size",
        notes: trimmedNotes || undefined,
        ...(measurementPayload as Partial<CreateSubmissionSizeMeasurementEntry>),
      });
    }

    setPending(true);
    try {
      const payload: CreateSubmissionPayload = {
        ...form,
        title: primaryName.value,
        name_translations: dedupedTranslations,
        description: primaryDescription?.value ?? form.description?.trim() ?? "",
        description_translations: dedupedDescriptions,
        reference_url: normalizedReferenceLinks[0] ?? undefined,
        reference_urls: normalizedReferenceLinks.length > 0 ? normalizedReferenceLinks : undefined,
        image_url: uploadedImages[0]?.url ?? undefined,
        item_slug: slugFromName ?? undefined,
        release_year: parsedReleaseYear,
        category_slug: selectedCategory ?? undefined,
        subcategory_slug: selectedSubcategory ?? undefined,
        style_slugs: selectedStyles.length > 0 ? selectedStyles : undefined,
        substyle_slugs: selectedSubstyles.length > 0 ? selectedSubstyles : undefined,
        color_slugs: selectedColors.length > 0 ? selectedColors : undefined,
        fabric_breakdown: normalizedFabrics.length > 0 ? normalizedFabrics : undefined,
        feature_slugs: selectedFeatures.length > 0 ? selectedFeatures : undefined,
        collection_reference: collectionMode === "existing" ? selectedCollection ?? undefined : undefined,
        collection_proposal: collectionProposal,
        price_amounts: normalizedPrices.length > 0 ? normalizedPrices : undefined,
        origin_country: sanitizedOriginCountry || undefined,
        production_country: sanitizedProductionCountry || undefined,
        limited_edition: limitedEdition,
        has_matching_set: hasMatchingSetFlag,
        verified_source: verifiedSource,
        size_measurements: normalizedSizeEntries.length > 0 ? normalizedSizeEntries : undefined,
      };
      await createSubmission(token, payload);
      setForm(initialForm);
      setUploadedImages([]);
      setUploaderKey((value) => value + 1);
      setSelectedBrand(null);
      setSelectedTags([]);
      setNameEntries([{ id: generateEntryId(), language: defaultLanguageCode, value: "" }]);
      setDescriptionEntries([{ id: generateEntryId(), language: defaultLanguageCode, value: "" }]);
      setReleaseYear("");
      setSelectedCategory(null);
      setCategoryError(null);
      setSelectedSubcategory(null);
      setSelectedStyles([]);
      setSelectedSubstyles([]);
      setSelectedColors([]);
      setFabricEntries([{ id: generateEntryId(), fabric: "", percentage: "" }]);
      setSelectedFeatures([]);
      setSelectedCollection(null);
      setCollectionMode("existing");
      setNewCollectionName("");
      setNewCollectionSeason("");
      setNewCollectionYear("");
      setNewCollectionNotes("");
      setPriceEntries([{ id: generateEntryId(), currency: "", amount: "" }]);
      setOriginCountry("");
      setProductionCountry("");
      setLimitedEdition(false);
      setHasMatchingSetFlag(false);
      setVerifiedSource(false);
      setReferenceLinks([{ id: generateEntryId(), value: "" }]);
      setSizeEntries([createEmptySizeEntry()]);
      setBrandError(null);
      setSizeLabelErrors({});
      setSuccessMessage("Submission received! We'll review it shortly.");
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(DRAFT_STORAGE_KEY);
      }
      setHasDraft(false);
      setDraftStatus(null);
      await refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to submit entry.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-4 sm:px-6 lg:px-0">
      <section className="rounded-3xl border border-rose-100 bg-white/95 p-8 shadow-lg">
        <h1 className="text-3xl font-semibold text-rose-900">Add a catalog entry</h1>
        <p className="mt-2 text-sm text-rose-500">
          Provide as much detail as possible so curators can review and publish your entry.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2 text-sm font-medium text-rose-600">
            <span>
              Brand
              <RequiredStar />
            </span>
            <FilterDropdown
              id="brand-select"
              placeholder={optionsLoading ? "Loading brands…" : "Search brand"}
              options={brandOptions}
              selectedValues={selectedBrand ? [selectedBrand] : []}
              onToggle={handleBrandToggle}
              onRemove={handleBrandRemove}
              emptyMessage={optionsLoading ? "Loading…" : "No matches"}
            />
            <span className="text-xs font-normal text-rose-400">
              Start typing to find the closest matching brand. Only one brand can be selected.
            </span>
            {brandError ? <p className="text-xs font-semibold text-rose-600">{brandError}</p> : null}
          </div>
          <div className="flex flex-col gap-2 text-sm font-medium text-rose-600">
            <span>Tags</span>
            <FilterDropdown
              id="tag-select"
              placeholder={optionsLoading ? "Loading tags…" : "Search tags"}
              options={tagOptions}
              selectedValues={selectedTags}
              onToggle={handleTagToggle}
              onRemove={handleTagRemove}
              emptyMessage={optionsLoading ? "Loading…" : "No matches"}
            />
            <span className="text-xs font-normal text-rose-400">
              Choose multiple tags to describe styles, motifs, or fabrics.
            </span>
          </div>
        </div>
        {optionsError ? <p className="mt-2 text-sm text-rose-600">{optionsError}</p> : null}
        <div className="mt-6">
          <ImageUploadManager
            key={uploaderKey}
            token={token ?? null}
            initialImages={uploadedImages}
            onImagesChange={setUploadedImages}
            title="Upload reference images"
            description="Upload multiple images, then drag to reorder. The first image is used as the cover."
          />
        </div>
        <form className="mt-6 flex flex-col gap-5" onSubmit={handleSubmit}>
          <div className="rounded-2xl border border-rose-100 bg-rose-50/40 p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-rose-700">
                  Item names
                  <RequiredStar />
                </p>
                <p className="text-xs font-normal text-rose-400">
                  Add at least one language. English becomes the default catalog title.
                </p>
              </div>
              <button
                type="button"
                onClick={handleNameAdd}
                className="inline-flex items-center justify-center rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600 transition hover:border-rose-300 hover:text-rose-700"
              >
                + Add language
              </button>
            </div>
            <div className="mt-4 flex flex-col gap-4">
              {nameEntries.map((entry) => {
                const isPrimary = entry.language?.toLowerCase() === FALLBACK_LANGUAGE.code;
                return (
                  <div
                    key={entry.id}
                    className="grid items-start gap-3 sm:grid-cols-[minmax(0,0.45fr)_minmax(0,1fr)_auto]"
                  >
                    <div className="flex flex-col gap-1 text-xs font-medium text-rose-600">
                      <label htmlFor={`name-language-${entry.id}`} className="text-xs font-semibold text-rose-600">
                        Language
                      </label>
                      <select
                        id={`name-language-${entry.id}`}
                        value={entry.language}
                        onChange={(event) => handleNameLanguageChange(entry.id, event.target.value)}
                        className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-rose-400 focus:outline-none"
                      >
                        {languageOptions.map((language) => (
                          <option key={language.code} value={language.code}>
                            {language.name}
                            {language.native_name && language.native_name !== language.name
                              ? ` (${language.native_name})`
                              : ""}
                          </option>
                        ))}
                      </select>
                      {isPrimary ? (
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-rose-400">
                          Default catalog title
                        </span>
                      ) : null}
                    </div>
                    <div className="flex flex-col gap-1 text-sm font-medium text-rose-600">
                      <label htmlFor={`name-value-${entry.id}`} className="text-xs font-semibold text-rose-600">
                        Name
                      </label>
                      <input
                        id={`name-value-${entry.id}`}
                        className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-slate-700 shadow-sm focus:border-rose-400 focus:outline-none"
                        value={entry.value}
                        onChange={(event) => handleNameValueChange(entry.id, event.target.value)}
                        placeholder="e.g. Harajuku sailor blouse"
                      />
                    </div>
                    <div className="flex items-end pb-1">
                      <button
                        type="button"
                        onClick={() => handleNameRemove(entry.id)}
                        disabled={nameEntries.length === 1}
                        className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-500 transition hover:border-rose-300 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 grid gap-1 text-xs text-rose-400">
              <span>
                Current catalog title: <span className="font-semibold text-rose-600">{form.title || "—"}</span>
              </span>
              <span>We automatically pick the English name when available, otherwise the first entry.</span>
            </div>
            {nameError ? <p className="mt-3 text-xs font-semibold text-rose-600">{nameError}</p> : null}
          </div>
          <div className="rounded-2xl border border-rose-100 bg-rose-50/40 p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-rose-700">
                  Descriptions
                  <RequiredStar />
                </p>
                <p className="text-xs font-normal text-rose-400">
                  Add narrative context in any languages you speak. English becomes the default catalog description.
                </p>
              </div>
              <button
                type="button"
                onClick={handleDescriptionAdd}
                className="inline-flex items-center justify-center rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600 transition hover:border-rose-300 hover:text-rose-700"
              >
                + Add language
              </button>
            </div>
            <div className="mt-4 flex flex-col gap-4">
              {descriptionEntries.map((entry) => {
                const isPrimary = entry.language?.toLowerCase() === FALLBACK_LANGUAGE.code;
                return (
                  <div
                    key={entry.id}
                    className="grid items-start gap-3 sm:grid-cols-[minmax(0,0.45fr)_minmax(0,1fr)_auto]"
                  >
                    <div className="flex flex-col gap-1 text-xs font-medium text-rose-600">
                      <label htmlFor={`description-language-${entry.id}`} className="text-xs font-semibold text-rose-600">
                        Language
                      </label>
                      <select
                        id={`description-language-${entry.id}`}
                        value={entry.language}
                        onChange={(event) => handleDescriptionLanguageChange(entry.id, event.target.value)}
                        className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-rose-400 focus:outline-none"
                      >
                        {languageOptions.map((language) => (
                          <option key={language.code} value={language.code}>
                            {language.name}
                            {language.native_name && language.native_name !== language.name
                              ? ` (${language.native_name})`
                              : ""}
                          </option>
                        ))}
                      </select>
                      {isPrimary ? (
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-rose-400">
                          Default catalog description
                        </span>
                      ) : null}
                    </div>
                    <div className="flex flex-col gap-1 text-sm font-medium text-rose-600">
                      <label htmlFor={`description-value-${entry.id}`} className="text-xs font-semibold text-rose-600">
                        Description
                      </label>
                      <textarea
                        id={`description-value-${entry.id}`}
                        className="min-h-[140px] rounded-xl border border-rose-200 bg-white px-3 py-2 text-slate-700 shadow-sm focus:border-rose-400 focus:outline-none"
                        value={entry.value}
                        onChange={(event) => handleDescriptionValueChange(entry.id, event.target.value)}
                        placeholder="Describe notable details, motifs, fabrics, references..."
                      />
                    </div>
                    <div className="flex items-end pb-1">
                      <button
                        type="button"
                        onClick={() => handleDescriptionRemove(entry.id)}
                        disabled={descriptionEntries.length === 1}
                        className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-500 transition hover:border-rose-300 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 grid gap-1 text-xs text-rose-400">
              <span>
                Catalog summary: <span className="font-semibold text-rose-600">{form.description || "—"}</span>
              </span>
              <span>We automatically pick the English description when available, otherwise the first entry.</span>
            </div>
            {descriptionError ? <p className="mt-3 text-xs font-semibold text-rose-600">{descriptionError}</p> : null}
          </div>
          <div className="rounded-2xl border border-rose-100 bg-rose-50/40 p-4">
            <p className="text-sm font-semibold text-rose-700">Catalog metadata</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs font-medium text-rose-600">
                <span className="text-xs font-semibold text-rose-600">Item slug</span>
                <input
                  value={generatedItemSlug}
                  readOnly
                  placeholder="Automatically generated from brand and title"
                  className="rounded-xl border border-rose-200 bg-slate-50/60 px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-rose-400 focus:outline-none"
                />
                <span className="text-[10px] font-normal uppercase tracking-wide text-rose-400">
                  Auto-generated from the selected brand and default language title.
                </span>
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-rose-600">
                <span className="text-xs font-semibold text-rose-600">Release year</span>
                <input
                  value={releaseYear}
                  onChange={(event) => setReleaseYear(event.target.value)}
                  placeholder="e.g. 2012"
                  inputMode="numeric"
                  className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-rose-400 focus:outline-none"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-rose-600">
                <span className="text-xs font-semibold text-rose-600">Origin country</span>
                <select
                  value={originCountry}
                  onChange={(event) => setOriginCountry(event.target.value)}
                  className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-rose-400 focus:outline-none"
                >
                  <option value="">Select country</option>
                  {countryOptions.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.name} ({option.code})
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-rose-600">
                <span className="text-xs font-semibold text-rose-600">Production country</span>
                <select
                  value={productionCountry}
                  onChange={(event) => setProductionCountry(event.target.value)}
                  className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-rose-400 focus:outline-none"
                >
                  <option value="">Select country</option>
                  {countryOptions.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.name} ({option.code})
                    </option>
                  ))}
                </select>
              </label>
              <div className="sm:col-span-2 flex flex-col gap-2 text-xs font-medium text-rose-600">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-xs font-semibold text-rose-600">Collection</span>
                  <div className="flex gap-2 text-[10px] font-semibold uppercase tracking-wide text-rose-500">
                    <button
                      type="button"
                      onClick={() => handleCollectionModeChange("existing")}
                      className={`rounded-full px-3 py-1 transition ${
                        collectionMode === "existing"
                          ? "bg-rose-600 text-white shadow"
                          : "border border-rose-200 text-rose-500 hover:border-rose-300"
                      }`}
                    >
                      Link existing
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCollectionModeChange("new")}
                      className={`rounded-full px-3 py-1 transition ${
                        collectionMode === "new"
                          ? "bg-rose-600 text-white shadow"
                          : "border border-rose-200 text-rose-500 hover:border-rose-300"
                      }`}
                    >
                      Propose new
                    </button>
                  </div>
                </div>
                {collectionMode === "existing" ? (
                  <select
                    value={selectedCollection ?? ""}
                    onChange={(event) => handleCollectionChange(event.target.value)}
                    className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-rose-400 focus:outline-none"
                  >
                    <option value="">No collection</option>
                    {collectionOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="flex flex-col gap-1 text-xs font-medium text-rose-600">
                      <span className="text-xs font-semibold text-rose-600">Collection name</span>
                      <input
                        value={newCollectionName}
                        onChange={(event) => setNewCollectionName(event.target.value)}
                        placeholder="e.g. Archive Capsule"
                        className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-rose-400 focus:outline-none"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs font-medium text-rose-600">
                      <span className="text-xs font-semibold text-rose-600">Season</span>
                      <select
                        value={newCollectionSeason}
                        onChange={(event) => setNewCollectionSeason(event.target.value)}
                        className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-rose-400 focus:outline-none"
                      >
                        {COLLECTION_SEASON_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 text-xs font-medium text-rose-600">
                      <span className="text-xs font-semibold text-rose-600">Year</span>
                      <input
                        value={newCollectionYear}
                        onChange={(event) => setNewCollectionYear(event.target.value)}
                        placeholder="e.g. 2024"
                        inputMode="numeric"
                        className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-rose-400 focus:outline-none"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs font-medium text-rose-600 sm:col-span-2">
                      <span className="text-xs font-semibold text-rose-600">Notes</span>
                      <textarea
                        value={newCollectionNotes}
                        onChange={(event) => setNewCollectionNotes(event.target.value)}
                        placeholder="Describe the story, runway inspiration, collaborators…"
                        className="min-h-[90px] rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-rose-400 focus:outline-none"
                      />
                    </label>
                  </div>
                )}
                <span className="text-[10px] font-normal uppercase tracking-wide text-rose-400">
                  Link to an existing collection or propose a new one for our curators to review.
                </span>
              </div>
              <div className="sm:col-span-2 flex flex-col gap-2 text-xs font-medium text-rose-600">
                <span className="text-xs font-semibold text-rose-600">Reference links</span>
                <div className="flex flex-col gap-3">
                  {referenceLinks.map((entry, index) => (
                    <div
                      key={entry.id}
                      className="flex flex-col gap-2 rounded-2xl border border-rose-100 bg-white/70 p-3 shadow-sm sm:flex-row sm:items-center"
                    >
                      <div className="flex flex-1 flex-col gap-1">
                        <input
                          type="url"
                          value={entry.value}
                          onChange={(event) => handleReferenceChange(entry.id, event.target.value)}
                          placeholder="https://"
                          className="w-full rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-rose-400 focus:outline-none"
                        />
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-rose-400">
                          Reference {index + 1}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleReferenceRemove(entry.id)}
                        disabled={referenceLinks.length === 1}
                        className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-500 transition hover:border-rose-300 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={handleReferenceAdd}
                    className="inline-flex items-center justify-center rounded-full border border-dashed border-rose-300 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-rose-500 transition hover:border-rose-400"
                  >
                    Add reference link
                  </button>
                  <p className="text-[10px] font-normal uppercase tracking-wide text-rose-400">
                    Include multiple sources—runway listings, magazines, or trusted shop pages.
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-4 text-xs font-semibold text-rose-600">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={limitedEdition}
                  onChange={(event) => setLimitedEdition(event.target.checked)}
                  className="h-4 w-4 rounded border-rose-200 text-rose-500 focus:ring-rose-400"
                />
                Limited edition
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={hasMatchingSetFlag}
                  onChange={(event) => setHasMatchingSetFlag(event.target.checked)}
                  className="h-4 w-4 rounded border-rose-200 text-rose-500 focus:ring-rose-400"
                />
                Has matching set
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={verifiedSource}
                  onChange={(event) => setVerifiedSource(event.target.checked)}
                  className="h-4 w-4 rounded border-rose-200 text-rose-500 focus:ring-rose-400"
                />
                Verified source
              </label>
            </div>
          </div>
          <div className="rounded-2xl border border-rose-100 bg-rose-50/40 p-4">
            <p className="text-sm font-semibold text-rose-700">Category & style</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs font-medium text-rose-600">
                <span className="text-xs font-semibold text-rose-600">
                  Category
                  <RequiredStar />
                </span>
                <select
                  value={selectedCategory ?? ""}
                  onChange={(event) => handleCategoryChange(event.target.value)}
                  className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-rose-400 focus:outline-none"
                >
                  <option value="">Select category</option>
                  {categoryOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <span
                  className={`text-[10px] font-semibold uppercase tracking-wide ${categoryError ? "text-rose-500" : "text-rose-400"}`}
                >
                  {categoryError ?? "Required for every submission."}
                </span>
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-rose-600">
                <span className="text-xs font-semibold text-rose-600">Subcategory</span>
                <select
                  value={selectedSubcategory ?? ""}
                  onChange={(event) => handleSubcategoryChange(event.target.value)}
                  disabled={!selectedCategory || filteredSubcategories.length === 0}
                  className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-rose-400 focus:outline-none disabled:cursor-not-allowed disabled:border-dashed disabled:bg-rose-50 disabled:text-rose-300"
                >
                  <option value="">
                    {!selectedCategory
                      ? "Select category first"
                      : filteredSubcategories.length === 0
                        ? "No subcategories"
                        : "Select subcategory"}
                  </option>
                  {filteredSubcategories.map((subcategory) => (
                    <option key={subcategory.slug} value={subcategory.slug}>
                      {subcategory.name}
                    </option>
                  ))}
                </select>
                <span className="text-[10px] font-normal uppercase tracking-wide text-rose-400">
                  {selectedCategory
                    ? filteredSubcategories.length === 0
                      ? "No linked subcategories available."
                      : "Limited to the chosen category."
                    : "Pick a category before choosing a subcategory."}
                </span>
              </label>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2 text-xs font-medium text-rose-600">
                <span className="text-xs font-semibold text-rose-600">Styles</span>
                <FilterDropdown
                  id="styles-select"
                  placeholder={optionsLoading ? "Loading styles…" : "Search styles"}
                  options={styleOptions}
                  selectedValues={selectedStyles}
                  onToggle={handleStyleToggle}
                  onRemove={handleStyleRemove}
                  emptyMessage={optionsLoading ? "Loading…" : "No matches"}
                />
                <span className="text-[10px] font-normal uppercase tracking-wide text-rose-400">
                  Select all applicable parent styles.
                </span>
              </div>
              <div className="flex flex-col gap-2 text-xs font-medium text-rose-600">
                <span className="text-xs font-semibold text-rose-600">Substyles</span>
                <FilterDropdown
                  id="substyles-select"
                  placeholder={selectedStyles.length === 0 ? "Choose a style first" : "Search substyles"}
                  options={substyleOptions}
                  selectedValues={selectedSubstyles}
                  onToggle={handleSubstyleToggle}
                  onRemove={handleSubstyleRemove}
                  emptyMessage={selectedStyles.length === 0 ? "Select a style first" : "No matches"}
                />
                <span className="text-[10px] font-normal uppercase tracking-wide text-rose-400">
                  Limited to the selected parent styles when available.
                </span>
              </div>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2 text-xs font-medium text-rose-600">
                <span className="text-xs font-semibold text-rose-600">Colors</span>
                <FilterDropdown
                  id="colors-select"
                  placeholder={optionsLoading ? "Loading colors…" : "Search colors"}
                  options={colorOptions}
                  selectedValues={selectedColors}
                  onToggle={handleColorToggle}
                  onRemove={handleColorRemove}
                  emptyMessage={optionsLoading ? "Loading…" : "No matches"}
                />
              </div>
              <div className="flex flex-col gap-2 text-xs font-medium text-rose-600">
                <span className="text-xs font-semibold text-rose-600">Features</span>
                <FilterDropdown
                  id="features-select"
                  placeholder={optionsLoading ? "Loading features…" : "Search features"}
                  options={featureOptions}
                  selectedValues={selectedFeatures}
                  onToggle={handleFeatureToggle}
                  onRemove={handleFeatureRemove}
                  emptyMessage={optionsLoading ? "Loading…" : "No matches"}
                />
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-rose-100 bg-rose-50/40 p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-rose-700">Fabric breakdown</p>
                <p className="text-xs font-normal text-rose-400">
                  List the materials used. Percentages are optional but help curators confirm composition.
                </p>
              </div>
              <button
                type="button"
                onClick={handleFabricAdd}
                className="inline-flex items-center justify-center rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600 transition hover:border-rose-300 hover:text-rose-700"
              >
                + Add fabric
              </button>
            </div>
            <div className="mt-4 flex flex-col gap-4">
              {fabricEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="grid items-end gap-3 sm:grid-cols-[minmax(0,0.5fr)_minmax(0,0.3fr)_auto]"
                >
                  <label className="flex flex-col gap-1 text-xs font-medium text-rose-600">
                    <span className="text-xs font-semibold text-rose-600">Fabric</span>
                    <select
                      value={entry.fabric}
                      onChange={(event) => handleFabricFieldChange(entry.id, "fabric", event.target.value)}
                      className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-rose-400 focus:outline-none"
                    >
                      <option value="">Select fabric</option>
                      {fabricOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium text-rose-600">
                    <span className="text-xs font-semibold text-rose-600">Percentage</span>
                    <input
                      value={entry.percentage}
                      onChange={(event) => handleFabricFieldChange(entry.id, "percentage", event.target.value)}
                      placeholder="e.g. 60%"
                      className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-rose-400 focus:outline-none"
                    />
                  </label>
                  <div className="flex items-end pb-1">
                    <button
                      type="button"
                      onClick={() => handleFabricRemove(entry.id)}
                      className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-500 transition hover:border-rose-300 hover:text-rose-700"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-rose-100 bg-rose-50/40 p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-rose-700">Size measurements</p>
                <p className="text-xs font-normal text-rose-400">
                  Select the size category, add size labels, customize their measurements, and include fit notes.
                </p>
              </div>
              <div className="flex justify-start lg:justify-end">
                <button
                  type="button"
                  onClick={handleSizeEntryAdd}
                  disabled={isOneSizeCategory}
                  className="inline-flex items-center justify-center rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600 transition hover:border-rose-300 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  + Add size label
                </button>
              </div>
            </div>
            <label className="mt-4 flex flex-col gap-1 text-xs font-medium text-rose-600">
              <span className="text-xs font-semibold text-rose-600">Size category</span>
              <select
                value={activeSizeCategory}
                onChange={(event) => handleSizeCategoryChange(event.target.value)}
                className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-rose-400 focus:outline-none"
              >
                {SIZE_CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-rose-400">
                One category governs all size labels for this entry.
              </span>
            </label>
            {isOneSizeCategory ? (
              <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-rose-400">
                One size items support a single size label with shared measurements.
              </p>
            ) : null}
            <div className="mt-4 flex flex-col gap-4">
              {sizeEntries.map((entry, index) => {
                const canAddMeasurements = entry.activeFields.length < MEASUREMENT_FIELDS.length;
                const canRemoveMeasurements = entry.activeFields.length > 1;
                const canRemoveEntry = !isOneSizeCategory && sizeEntries.length > 1;
                const displayUnit = entry.unitSystem === "metric" ? "cm" : "in";
                return (
                  <div key={entry.id} className="space-y-5 rounded-2xl border border-rose-100 bg-white/90 p-5 shadow-sm">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
                        <label className="flex w-full flex-1 flex-col gap-1 text-xs font-medium text-rose-600 sm:flex-[1.2]">
                          <span className="text-xs font-semibold text-rose-600">
                            Size label
                            <RequiredStar />
                          </span>
                          <input
                            value={entry.sizeLabel}
                            onChange={(event) => handleSizeLabelChange(entry.id, event.target.value)}
                            placeholder="e.g. S / 36"
                            readOnly={entry.sizeCategory === "one_size"}
                            className={`rounded-xl border border-rose-200 px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-rose-400 focus:outline-none ${
                              entry.sizeCategory === "one_size" ? "bg-rose-50 text-rose-500" : "bg-white"
                            }`}
                          />
                          <div className="min-h-[14px] text-[10px]">
                            {sizeLabelErrors[entry.id] ? (
                              <span className="font-semibold text-rose-500">{sizeLabelErrors[entry.id]}</span>
                            ) : entry.sizeCategory === "one_size" ? (
                              <span className="font-semibold uppercase tracking-wide text-rose-400">
                                Label locked for one size submissions
                              </span>
                            ) : (
                              <span className="text-rose-400">Match the brand&apos;s published size.</span>
                            )}
                          </div>
                        </label>
                        <div className="flex w-full flex-1 flex-col gap-1 text-xs font-medium text-rose-600 sm:flex-[0.8]">
                          <span className="text-xs font-semibold text-rose-600">Unit system</span>
                          <div className="flex flex-wrap items-center gap-2">
                            {UNIT_BADGES.map((badge) => (
                              <button
                                key={badge.value}
                                type="button"
                                onClick={() => handleSizeUnitChange(entry.id, badge.value)}
                                className={`rounded-full border px-3 py-1 text-xs font-semibold shadow-sm transition ${
                                  entry.unitSystem === badge.value
                                    ? "border-rose-500 bg-rose-500/10 text-rose-600"
                                    : "border-rose-200 text-rose-500 hover:border-rose-300"
                                }`}
                              >
                                {badge.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                      {canRemoveEntry ? (
                        <button
                          type="button"
                          onClick={() => handleSizeEntryRemove(entry.id)}
                          className="inline-flex items-center justify-center rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-500 transition hover:border-rose-300 hover:text-rose-700"
                        >
                          Remove size label
                        </button>
                      ) : null}
                    </div>
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-rose-500">Measurements</p>
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-rose-300">Entry {index + 1}</p>
                        </div>
                        {canAddMeasurements ? (
                          <button
                            type="button"
                            onClick={() => handleSizeMeasurementFieldAdd(entry.id)}
                            className="inline-flex items-center justify-center rounded-full border border-rose-200 px-3 py-1 text-[11px] font-semibold text-rose-600 transition hover:border-rose-300 hover:text-rose-700"
                          >
                            + Add measurement
                          </button>
                        ) : (
                          <p className="text-[11px] text-rose-400">All available measurement fields are already included.</p>
                        )}
                      </div>
                      {entry.activeFields.length === 0 ? (
                        <p className="rounded-xl border border-dashed border-rose-200 bg-rose-50/40 px-4 py-3 text-xs text-rose-500">
                          No measurements available for this entry.
                        </p>
                      ) : (
                        <div className="grid gap-3">
                          {entry.activeFields.map((fieldKey) => (
                            <div key={fieldKey} className="rounded-2xl border border-rose-100 bg-white p-4 shadow-sm">
                              <div className="flex flex-wrap items-end gap-3">
                                <label className="flex min-w-[180px] flex-1 flex-col gap-1 text-[11px] font-medium text-rose-600">
                                  <span className="text-[11px] font-semibold uppercase tracking-wide text-rose-400">
                                    Measurement
                                  </span>
                                  <select
                                    value={fieldKey}
                                    onChange={(event) =>
                                      handleSizeMeasurementFieldSelectChange(
                                        entry.id,
                                        fieldKey,
                                        event.target.value as MeasurementFieldKey
                                      )
                                    }
                                    className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-rose-400 focus:outline-none"
                                  >
                                    {MEASUREMENT_FIELDS.map((field) => (
                                      <option
                                        key={field.key}
                                        value={field.key}
                                        disabled={field.key !== fieldKey && entry.activeFields.includes(field.key)}
                                      >
                                        {field.label}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <label className="flex min-w-[160px] flex-1 flex-col gap-1 text-xs font-medium text-rose-600">
                                  <span className="flex items-center justify-between text-xs font-semibold text-rose-600">
                                    Value
                                    <span className="text-[10px] font-semibold uppercase tracking-wide text-rose-400">
                                      {displayUnit}
                                    </span>
                                  </span>
                                  <input
                                    type="number"
                                    inputMode="decimal"
                                    step="any"
                                    value={entry.measurements[fieldKey] ?? ""}
                                    onChange={(event) => handleSizeMeasurementChange(entry.id, fieldKey, event.target.value)}
                                    placeholder="e.g. 34"
                                    className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-rose-400 focus:outline-none"
                                  />
                                </label>
                                <div className="flex items-end">
                                  <button
                                    type="button"
                                    onClick={() => handleSizeMeasurementFieldRemove(entry.id, fieldKey)}
                                    disabled={!canRemoveMeasurements}
                                    className={`rounded-full border px-2 py-1 text-[11px] font-semibold transition ${
                                      canRemoveMeasurements
                                        ? "border-rose-200 text-rose-500 hover:border-rose-300 hover:text-rose-700"
                                        : "cursor-not-allowed border-rose-100 text-rose-300"
                                    }`}
                                    title={
                                      canRemoveMeasurements
                                        ? "Remove measurement"
                                        : "At least one measurement is required"
                                    }
                                  >
                                    Remove
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <label className="flex flex-col gap-1 text-xs font-medium text-rose-600">
                      <span className="text-xs font-semibold text-rose-600">Fit notes (optional)</span>
                      <textarea
                        value={entry.notes}
                        onChange={(event) => handleSizeNotesChange(entry.id, event.target.value)}
                        placeholder="Describe fit nuances, stretch, or tailoring details."
                        rows={3}
                        className="rounded-2xl border border-rose-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-rose-400 focus:outline-none"
                      />
                    </label>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="rounded-2xl border border-rose-100 bg-rose-50/40 p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-rose-700">Price information</p>
                <p className="text-xs font-normal text-rose-400">
                  Include prices in the original currency if available. Add multiple entries for variant listings.
                </p>
              </div>
              <button
                type="button"
                onClick={handlePriceAdd}
                className="inline-flex items-center justify-center rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600 transition hover:border-rose-300 hover:text-rose-700"
              >
                + Add price
              </button>
            </div>
            <div className="mt-4 flex flex-col gap-4">
              {priceEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="grid items-end gap-3 sm:grid-cols-[minmax(0,0.4fr)_minmax(0,0.4fr)_auto]"
                >
                  <label className="flex flex-col gap-1 text-xs font-medium text-rose-600">
                    <span className="text-xs font-semibold text-rose-600">Currency</span>
                    <select
                      value={entry.currency}
                      onChange={(event) => handlePriceFieldChange(entry.id, "currency", event.target.value)}
                      className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-rose-400 focus:outline-none"
                    >
                      <option value="">Select currency</option>
                      {activeCurrencyOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium text-rose-600">
                    <span className="text-xs font-semibold text-rose-600">Amount</span>
                    <input
                      value={entry.amount}
                      onChange={(event) => handlePriceFieldChange(entry.id, "amount", event.target.value)}
                      placeholder="e.g. 149.00"
                      className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-rose-400 focus:outline-none"
                    />
                  </label>
                  <div className="flex items-end pb-1">
                    <button
                      type="button"
                      onClick={() => handlePriceRemove(entry.id)}
                      className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-500 transition hover:border-rose-300 hover:text-rose-700"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-rose-200 bg-white/70 p-4 text-sm text-rose-600 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex w-full flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handlePreviewOpen}
                className="inline-flex w-full items-center justify-center rounded-full border border-rose-300 px-4 py-2 text-xs font-semibold text-rose-600 transition hover:border-rose-400 hover:text-rose-700 sm:flex-1"
              >
                Preview entry
              </button>
              <button
                type="button"
                onClick={handleSaveDraft}
                className="inline-flex w-full items-center justify-center rounded-full border border-rose-300 px-4 py-2 text-xs font-semibold text-rose-600 transition hover:border-rose-400 hover:text-rose-700 sm:flex-1"
              >
                Save draft
              </button>
              {hasDraft ? (
                <>
                  <button
                    type="button"
                    onClick={handleRestoreDraft}
                    className="inline-flex items-center justify-center rounded-full border border-rose-300 px-4 py-1 text-xs font-semibold text-rose-600 transition hover:border-rose-400 hover:text-rose-700"
                  >
                    Load draft
                  </button>
                  <button
                    type="button"
                    onClick={handleClearDraft}
                    className="inline-flex items-center justify-center rounded-full border border-rose-300 px-4 py-1 text-xs font-semibold text-rose-600 transition hover:border-rose-400 hover:text-rose-700"
                  >
                    Clear draft
                  </button>
                </>
              ) : null}
            </div>
            {draftStatus ? <p className="text-xs text-rose-400">{draftStatus}</p> : null}
          </div>
          {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}
          {successMessage ? <p className="text-sm text-emerald-600">{successMessage}</p> : null}
          <button
            type="submit"
            disabled={pending}
            className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "Submitting…" : "Submit entry"}
          </button>
        </form>
      </section>
      {isPreviewOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-rose-950/40 px-4 py-8 sm:px-6">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-entry-preview-title"
            className="relative w-full max-w-4xl rounded-[32px] border border-rose-100 bg-white shadow-2xl"
          >
            <button
              type="button"
              onClick={handlePreviewClose}
              className="absolute right-4 top-4 rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600 transition hover:border-rose-300 hover:text-rose-800"
            >
              Close preview
            </button>
            {previewSnapshot ? (
              <div className="space-y-6 p-6 pb-8">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-rose-400">Live preview</p>
                  <h2 id="add-entry-preview-title" className="text-2xl font-semibold text-rose-900">
                    {previewSnapshot.title}
                  </h2>
                  <p className="text-sm text-rose-500">{previewSnapshot.brandLabel}</p>
                  {previewStatusBadges.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {previewStatusBadges.map((badge) => (
                        <span
                          key={badge}
                          className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600"
                        >
                          {badge}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                {previewHeroImage ? (
                  <div className="space-y-3">
                    <div className="overflow-hidden rounded-3xl border border-rose-100 bg-rose-50">
                      <img
                        src={previewHeroImage.url}
                        alt={previewSnapshot.title ? `${previewSnapshot.title} reference image` : "Reference image"}
                        className="h-80 w-full object-cover"
                      />
                    </div>
                    {previewSecondaryImages.length > 0 ? (
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {previewSecondaryImages.map((image, index) => (
                          <div key={image.id ?? `${image.url}-${index}`} className="overflow-hidden rounded-2xl border border-rose-100">
                            <img
                              src={image.url}
                              alt={previewSnapshot.title ? `${previewSnapshot.title} image ${index + 2}` : "Preview thumbnail"}
                              className="h-28 w-full object-cover"
                            />
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="rounded-3xl border border-dashed border-rose-200 bg-rose-50/50 p-6 text-center text-sm text-rose-400">
                    No reference images attached yet.
                  </div>
                )}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-3xl border border-rose-100 bg-rose-50/40 p-4">
                    <p className="text-sm font-semibold text-rose-700">Names</p>
                    <div className="mt-3 space-y-2">
                      {previewSnapshot.names.length > 0 ? (
                        previewSnapshot.names.map((entry) => (
                          <div key={entry.id} className="rounded-2xl bg-white/70 px-3 py-2">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-400">
                              {entry.language?.toUpperCase() ?? "—"}
                            </p>
                            <p className="text-sm text-rose-900">{entry.value || "—"}</p>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-rose-400">No names captured yet.</p>
                      )}
                    </div>
                  </div>
                  <div className="rounded-3xl border border-rose-100 bg-rose-50/40 p-4">
                    <p className="text-sm font-semibold text-rose-700">Descriptions</p>
                    <div className="mt-3 space-y-2">
                      {previewSnapshot.descriptions.length > 0 ? (
                        previewSnapshot.descriptions.map((entry) => (
                          <div key={entry.id} className="rounded-2xl bg-white/70 px-3 py-2">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-400">
                              {entry.language?.toUpperCase() ?? "—"}
                            </p>
                            <p className="text-sm text-rose-900">{entry.value || "—"}</p>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-rose-400">No descriptions provided yet.</p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-3xl border border-rose-100 bg-white/90 p-4">
                    <p className="text-sm font-semibold text-rose-700">Quick facts</p>
                    <dl className="mt-3 grid gap-2 text-sm text-rose-600">
                      {previewQuickFacts.map((fact) => (
                        <div key={fact.label} className="flex items-start justify-between gap-3">
                          <dt className="text-xs font-semibold uppercase tracking-wide text-rose-400">{fact.label}</dt>
                          <dd className="text-right text-sm text-rose-900">{fact.value || "—"}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                  <div className="rounded-3xl border border-rose-100 bg-white/90 p-4">
                    <p className="text-sm font-semibold text-rose-700">Reference links</p>
                    {previewSnapshot.referenceLinks.length > 0 ? (
                      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-rose-700">
                        {previewSnapshot.referenceLinks.map((link, index) => {
                          const normalizedHref = link.startsWith("http") ? link : `https://${link}`;
                          return (
                            <li key={`${link}-${index}`}>
                              <a
                                href={normalizedHref}
                                target="_blank"
                                rel="noreferrer"
                                className="text-rose-600 underline-offset-4 hover:text-rose-800 hover:underline"
                              >
                                {link}
                              </a>
                            </li>
                          );
                        })}
                      </ol>
                    ) : (
                      <p className="mt-3 text-sm text-rose-400">No external references provided.</p>
                    )}
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-3xl border border-rose-100 bg-white/90 p-4">
                    <p className="text-sm font-semibold text-rose-700">Attributes</p>
                    {previewHasAttributes ? (
                      <div className="mt-3 space-y-3">
                        {previewAttributeGroups.map((group) =>
                          group.items.length === 0 ? null : (
                            <div key={group.label} className="space-y-1">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-400">{group.label}</p>
                              <div className="flex flex-wrap gap-2">
                                {group.items.map((item) => (
                                  <span
                                    key={`${group.label}-${item}`}
                                    className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700"
                                  >
                                    {item}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-rose-400">No tags, styles, colors, or features selected.</p>
                    )}
                  </div>
                  <div className="rounded-3xl border border-rose-100 bg-white/90 p-4">
                    <p className="text-sm font-semibold text-rose-700">Fabric breakdown</p>
                    {previewSnapshot.fabrics.length > 0 ? (
                      <ul className="mt-3 space-y-2 text-sm text-rose-700">
                        {previewSnapshot.fabrics.map((fabric, index) => (
                          <li key={`${fabric.name}-${index}`} className="flex items-center justify-between gap-3">
                            <span>{fabric.name}</span>
                            <span className="text-rose-500">{fabric.percentage || "—"}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-3 text-sm text-rose-400">No fabrics listed.</p>
                    )}
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="rounded-3xl border border-rose-100 bg-white/90 p-4">
                    <p className="text-sm font-semibold text-rose-700">Price entries</p>
                    {previewSnapshot.priceEntries.length > 0 ? (
                      <ul className="mt-3 space-y-2 text-sm text-rose-700">
                        {previewSnapshot.priceEntries.map((entry) => (
                          <li key={entry.id} className="flex items-center justify-between gap-3 rounded-2xl bg-rose-50/60 px-3 py-2">
                            <span className="font-semibold">{entry.currency || "Currency"}</span>
                            <span className="text-rose-500">{entry.amount || "—"}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-3 text-sm text-rose-400">No prices recorded.</p>
                    )}
                  </div>
                  <div className="rounded-3xl border border-rose-100 bg-white/90 p-4">
                    <p className="text-sm font-semibold text-rose-700">Size measurements</p>
                    {previewSnapshot.sizeEntries.length > 0 ? (
                      <div className="mt-3 space-y-4">
                        {previewSnapshot.sizeEntries.map((entry) => (
                          <div key={entry.id} className="rounded-2xl border border-rose-100 bg-rose-50/60 p-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <p className="text-base font-semibold text-rose-900">{entry.sizeLabel || "Unnamed size"}</p>
                                <p className="text-xs text-rose-400">
                                  {SIZE_CATEGORY_LABEL_MAP[entry.sizeCategory] ?? entry.sizeCategory}
                                </p>
                              </div>
                              <span className="text-xs font-semibold uppercase tracking-wide text-rose-500">
                                {UNIT_LABEL_MAP[entry.unitSystem] ?? entry.unitSystem}
                              </span>
                            </div>
                            {entry.activeFields.length > 0 ? (
                              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                {entry.activeFields.map((fieldKey) => (
                                  <div key={fieldKey} className="rounded-xl bg-white/80 px-3 py-2">
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-400">
                                      {MEASUREMENT_LABEL_MAP[fieldKey] ?? fieldKey}
                                    </p>
                                    <p className="text-sm text-rose-900">
                                      {entry.measurements[fieldKey]?.trim() || "—"}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="mt-3 text-sm text-rose-400">No measurement fields added.</p>
                            )}
                            {entry.notes.trim() ? (
                              <p className="mt-3 rounded-2xl bg-white/70 px-3 py-2 text-sm text-rose-700">
                                {entry.notes}
                              </p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-rose-400">No measurement details captured.</p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 text-center text-sm text-rose-500">Unable to build preview.</div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
