"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import ImageUploadManager from "@/components/image-upload-manager";
import FilterDropdown, { type FilterDropdownOption } from "@/components/filter-dropdown";
import {
  CreateSubmissionPayload,
  ItemSubmissionPayload,
  createSubmission,
  listBrandSummaries,
  listCategories,
  listSubcategories,
  listStyles,
  listSubstyles,
  listSubmissions,
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

const initialForm: CreateSubmissionPayload = {
  title: "",
  brand_name: "",
  description: "",
  reference_url: "",
  image_url: "",
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

export default function AddEntryPage() {
  const { user, token, loading, refresh } = useAuth();
  const [form, setForm] = useState<CreateSubmissionPayload>(initialForm);
  const [pending, setPending] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<ItemSubmissionPayload[]>([]);
  const [uploadedImages, setUploadedImages] = useState<UploadedImageSummary[]>([]);
  const [uploaderKey, setUploaderKey] = useState(0);
  const [brandOptions, setBrandOptions] = useState<FilterDropdownOption[]>([]);
  const [tagOptions, setTagOptions] = useState<FilterDropdownOption[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
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
  const [itemSlug, setItemSlug] = useState("");
  const [releaseYear, setReleaseYear] = useState<string>("");
  const [originCountry, setOriginCountry] = useState("");
  const [productionCountry, setProductionCountry] = useState("");
  const [limitedEdition, setLimitedEdition] = useState(false);
  const [hasMatchingSetFlag, setHasMatchingSetFlag] = useState(false);
  const [verifiedSource, setVerifiedSource] = useState(false);

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

  const brandOptionMap = useMemo(() => new Map(brandOptions.map((option) => [option.value, option])), [brandOptions]);
  const tagOptionMap = useMemo(() => new Map(tagOptions.map((option) => [option.value, option])), [tagOptions]);
  const categoryOptions = useMemo(() => {
    return categorySummaries.map((category) => ({
      value: category.slug,
      label: category.name,
    }));
  }, [categorySummaries]);
  const filteredSubcategories = useMemo(() => {
    if (!selectedCategory) {
      return subcategorySummaries;
    }
    return subcategorySummaries.filter((subcategory) => subcategory.category?.slug === selectedCategory);
  }, [selectedCategory, subcategorySummaries]);
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
      return substyleSummaries;
    }
    const selectedSet = new Set(selectedStyles);
    return substyleSummaries.filter((substyle) => {
      const parentSlug = substyle.style?.slug;
      return parentSlug ? selectedSet.has(parentSlug) : true;
    });
  }, [selectedStyles, substyleSummaries]);
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
  const colorOptions = useMemo<FilterDropdownOption[]>(
    () =>
      colorSummaries.map((color) => ({
        value: color.id,
        label: color.name,
        swatch: color.hex_code ?? undefined,
      })),
    [colorSummaries]
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
    if (!token) {
      setSubmissions([]);
      return;
    }
    let active = true;
    const load = async () => {
      try {
        const data = await listSubmissions(token);
        if (active) {
          setSubmissions(data);
        }
      } catch (error) {
        console.error("Failed to load submissions", error);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [token]);
  const handleChange = (field: keyof CreateSubmissionPayload) => (value: string) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const handleBrandToggle = useCallback(
    (value: string) => {
      setSelectedBrand((previous) => {
        const next = previous === value ? null : value;
        const option = next ? brandOptionMap.get(next) : null;
        setForm((current) => {
          const nextName = option?.label ?? "";
          return current.brand_name === nextName ? current : { ...current, brand_name: nextName };
        });
        return next;
      });
    },
    [brandOptionMap]
  );

  const handleBrandRemove = useCallback(() => {
    setSelectedBrand(null);
    setForm((current) => (current.brand_name === "" ? current : { ...current, brand_name: "" }));
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
    setNameEntries((previous) => previous.map((entry) => (entry.id === id ? { ...entry, value } : entry)));
    setNameError(null);
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
    setDescriptionEntries((previous) => previous.map((entry) => (entry.id === id ? { ...entry, value } : entry)));
    setDescriptionError(null);
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
      return exists ? previous.filter((slug) => slug !== value) : [...previous, value];
    });
  }, []);

  const handleSubstyleRemove = useCallback((value: string) => {
    setSelectedSubstyles((previous) => previous.filter((slug) => slug !== value));
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
        return previous.map((entry) => (entry.id === id ? { ...entry, fabric: "", percentage: "" } : entry));
      }
      return previous.filter((entry) => entry.id !== id);
    });
  }, []);

  const handleFabricAdd = useCallback(() => {
    setFabricEntries((previous) => [...previous, { id: generateEntryId(), fabric: "", percentage: "" }]);
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
    if (!form.brand_name.trim()) {
      setErrorMessage("Please select a brand before submitting.");
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

    const sanitizedItemSlug = itemSlug.trim().toLowerCase();

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

    setPending(true);
    try {
      const payload: CreateSubmissionPayload = {
        ...form,
        title: primaryName.value,
        name_translations: dedupedTranslations,
        description: primaryDescription?.value ?? form.description?.trim() ?? "",
        description_translations: dedupedDescriptions,
        reference_url: form.reference_url?.trim() || "",
        image_url: uploadedImages[0]?.url ?? form.image_url?.trim() ?? "",
        item_slug: sanitizedItemSlug || undefined,
        release_year: parsedReleaseYear,
        category_slug: selectedCategory ?? undefined,
        subcategory_slug: selectedSubcategory ?? undefined,
        style_slugs: selectedStyles.length > 0 ? selectedStyles : undefined,
        substyle_slugs: selectedSubstyles.length > 0 ? selectedSubstyles : undefined,
        color_slugs: selectedColors.length > 0 ? selectedColors : undefined,
        fabric_breakdown: normalizedFabrics.length > 0 ? normalizedFabrics : undefined,
        feature_slugs: selectedFeatures.length > 0 ? selectedFeatures : undefined,
        collection_reference: selectedCollection ?? undefined,
        price_amounts: normalizedPrices.length > 0 ? normalizedPrices : undefined,
        origin_country: sanitizedOriginCountry || undefined,
        production_country: sanitizedProductionCountry || undefined,
        limited_edition: limitedEdition,
        has_matching_set: hasMatchingSetFlag,
        verified_source: verifiedSource,
      };
      await createSubmission(token, payload);
      setForm(initialForm);
      setUploadedImages([]);
      setUploaderKey((value) => value + 1);
      setSelectedBrand(null);
      setSelectedTags([]);
      setNameEntries([{ id: generateEntryId(), language: defaultLanguageCode, value: "" }]);
      setDescriptionEntries([{ id: generateEntryId(), language: defaultLanguageCode, value: "" }]);
      setItemSlug("");
      setReleaseYear("");
      setSelectedCategory(null);
      setSelectedSubcategory(null);
      setSelectedStyles([]);
      setSelectedSubstyles([]);
      setSelectedColors([]);
      setFabricEntries([{ id: generateEntryId(), fabric: "", percentage: "" }]);
      setSelectedFeatures([]);
      setSelectedCollection(null);
      setPriceEntries([{ id: generateEntryId(), currency: "", amount: "" }]);
      setOriginCountry("");
      setProductionCountry("");
      setLimitedEdition(false);
      setHasMatchingSetFlag(false);
      setVerifiedSource(false);
      setSuccessMessage("Submission received! We'll review it shortly.");
      const updated = await listSubmissions(token);
      setSubmissions(updated);
      await refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to submit entry.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <section className="rounded-3xl border border-rose-100 bg-white/95 p-8 shadow-lg">
        <h1 className="text-3xl font-semibold text-rose-900">Add a catalog entry</h1>
        <p className="mt-2 text-sm text-rose-500">
          Provide as much detail as possible so curators can review and publish your entry.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2 text-sm font-medium text-rose-600">
            <span>Brand</span>
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
            onImagesChange={setUploadedImages}
            title="Upload reference images"
            description="Upload multiple images, then drag to reorder. The first image is used as the cover."
          />
        </div>
        <form className="mt-6 flex flex-col gap-5" onSubmit={handleSubmit}>
          <div className="rounded-2xl border border-rose-100 bg-rose-50/40 p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-rose-700">Item names</p>
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
                <p className="text-sm font-semibold text-rose-700">Descriptions</p>
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
                  value={itemSlug}
                  onChange={(event) => setItemSlug(event.target.value)}
                  placeholder="e.g. acdc-rag-punk-revival-02"
                  className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-rose-400 focus:outline-none"
                />
                <span className="text-[10px] font-normal uppercase tracking-wide text-rose-400">
                  Optional. Use lowercase letters, numbers, and hyphens.
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
                <input
                  value={originCountry}
                  onChange={(event) => setOriginCountry(event.target.value.toUpperCase())}
                  placeholder="ISO country code"
                  className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-rose-400 focus:outline-none"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-rose-600">
                <span className="text-xs font-semibold text-rose-600">Production country</span>
                <input
                  value={productionCountry}
                  onChange={(event) => setProductionCountry(event.target.value.toUpperCase())}
                  placeholder="ISO country code"
                  className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-rose-400 focus:outline-none"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-rose-600">
                <span className="text-xs font-semibold text-rose-600">Collection</span>
                <select
                  value={selectedCollection ?? ""}
                  onChange={(event) => handleCollectionChange(event.target.value)}
                  className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-rose-400 focus:outline-none"
                >
                  <option value="">None</option>
                  {collectionOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-rose-600">
                <span className="text-xs font-semibold text-rose-600">Reference URL</span>
                <input
                  type="url"
                  className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-rose-400 focus:outline-none"
                  value={form.reference_url}
                  onChange={(event) => handleChange("reference_url")(event.target.value)}
                  placeholder="https://"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-rose-600">
                <span className="text-xs font-semibold text-rose-600">Image URL</span>
                <input
                  type="url"
                  className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-rose-400 focus:outline-none"
                  value={uploadedImages.length > 0 ? uploadedImages[0].url : form.image_url}
                  onChange={
                    uploadedImages.length > 0
                      ? undefined
                      : (event) => handleChange("image_url")(event.target.value)
                  }
                  placeholder="https://"
                  readOnly={uploadedImages.length > 0}
                />
                {uploadedImages.length > 0 ? (
                  <span className="text-[10px] font-normal uppercase tracking-wide text-rose-400">
                    Auto-filled from the uploaded cover image.
                  </span>
                ) : null}
              </label>
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
                <span className="text-xs font-semibold text-rose-600">Category</span>
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
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-rose-600">
                <span className="text-xs font-semibold text-rose-600">Subcategory</span>
                <select
                  value={selectedSubcategory ?? ""}
                  onChange={(event) => handleSubcategoryChange(event.target.value)}
                  disabled={filteredSubcategories.length === 0}
                  className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-rose-400 focus:outline-none disabled:bg-rose-50"
                >
                  <option value="">{filteredSubcategories.length === 0 ? "No subcategories" : "Select subcategory"}</option>
                  {filteredSubcategories.map((subcategory) => (
                    <option key={subcategory.slug} value={subcategory.slug}>
                      {subcategory.name}
                    </option>
                  ))}
                </select>
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
      <aside className="flex flex-col gap-4">
        <div className="rounded-3xl border border-rose-100 bg-white/95 p-6 shadow-lg">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-rose-500">
            Submission history
          </h2>
          {submissions.length === 0 ? (
            <p className="mt-3 text-sm text-rose-500">No submissions yet. Start by completing the form.</p>
          ) : (
            <ul className="mt-4 flex flex-col gap-3">
              {submissions.map((submission) => (
                <li
                  key={submission.id}
                  className="rounded-2xl border border-rose-100 bg-white/90 p-4 shadow-sm"
                >
                  <p className="text-sm font-semibold text-rose-900">{submission.title}</p>
                  <p className="text-xs uppercase tracking-wide text-rose-400">
                    {submission.status.replace(/_/g, " ")}
                  </p>
                  {submission.moderator_notes ? (
                    <p className="mt-2 text-xs text-rose-500">{submission.moderator_notes}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-3xl border border-rose-100 bg-white/95 p-6 text-sm text-rose-500 shadow-lg">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-rose-500">
            Tips
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>Include official sources whenever possible.</li>
            <li>Add reference imagery links for colorways or release announcements.</li>
            <li>Use tags to suggest styles, motifs, or fabrics for reviewers.</li>
          </ul>
        </div>
      </aside>
    </div>
  );
}
