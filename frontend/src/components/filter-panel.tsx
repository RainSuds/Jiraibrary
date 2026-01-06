'use client';
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition, type ReactNode } from "react";

import type { ItemListResponse, MeasurementOption } from "@/lib/api";
import FilterDropdown, { type FilterDropdownOption } from "./filter-dropdown";
import FilterHierarchicalDropdown, {
  type HierarchicalParentOption,
} from "./filter-hierarchical-dropdown";
import {
  MEASUREMENT_FIELD_CONFIG,
  MEASUREMENT_PARAM_MAP,
  type MeasurementField,
  type MeasurementSelectionKey,
  type MeasurementParamName,
} from "@/app/search/filter-constants";

const SECTION_BASE_CLASSES =
  "flex w-full min-w-0 flex-col gap-2 rounded-2xl border border-rose-100 bg-white/80 shadow-sm";

function createRangeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `range-${Math.random().toString(36).slice(2, 10)}`;
}

type SelectedFilters = ItemListResponse["selected"];

type CollapsibleSectionProps = {
  id: string;
  title: string;
  description?: string;
  defaultOpen?: boolean;
  collapsible?: boolean;
  children: ReactNode;
  actions?: ReactNode;
};

function CollapsibleSection({
  id,
  title,
  description,
  defaultOpen = false,
  collapsible = true,
  children,
  actions,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(collapsible ? defaultOpen : true);

  return (
    <fieldset className={`${SECTION_BASE_CLASSES} p-6`}>
      <legend className="sr-only">{title}</legend>
      {collapsible ? (
        <div className="flex w-full flex-col gap-3">
          <div className="flex w-full flex-wrap items-start justify-between gap-3 text-left">
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-sm font-semibold uppercase tracking-wide text-rose-500">
                {title}
              </span>
              {description ? (
                <span className="text-xs text-rose-400">{description}</span>
              ) : null}
            </span>
            <button
              type="button"
              onClick={() => setOpen((prev) => !prev)}
              aria-expanded={open}
              aria-controls={`${id}-content`}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-rose-200 text-sm text-rose-500 transition hover:border-rose-300 hover:text-rose-700"
            >
              {open ? "−" : "+"}
            </button>
          </div>
          {actions ? (
            <div className="border-t border-rose-100 pt-2" aria-hidden={!open}>
              {actions}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="flex w-full flex-wrap items-start justify-between gap-3 text-left">
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-sm font-semibold uppercase tracking-wide text-rose-500">
              {title}
            </span>
            {description ? (
              <span className="text-xs text-rose-400">{description}</span>
            ) : null}
          </span>
          {actions ? (
            <div className="flex flex-shrink-0 items-center gap-2 self-stretch">
              {actions}
            </div>
          ) : null}
        </div>
      )}
      <div
        id={`${id}-content`}
        className={`mt-3 flex flex-col gap-3 ${collapsible && !open ? "hidden" : ""}`}
        aria-hidden={collapsible ? !open : false}
      >
        {children}
      </div>
    </fieldset>
  );
}

type ReleaseYearRangeState = {
  id: string;
  min: string;
  max: string;
};

type PriceRangeState = {
  id: string;
  currency: string;
  min: number | null;
  max: number | null;
};

type PriceBounds = {
  min: number | null;
  max: number | null;
};

type ReleaseYearBounds = {
  min: number | null;
  max: number | null;
};

const YEAR_FALLBACK_MIN = 1900;

function parseYearInput(value: string): number | null {
  if (value.trim() === "") {
    return null;
  }
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return null;
  }
  return parsed;
}

function clampYear(value: number, bounds: ReleaseYearBounds): number {
  const minBound = bounds.min ?? YEAR_FALLBACK_MIN;
  const maxBound = bounds.max ?? new Date().getFullYear();
  return Math.min(Math.max(value, minBound), maxBound);
}

function serializeReleaseYearRange(
  range: ReleaseYearRangeState,
  bounds: ReleaseYearBounds
): string | null {
  if (range.min.trim() === "" && range.max.trim() === "") {
    return null;
  }

  const minInput = parseYearInput(range.min);
  const maxInput = parseYearInput(range.max);

  let resolvedMin = minInput !== null ? clampYear(minInput, bounds) : null;
  let resolvedMax = maxInput !== null ? clampYear(maxInput, bounds) : null;

  if (resolvedMin !== null && resolvedMax !== null && resolvedMax < resolvedMin) {
    resolvedMax = resolvedMin;
  }

  if (resolvedMax === null && bounds.max !== null) {
    resolvedMax = clampYear(bounds.max, bounds);
  }

  if (resolvedMin === null && bounds.min !== null) {
    resolvedMin = clampYear(bounds.min, bounds);
  }

  if (resolvedMin === null && resolvedMax === null) {
    return null;
  }

  if (resolvedMax !== null) {
    const minPart = resolvedMin !== null ? `${resolvedMin}` : "";
    return `${minPart}:${resolvedMax}`;
  }

  return resolvedMin !== null ? `${resolvedMin}` : null;
}

function clampPrice(value: number, metadata: PriceBounds): number {
  const minBound = metadata.min ?? 0;
  const maxBound = metadata.max ?? Math.max(minBound + 100, minBound + 1);
  return Math.min(Math.max(value, minBound), maxBound);
}

function serializePriceRange(
  range: PriceRangeState,
  metadata: PriceBounds,
  fallbackCurrency: string
): { currency: string; serialized: string } | null {
  if (range.min === null && range.max === null) {
    return null;
  }

  const currency = range.currency || fallbackCurrency;

  const resolvedMin = range.min !== null ? clampPrice(range.min, metadata) : null;
  let resolvedMax = range.max !== null ? clampPrice(range.max, metadata) : null;

  if (resolvedMin !== null && resolvedMax !== null && resolvedMax < resolvedMin) {
    resolvedMax = resolvedMin;
  }

  const minPart = resolvedMin !== null ? `${resolvedMin}` : "";
  const maxPart = resolvedMax !== null ? `${resolvedMax}` : "";

  if (minPart === "" && maxPart === "") {
    return null;
  }

  return { currency, serialized: `${currency}:${minPart}:${maxPart}` };
}

type FilterPanelProps = {
  filters: ItemListResponse["filters"];
  selected: SelectedFilters;
  query: string | undefined;
};

export default function FilterPanel({ filters, selected, query }: FilterPanelProps) {
  const releaseYearBounds = filters.release_year;
  const priceMetadata = filters.prices;
  const preferredCurrency =
    selected.price_currency ?? priceMetadata.currency ?? "USD";

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const updateQuery = useCallback(
    (mutator: (params: URLSearchParams) => void) => {
      const previousQuery = searchParams.toString();
      const params = new URLSearchParams(previousQuery);
      mutator(params);
      const nextQuery = params.toString();
      if (nextQuery === previousQuery) {
        return;
      }
      startTransition(() => {
        const target = nextQuery ? `${pathname}?${nextQuery}` : pathname;
        router.replace(target, { scroll: false });
      });
    },
    [pathname, router, searchParams, startTransition]
  );

  const [releaseYearRanges, setReleaseYearRanges] = useState<ReleaseYearRangeState[]>(
    () => {
      if (selected.release_year_ranges.length > 0) {
        return selected.release_year_ranges.map((range) => ({
          id: range.value_key || createRangeId(),
          min: typeof range.min === "number" ? `${range.min}` : "",
          max: typeof range.max === "number" ? `${range.max}` : "",
        }));
      }
      return [
        {
          id: createRangeId(),
          min: "",
          max: "",
        },
      ];
    }
  );

  const [priceRanges, setPriceRanges] = useState<PriceRangeState[]>(() => {
    if (selected.price_ranges.length > 0) {
      return selected.price_ranges.map((range) => ({
        id: range.value_key || createRangeId(),
        currency: range.currency ?? preferredCurrency,
        min: typeof range.min === "number" ? range.min : null,
        max: typeof range.max === "number" ? range.max : null,
      }));
    }
    return [
      {
        id: createRangeId(),
        currency: preferredCurrency,
        min: null,
        max: null,
      },
    ];
  });

  type MeasurementFormValues = Record<MeasurementParamName, string>;

  const searchParamsString = searchParams.toString();

  const computeMeasurementValues = useCallback((): MeasurementFormValues => {
    const snapshot = new URLSearchParams(searchParamsString);
    const next = {} as MeasurementFormValues;
    for (const { key, param } of MEASUREMENT_PARAM_MAP) {
      const queryValue = snapshot.get(param as MeasurementParamName);
      if (queryValue !== null) {
        next[param as MeasurementParamName] = queryValue;
        continue;
      }
      const fallback = selected.measurement[key as MeasurementSelectionKey];
      next[param as MeasurementParamName] =
        fallback === null || fallback === undefined ? "" : `${fallback}`;
    }
    return next;
  }, [searchParamsString, selected.measurement]);

  const [measurementValues, setMeasurementValues] = useState<MeasurementFormValues>(
    () => computeMeasurementValues()
  );

  const releaseYearDefaultOpen = useMemo(
    () => selected.release_year_ranges.length > 0,
    [selected.release_year_ranges.length]
  );
  const priceDefaultOpen = useMemo(
    () => selected.price_ranges.length > 0,
    [selected.price_ranges.length]
  );

  const brandOptions = useMemo<FilterDropdownOption[]>(
    () =>
      filters.brands.map((brand) => ({
        value: brand.slug,
        label: brand.name,
        description: brand.country,
        badge:
          typeof brand.item_count === "number" ? brand.item_count : null,
      })),
    [filters.brands]
  );

  const categoryTreeOptions = useMemo<HierarchicalParentOption[]>(
    () =>
      filters.categories.map((category) => ({
        value: category.id,
        label: category.name,
        badge:
          typeof category.item_count === "number" ? category.item_count : null,
        children: category.subcategories.map((subcategory) => ({
          value: subcategory.id,
          label: subcategory.name,
          description: subcategory.type ?? null,
          badge:
            typeof subcategory.item_count === "number"
              ? subcategory.item_count
              : null,
        })),
      })),
    [filters.categories]
  );

  const styleTreeOptions = useMemo<HierarchicalParentOption[]>(
    () =>
      filters.styles.map((style) => ({
        value: style.slug,
        label: style.name,
        badge:
          typeof style.item_count === "number" ? style.item_count : null,
        children: style.substyles.map((substyle) => ({
          value: substyle.slug,
          label: substyle.name,
          description: null,
          badge:
            typeof substyle.item_count === "number" ? substyle.item_count : null,
        })),
      })),
    [filters.styles]
  );

  const tagOptions = useMemo<FilterDropdownOption[]>(
    () =>
      filters.tags.map((tag) => ({
        value: tag.id,
        label: tag.name,
        description: tag.type,
        group: tag.type ?? null,
        badge:
          typeof tag.item_count === "number" ? tag.item_count : null,
      })),
    [filters.tags]
  );

  const colorOptions = useMemo<FilterDropdownOption[]>(
    () =>
      filters.colors.map((color) => ({
        value: color.id,
        label: color.name,
        description: color.hex,
        swatch: color.hex ?? null,
        badge:
          typeof color.item_count === "number" ? color.item_count : null,
      })),
    [filters.colors]
  );

  const collectionOptions = useMemo<FilterDropdownOption[]>(
    () =>
      filters.collections.map((collection) => ({
        value: collection.id,
        label: collection.name,
        description:
          [collection.year, collection.brand_slug]
            .filter((part) => part !== null && part !== "")
            .join(" • ") || null,
      })),
    [filters.collections]
  );

  const fabricOptions = useMemo<FilterDropdownOption[]>(
    () =>
      filters.fabrics.map((fabric) => ({
        value: fabric.id,
        label: fabric.name,
        description: fabric.type,
        badge:
          typeof fabric.item_count === "number" ? fabric.item_count : null,
      })),
    [filters.fabrics]
  );

  const featureOptions = useMemo<FilterDropdownOption[]>(
    () =>
      filters.features.map((feature) => ({
        value: feature.id,
        label: feature.name,
        group: feature.category ?? null,
        badge:
          typeof feature.item_count === "number" ? feature.item_count : null,
      })),
    [filters.features]
  );

  const serializedReleaseYearRanges = useMemo(
    () =>
      releaseYearRanges
        .map((range) => {
          const value = serializeReleaseYearRange(range, releaseYearBounds);
          return value ? { id: range.id, value } : null;
        })
        .filter((entry): entry is { id: string; value: string } => entry !== null),
    [releaseYearBounds, releaseYearRanges]
  );
  const serializedPriceRanges = useMemo(
    () =>
      priceRanges
        .map((range) => {
          const entry = serializePriceRange(range, priceMetadata, preferredCurrency);
          return entry ? { id: range.id, ...entry } : null;
        })
        .filter(
          (entry): entry is { id: string; currency: string; serialized: string } =>
            entry !== null
        ),
    [priceMetadata, preferredCurrency, priceRanges]
  );

  useEffect(() => {
    startTransition(() => {
      setReleaseYearRanges(() => {
        if (selected.release_year_ranges.length > 0) {
          return selected.release_year_ranges.map((range) => ({
            id: range.value_key || createRangeId(),
            min: typeof range.min === "number" ? `${range.min}` : "",
            max: typeof range.max === "number" ? `${range.max}` : "",
          }));
        }
        return [
          {
            id: createRangeId(),
            min: "",
            max: "",
          },
        ];
      });
    });
  }, [selected.release_year_ranges, releaseYearBounds.min, releaseYearBounds.max, startTransition]);

  useEffect(() => {
    startTransition(() => {
      setPriceRanges(() => {
        if (selected.price_ranges.length > 0) {
          return selected.price_ranges.map((range) => ({
            id: range.value_key || createRangeId(),
            currency: range.currency ?? preferredCurrency,
            min: typeof range.min === "number" ? range.min : null,
            max: typeof range.max === "number" ? range.max : null,
          }));
        }
        return [
          {
            id: createRangeId(),
            currency: preferredCurrency,
            min: null,
            max: null,
          },
        ];
      });
    });
  }, [selected.price_ranges, preferredCurrency, startTransition]);

  useEffect(() => {
    startTransition(() => {
      setMeasurementValues((previous) => {
        const next = computeMeasurementValues();
        for (const key of Object.keys(next) as MeasurementParamName[]) {
          if (previous[key] !== next[key]) {
            return next;
          }
        }
        return previous;
      });
    });
  }, [computeMeasurementValues, startTransition]);

  const toggleMultiValue = (
    param: string,
    value: string,
    currentValues: readonly string[]
  ) => {
    updateQuery((params) => {
      const next = new Set(currentValues);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      params.delete(param);
      for (const entry of next) {
        params.append(param, entry);
      }
    });
  };

  const handleMeasurementChange = (
    param: MeasurementParamName,
    value: string
  ) => {
    setMeasurementValues((prev) => ({ ...prev, [param]: value }));
    updateQuery((params) => {
      params.delete(param);
      if (value.trim() !== "") {
        params.set(param, value);
      }
    });
  };

  const commitReleaseYearQuery = useCallback(
    (ranges: ReleaseYearRangeState[]) => {
      const serialized = ranges
        .map((range) => serializeReleaseYearRange(range, releaseYearBounds))
        .filter((value): value is string => value !== null);

      updateQuery((params) => {
        params.delete("release_year_range");
        for (const value of serialized) {
          params.append("release_year_range", value);
        }
      });
    },
    [releaseYearBounds, updateQuery]
  );

  const commitPriceRangesQuery = useCallback(
    (ranges: PriceRangeState[]) => {
      const serialized = ranges
        .map((range) => serializePriceRange(range, priceMetadata, preferredCurrency))
        .filter((entry): entry is { currency: string; serialized: string } => entry !== null);

      updateQuery((params) => {
        params.delete("price_range");
        for (const entry of serialized) {
          params.append("price_range", entry.serialized);
        }
        if (serialized.length > 0) {
          params.set("price_currency", serialized[0].currency);
        } else {
          params.delete("price_currency");
        }
      });
    },
    [preferredCurrency, priceMetadata, updateQuery]
  );

  useEffect(() => {
    commitReleaseYearQuery(releaseYearRanges);
  }, [commitReleaseYearQuery, releaseYearRanges]);

  useEffect(() => {
    commitPriceRangesQuery(priceRanges);
  }, [commitPriceRangesQuery, priceRanges]);

  const getParamValues = (param: string, fallback: readonly string[]) => {
    const values = searchParams.getAll(param);
    if (values.length > 0) {
      return Array.from(new Set(values));
    }
    return Array.from(new Set(fallback));
  };

  const brandValues = getParamValues("brand", selected.brand);
  const categoryValues = getParamValues("category", selected.category);
  const subcategoryValues = getParamValues("subcategory", selected.subcategory);
  const styleValues = getParamValues("style", selected.style);
  const substyleValues = getParamValues("substyle", selected.substyle);
  const tagValues = getParamValues("tag", selected.tag);
  const colorValues = getParamValues("color", selected.color);
  const collectionValues = getParamValues("collection", selected.collection);
  const fabricValues = getParamValues("fabric", selected.fabric);
  const featureValues = getParamValues("feature", selected.feature);

  const updateReleaseYearRange = (
    id: string,
    updater: (range: ReleaseYearRangeState) => ReleaseYearRangeState
  ) => {
    setReleaseYearRanges((ranges) =>
      ranges.map((range) => (range.id === id ? updater(range) : range))
    );
  };

  const addReleaseYearRange = () => {
    setReleaseYearRanges((ranges) => {
      const next = [
        ...ranges,
        {
          id: createRangeId(),
          min: "",
          max: "",
        },
      ];
      return next;
    });
  };

  const removeReleaseYearRange = (id: string) => {
    setReleaseYearRanges((ranges) => {
      const next = ranges.filter((range) => range.id !== id);
      return next.length > 0 ? next : [
        {
          id: createRangeId(),
          min: "",
          max: "",
        },
      ];
    });
  };

  const updatePriceRange = (id: string, partial: Partial<PriceRangeState>) => {
    setPriceRanges((ranges) => {
      const next = ranges.map((range) =>
        range.id === id ? { ...range, ...partial } : range
      );
      return next;
    });
  };

  const addPriceRange = () => {
    setPriceRanges((ranges) => {
      const next = [
        ...ranges,
        {
          id: createRangeId(),
          currency: preferredCurrency,
          min: null,
          max: null,
        },
      ];
      return next;
    });
  };

  const removePriceRange = (id: string) => {
    setPriceRanges((ranges) => {
      const next = ranges.filter((range) => range.id !== id);
      const normalized = next.length > 0 ? next : [
        {
          id: createRangeId(),
          currency: preferredCurrency,
          min: null,
          max: null,
        },
      ];
      return normalized;
    });
  };

  const renderRangeRow = (
    range: ReleaseYearRangeState,
    index: number,
    bounds: ReleaseYearBounds,
    onChange: (
      id: string,
      updater: (current: ReleaseYearRangeState) => ReleaseYearRangeState
    ) => void,
    onRemove: (id: string) => void
  ) => {
    const minBound = bounds.min ?? YEAR_FALLBACK_MIN;
    const maxBound = bounds.max ?? new Date().getFullYear();

    const sliderMinValue = (() => {
      const parsed = parseYearInput(range.min);
      if (parsed === null) {
        return minBound;
      }
      return clampYear(parsed, bounds);
    })();

    const sliderMaxValue = (() => {
      const parsed = parseYearInput(range.max);
      if (parsed === null) {
        return maxBound;
      }
      return clampYear(parsed, bounds);
    })();

    const handleMinInputChange = (raw: string) => {
      if (!/^\d*$/.test(raw)) {
        return;
      }
      onChange(range.id, (current) => {
        const nextMin = raw;
        const nextMinNumeric = parseYearInput(nextMin);
        const currentMaxNumeric = parseYearInput(current.max);
        let nextMax = current.max;
        if (
          nextMinNumeric !== null &&
          currentMaxNumeric !== null &&
          currentMaxNumeric < nextMinNumeric
        ) {
          nextMax = `${nextMinNumeric}`;
        }
        return { ...current, min: nextMin, max: nextMax };
      });
    };

    const handleMaxInputChange = (raw: string) => {
      if (!/^\d*$/.test(raw)) {
        return;
      }
      onChange(range.id, (current) => {
        const nextMax = raw;
        const nextMaxNumeric = parseYearInput(nextMax);
        const currentMinNumeric = parseYearInput(current.min);
        let nextMin = current.min;
        if (
          nextMaxNumeric !== null &&
          currentMinNumeric !== null &&
          nextMaxNumeric < currentMinNumeric
        ) {
          nextMin = `${nextMaxNumeric}`;
        }
        return { ...current, max: nextMax, min: nextMin };
      });
    };

    const handleMinSliderChange = (value: number) => {
      const clamped = clampYear(value, bounds);
      onChange(range.id, (current) => {
        const stringValue = `${clamped}`;
        const currentMaxNumeric = parseYearInput(current.max);
        let nextMax = current.max;
        if (currentMaxNumeric !== null && currentMaxNumeric < clamped) {
          nextMax = stringValue;
        }
        return { ...current, min: stringValue, max: nextMax };
      });
    };

    const handleMaxSliderChange = (value: number) => {
      const clamped = clampYear(value, bounds);
      onChange(range.id, (current) => {
        const stringValue = `${clamped}`;
        const currentMinNumeric = parseYearInput(current.min);
        let nextMin = current.min;
        if (currentMinNumeric !== null && clamped < currentMinNumeric) {
          nextMin = stringValue;
        }
        return { ...current, max: stringValue, min: nextMin };
      });
    };

    return (
      <div
        key={range.id}
        className="flex max-w-full flex-col gap-3 overflow-hidden rounded-xl border border-rose-100 bg-white/70 p-3"
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-rose-700">Range {index + 1}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onRemove(range.id)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-rose-200 text-sm text-rose-500 transition hover:border-rose-300 hover:text-rose-700 disabled:opacity-40"
              title="Remove range"
            >
              ×
            </button>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs text-rose-400">
            <span>Min year</span>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={range.min}
              onChange={(event) => handleMinInputChange(event.target.value)}
              placeholder={bounds.min !== null ? `${bounds.min}` : undefined}
              className="w-full rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm text-rose-700 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-rose-400">
            <span>Max year</span>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={range.max}
              onChange={(event) => handleMaxInputChange(event.target.value)}
              placeholder={bounds.max !== null ? `${bounds.max}` : undefined}
              className="w-full rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm text-rose-700 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
            />
          </label>
        </div>
        <div className="flex flex-col gap-1 text-xs text-rose-400">
          <span>Adjust quickly</span>
          <div className="flex min-w-0 items-center gap-3">
            <input
              type="range"
              min={minBound}
              max={maxBound}
              value={sliderMinValue}
              onChange={(event) => handleMinSliderChange(Number(event.target.value))}
              className="h-1 w-full flex-1 min-w-0 appearance-none rounded-full bg-rose-100 accent-rose-500"
            />
            <input
              type="range"
              min={minBound}
              max={maxBound}
              value={sliderMaxValue}
              onChange={(event) => handleMaxSliderChange(Number(event.target.value))}
              className="h-1 w-full flex-1 min-w-0 appearance-none rounded-full bg-rose-100 accent-rose-500"
            />
          </div>
        </div>
      </div>
    );
  };

  const renderPriceRangeRow = (
    range: PriceRangeState,
    index: number,
    metadata: { min: number | null; max: number | null; currency: string },
    onChange: (id: string, partial: Partial<PriceRangeState>) => void,
    onRemove: (id: string) => void
  ) => {
    const minBound = metadata.min ?? 0;
    const maxBound = metadata.max ?? Math.max(minBound + 100, minBound + 1);
    const clampValue = (value: number) => Math.min(Math.max(value, minBound), maxBound);

    return (
      <div
        key={range.id}
        className="flex max-w-full flex-col gap-3 overflow-hidden rounded-xl border border-rose-100 bg-white/70 p-3"
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-rose-700">
            Range {index + 1} ({range.currency})
          </span>
          <button
            type="button"
            onClick={() => onRemove(range.id)}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-rose-200 text-sm text-rose-500 transition hover:border-rose-300 hover:text-rose-700 disabled:opacity-40"
            title="Remove range"
          >
            ×
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs text-rose-400">
            <span>Min price</span>
            <input
              type="number"
              step="any"
              value={range.min ?? ""}
              onChange={(event) => {
                const raw = event.target.value.trim();
                if (raw === "") {
                  onChange(range.id, { min: null });
                  return;
                }
                const parsed = Number(raw);
                if (Number.isNaN(parsed)) {
                  return;
                }
                const updatedMax =
                  typeof range.max === "number" && range.max < parsed ? parsed : range.max;
                onChange(range.id, { min: parsed, max: updatedMax });
              }}
              min={minBound}
              max={maxBound}
              placeholder={metadata.min !== null ? `${metadata.min}` : undefined}
              className="w-full rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm text-rose-700 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-rose-400">
            <span>Max price</span>
            <input
              type="number"
              step="any"
              value={range.max ?? ""}
              onChange={(event) => {
                const raw = event.target.value.trim();
                if (raw === "") {
                  onChange(range.id, { max: null });
                  return;
                }
                const parsed = Number(raw);
                if (Number.isNaN(parsed)) {
                  return;
                }
                const updatedMin =
                  typeof range.min === "number" && range.min > parsed ? parsed : range.min;
                onChange(range.id, { max: parsed, min: updatedMin });
              }}
              min={minBound}
              max={maxBound}
              placeholder={metadata.max !== null ? `${metadata.max}` : undefined}
              className="w-full rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm text-rose-700 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
            />
          </label>
        </div>
        <div className="flex flex-col gap-1 text-xs text-rose-400">
          <span>Adjust quickly</span>
          <div className="flex min-w-0 items-center gap-3">
            <input
              type="range"
              min={minBound}
              max={maxBound}
              value={typeof range.min === "number" ? clampValue(range.min) : minBound}
              onChange={(event) => {
                const value = clampValue(Number(event.target.value));
                const updatedMax =
                  typeof range.max === "number" && range.max < value ? value : range.max;
                onChange(range.id, { min: value, max: updatedMax });
              }}
              className="h-1 w-full flex-1 min-w-0 appearance-none rounded-full bg-rose-100 accent-rose-500"
            />
            <input
              type="range"
              min={minBound}
              max={maxBound}
              value={typeof range.max === "number" ? clampValue(range.max) : maxBound}
              onChange={(event) => {
                const value = clampValue(Number(event.target.value));
                const updatedMin =
                  typeof range.min === "number" && range.min > value ? value : range.min;
                onChange(range.id, { max: value, min: updatedMin });
              }}
              className="h-1 w-full flex-1 min-w-0 appearance-none rounded-full bg-rose-100 accent-rose-500"
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <form
      action="/search"
      method="get"
      className="flex w-full min-w-0 flex-col gap-6 rounded-2xl border border-rose-100 bg-white/70 p-6 sm:p-8 shadow-sm backdrop-blur"
      aria-label="Filters"
    >
      <input type="hidden" name="q" value={query ?? ""} />
      {serializedPriceRanges.length > 0 ? (
        <input
          type="hidden"
          name="price_currency"
          value={serializedPriceRanges[0].currency}
        />
      ) : null}

      {serializedReleaseYearRanges.map((range) => (
        <input
          key={`release-hidden-${range.id}`}
          type="hidden"
          name="release_year_range"
          value={range.value}
        />
      ))}

      {serializedPriceRanges.map((range) => (
        <input
          key={`price-hidden-${range.id}`}
          type="hidden"
          name="price_range"
          value={range.serialized}
        />
      ))}

      <CollapsibleSection
        id="brand"
        title="Brand"
        description="Choose one or more houses to focus the results."
        defaultOpen={selected.brand.length > 0}
        collapsible={false}
      >
        <FilterDropdown
          id="brand-filter"
          placeholder="Search brands"
          options={brandOptions}
          selectedValues={brandValues}
          onToggle={(value) => toggleMultiValue("brand", value, brandValues)}
          onRemove={(value) => toggleMultiValue("brand", value, brandValues)}
          emptyMessage="No brands match"
        />
      </CollapsibleSection>

      <CollapsibleSection
        id="category"
        title="Category"
        description="Layer silhouettes with any matching subcategories."
        defaultOpen={selected.category.length > 0 || selected.subcategory.length > 0}
        collapsible={false}
      >
        <FilterHierarchicalDropdown
          id="category-filter"
          placeholder="Search categories or subcategories"
          parents={categoryTreeOptions}
          selectedParents={categoryValues}
          selectedChildren={subcategoryValues}
          onToggleParent={(value) => toggleMultiValue("category", value, categoryValues)}
          onToggleChild={(value) => toggleMultiValue("subcategory", value, subcategoryValues)}
          onRemoveParent={(value) => toggleMultiValue("category", value, categoryValues)}
          onRemoveChild={(value) => toggleMultiValue("subcategory", value, subcategoryValues)}
          emptyMessage="No categories match"
          parentLabel="Categories"
          childLabel="Subcategories"
        />
      </CollapsibleSection>

      <CollapsibleSection
        id="style"
        title="Style"
        description="Mix house-specific styles and substyles."
        defaultOpen={selected.style.length > 0 || selected.substyle.length > 0}
        collapsible={false}
      >
        <FilterHierarchicalDropdown
          id="style-filter"
          placeholder="Search styles or substyles"
          parents={styleTreeOptions}
          selectedParents={styleValues}
          selectedChildren={substyleValues}
          onToggleParent={(value) => toggleMultiValue("style", value, styleValues)}
          onToggleChild={(value) => toggleMultiValue("substyle", value, substyleValues)}
          onRemoveParent={(value) => toggleMultiValue("style", value, styleValues)}
          onRemoveChild={(value) => toggleMultiValue("substyle", value, substyleValues)}
          emptyMessage="No styles match"
          parentLabel="Styles"
          childLabel="Substyles"
        />
      </CollapsibleSection>

      <CollapsibleSection
        id="tags"
        title="Tags"
        description="Surface motifs, fabrics, or notable details."
        defaultOpen={selected.tag.length > 0}
        collapsible={false}
      >
        <FilterDropdown
          id="tag-filter"
          placeholder="Search tags"
          options={tagOptions}
          selectedValues={tagValues}
          onToggle={(value) => toggleMultiValue("tag", value, tagValues)}
          onRemove={(value) => toggleMultiValue("tag", value, tagValues)}
          emptyMessage="No tags match"
        />
      </CollapsibleSection>

      <CollapsibleSection
        id="colors"
        title="Colors"
        description="Display only looks that include selected hues."
        defaultOpen={selected.color.length > 0}
        collapsible={false}
      >
        <FilterDropdown
          id="color-filter"
          placeholder="Search colors"
          options={colorOptions}
          selectedValues={colorValues}
          onToggle={(value) => toggleMultiValue("color", value, colorValues)}
          onRemove={(value) => toggleMultiValue("color", value, colorValues)}
          emptyMessage="No colors match"
        />
      </CollapsibleSection>

      <CollapsibleSection
        id="collections"
        title="Collections"
        description="Spot specific runway seasons or capsule releases."
        defaultOpen={selected.collection.length > 0}
        collapsible={false}
      >
        <FilterDropdown
          id="collection-filter"
          placeholder="Search collections"
          options={collectionOptions}
          selectedValues={collectionValues}
          onToggle={(value) => toggleMultiValue("collection", value, collectionValues)}
          onRemove={(value) => toggleMultiValue("collection", value, collectionValues)}
          emptyMessage="No collections match"
        />
      </CollapsibleSection>

      <CollapsibleSection
        id="fabrics"
        title="Fabrics"
        description="Highlight compositions or textile blends."
        defaultOpen={selected.fabric.length > 0}
        collapsible={false}
      >
        <FilterDropdown
          id="fabric-filter"
          placeholder="Search fabrics"
          options={fabricOptions}
          selectedValues={fabricValues}
          onToggle={(value) => toggleMultiValue("fabric", value, fabricValues)}
          onRemove={(value) => toggleMultiValue("fabric", value, fabricValues)}
          emptyMessage="No fabrics match"
        />
      </CollapsibleSection>

      <CollapsibleSection
        id="features"
        title="Features"
        description="Stack design features like pleats, embroidery, or tailoring details."
        defaultOpen={selected.feature.length > 0}
        collapsible={false}
      >
        <FilterDropdown
          id="feature-filter"
          placeholder="Search features"
          options={featureOptions}
          selectedValues={featureValues}
          onToggle={(value) => toggleMultiValue("feature", value, featureValues)}
          onRemove={(value) => toggleMultiValue("feature", value, featureValues)}
          emptyMessage="No features match"
        />
      </CollapsibleSection>

      <CollapsibleSection
        id="measurements"
        title="Measurements"
        description="Set optional garment measurements in centimeters."
        defaultOpen={Object.values(selected.measurement).some((value) => value !== null)}
      >
        <div className="grid gap-4">
          {filters.measurements.map((measurement: MeasurementOption) => {
            const config = MEASUREMENT_FIELD_CONFIG[measurement.field as MeasurementField];
            if (!config) {
              return null;
            }
            return (
              <div key={measurement.field} className="grid gap-2 rounded-xl border border-rose-100 bg-white/60 p-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-medium text-rose-700">{measurement.label}</span>
                  <span className="text-xs text-rose-400">{measurement.unit}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1 text-xs text-rose-400">
                    <span>Min</span>
                    <input
                      type="number"
                      step="any"
                      name={config.minParam}
                      value={measurementValues[config.minParam] ?? ""}
                      onChange={(event) => handleMeasurementChange(config.minParam, event.target.value)}
                      min={measurement.min ?? undefined}
                      max={measurement.max ?? undefined}
                      placeholder={measurement.min !== null ? `${measurement.min}` : undefined}
                      className="w-full rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm text-rose-700 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-rose-400">
                    <span>Max</span>
                    <input
                      type="number"
                      step="any"
                      name={config.maxParam}
                      value={measurementValues[config.maxParam] ?? ""}
                      onChange={(event) => handleMeasurementChange(config.maxParam, event.target.value)}
                      min={measurement.min ?? undefined}
                      max={measurement.max ?? undefined}
                      placeholder={measurement.max !== null ? `${measurement.max}` : undefined}
                      className="w-full rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm text-rose-700 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        id="release-years"
        title="Release Year"
        description="Add one or more year spans to narrow the timeline."
        defaultOpen={releaseYearDefaultOpen}
        actions={
          <button
            type="button"
            onClick={addReleaseYearRange}
            className="inline-flex items-center gap-2 rounded-full border border-rose-200 px-3 py-1 text-xs font-medium text-rose-500 transition hover:border-rose-300 hover:text-rose-700"
          >
            <span aria-hidden="true">＋</span>
            Add range
          </button>
        }
      >
        {releaseYearRanges.length === 0 ? (
          <p className="text-xs text-rose-400">No ranges selected. Add one to get started.</p>
        ) : null}
        {releaseYearRanges.map((range, index) =>
          renderRangeRow(range, index, releaseYearBounds, updateReleaseYearRange, removeReleaseYearRange)
        )}
      </CollapsibleSection>

      <CollapsibleSection
        id="prices"
        title="Price"
        description={`Target price bands in ${preferredCurrency}.`}
        defaultOpen={priceDefaultOpen}
        actions={
          <button
            type="button"
            onClick={addPriceRange}
            className="inline-flex items-center gap-2 rounded-full border border-rose-200 px-3 py-1 text-xs font-medium text-rose-500 transition hover:border-rose-300 hover:text-rose-700"
          >
            <span aria-hidden="true">＋</span>
            Add range
          </button>
        }
      >
        {priceRanges.length === 0 ? (
          <p className="text-xs text-rose-400">No ranges selected. Add one to focus pricing.</p>
        ) : null}
        {priceRanges.map((range, index) =>
          renderPriceRangeRow(range, index, priceMetadata, updatePriceRange, removePriceRange)
        )}
      </CollapsibleSection>
    </form>
  );
}
