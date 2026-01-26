'use client';
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";

import type { ItemListResponse, MeasurementOption } from "@/lib/api";
import { useMeasurementUnit } from "@/components/measurement-unit-provider";
import { useCurrency } from "@/components/currency-provider";
import FilterDropdown, { type FilterDropdownOption } from "./filter-dropdown";
import FilterHierarchicalDropdown, {
  type HierarchicalParentOption,
} from "./filter-hierarchical-dropdown";
import RoseDropdown from "@/components/ui/rose-dropdown";
import RangeSlider from "@/components/ui/range-slider";
import {
  MEASUREMENT_PARAM_MAP,
} from "@/app/search/filter-constants";

const SECTION_BASE_CLASSES =
  "flex w-full min-w-0 flex-col gap-2 rounded-2xl border border-rose-100 bg-white/80 shadow-sm";

function createRangeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `range-${Math.random().toString(36).slice(2, 10)}`;
}

function convertMeasurementValue(value: number, fromUnit: string, toUnit: string): number {
  const normalizedFrom = fromUnit.toLowerCase();
  const normalizedTo = toUnit.toLowerCase();
  if (normalizedFrom === normalizedTo) {
    return value;
  }
  if (normalizedFrom === "cm" && (normalizedTo === "inch" || normalizedTo === "in")) {
    return value / 2.54;
  }
  if ((normalizedFrom === "inch" || normalizedFrom === "in") && normalizedTo === "cm") {
    return value * 2.54;
  }
  return value;
}

function formatMeasurementNumber(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(1);
}

function formatMeasurementValue(
  rawValue: string | number | null | undefined,
  fromUnit: string,
  toUnit: string,
): string {
  if (rawValue === null || rawValue === undefined) {
    return "";
  }
  const numeric = typeof rawValue === "number" ? rawValue : Number(String(rawValue));
  if (Number.isNaN(numeric)) {
    return String(rawValue);
  }
  const converted = convertMeasurementValue(numeric, fromUnit, toUnit);
  return formatMeasurementNumber(converted);
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
  actionsVisibility?: "always" | "expanded";
};

function CollapsibleSection({
  id,
  title,
  description,
  defaultOpen = false,
  collapsible = true,
  children,
  actions,
  actionsVisibility = "always",
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(collapsible ? defaultOpen : true);
  const showActions = !collapsible || actionsVisibility === "always" || open;

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
          {actions && showActions ? (
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
          {actions && showActions ? (
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

type MeasurementRangeState = {
  id: string;
  name: string;
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

  const resolvedMin = range.min !== null ? range.min : null;
  let resolvedMax = range.max !== null ? range.max : null;

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
  const { unit: measurementUnit } = useMeasurementUnit();
  const { currency: navCurrency } = useCurrency();
  const releaseYearBounds = filters.release_year;
  const priceMetadata = filters.prices;
  const preferredCurrency =
    navCurrency ?? selected.price_currency ?? priceMetadata.currency ?? "USD";

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const pendingReleaseYearCommitRef = useRef<ReleaseYearRangeState[] | null>(null);
  const pendingPriceCommitRef = useRef<PriceRangeState[] | null>(null);
  const pendingMeasurementCommitRef = useRef<MeasurementRangeState[] | null>(null);

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

  const [releaseYearRanges, setReleaseYearRanges] = useState<ReleaseYearRangeState[]>(() => {
    if (selected.release_year_ranges.length > 0) {
      return selected.release_year_ranges.map((range) => ({
        id: range.value_key || createRangeId(),
        min: typeof range.min === "number" ? `${range.min}` : "",
        max: typeof range.max === "number" ? `${range.max}` : "",
      }));
    }
    return [];
  });

  const [priceRanges, setPriceRanges] = useState<PriceRangeState[]>(() => {
    if (selected.price_ranges.length > 0) {
      return selected.price_ranges.map((range) => ({
        id: range.value_key || createRangeId(),
        currency: range.currency ?? preferredCurrency,
        min: typeof range.min === "number" ? range.min : null,
        max: typeof range.max === "number" ? range.max : null,
      }));
    }
    return [];
  });

  const searchParamsString = searchParams.toString();

  const measurementOptions = useMemo(
    () =>
      filters.measurements.map((measurement) => ({
        name: measurement.field.replace(/_cm$/, ""),
        label: measurement.label,
        unit: measurement.unit || "cm",
        min: measurement.min,
        max: measurement.max,
      })),
    [filters.measurements],
  );

  const measurementOptionsMap = useMemo(
    () => new Map(measurementOptions.map((option) => [option.name, option])),
    [measurementOptions],
  );

  const computeMeasurementRanges = useCallback((): MeasurementRangeState[] => {
    const snapshot = new URLSearchParams(searchParamsString);
    const ranges: MeasurementRangeState[] = [];

    snapshot.getAll("measurement_range").forEach((raw) => {
      const [namePart = "", minPart = "", maxPart = ""] = raw.split(":");
      const name = namePart.trim().toLowerCase();
      if (!name) {
        return;
      }
      const minValue = minPart ? formatMeasurementValue(minPart, "cm", measurementUnit) : "";
      const maxValue = maxPart ? formatMeasurementValue(maxPart, "cm", measurementUnit) : "";
      ranges.push({
        id: raw || createRangeId(),
        name,
        min: minValue,
        max: maxValue,
      });
    });

    if (ranges.length === 0) {
      const legacyRanges = selected.measurement_ranges ?? [];
      legacyRanges.forEach((range) => {
        if (!range.name) {
          return;
        }
        ranges.push({
          id: range.value_key || createRangeId(),
          name: range.name,
          min: range.min !== null ? formatMeasurementValue(range.min, "cm", measurementUnit) : "",
          max: range.max !== null ? formatMeasurementValue(range.max, "cm", measurementUnit) : "",
        });
      });
    }

    if (ranges.length === 0) {
      const legacyMeasurement = selected.measurement;
      const legacyMap = [
        { name: "bust", min: legacyMeasurement.bust_min, max: legacyMeasurement.bust_max },
        { name: "waist", min: legacyMeasurement.waist_min, max: legacyMeasurement.waist_max },
        { name: "hip", min: legacyMeasurement.hip_min, max: legacyMeasurement.hip_max },
        { name: "length", min: legacyMeasurement.length_min, max: legacyMeasurement.length_max },
      ];
      legacyMap.forEach((entry) => {
        if (entry.min !== null || entry.max !== null) {
          ranges.push({
            id: createRangeId(),
            name: entry.name,
            min: entry.min !== null ? formatMeasurementValue(entry.min, "cm", measurementUnit) : "",
            max: entry.max !== null ? formatMeasurementValue(entry.max, "cm", measurementUnit) : "",
          });
        }
      });
    }

    return ranges;
  }, [measurementOptions, measurementUnit, searchParamsString, selected.measurement, selected.measurement_ranges]);

  const [measurementRanges, setMeasurementRanges] = useState<MeasurementRangeState[]>(
    () => computeMeasurementRanges()
  );

  const measurementDescription = useMemo(
    () =>
      `Set optional garment measurements in ${
        measurementUnit === "inch" ? "inches" : "centimeters"
      }.`,
    [measurementUnit]
  );
  const measurementDefaultOpen = useMemo(
    () =>
      Object.values(selected.measurement).some((value) => value !== null) ||
      (selected.measurement_ranges ?? []).length > 0,
    [selected.measurement, selected.measurement_ranges]
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
        return [];
      });
    });
  }, [selected.release_year_ranges, releaseYearBounds.min, releaseYearBounds.max, startTransition]);

  useEffect(() => {
    startTransition(() => {
      setPriceRanges(() => {
        if (selected.price_ranges.length > 0) {
          return selected.price_ranges.map((range) => ({
            id: range.value_key || createRangeId(),
            currency: preferredCurrency,
            min: typeof range.min === "number" ? range.min : null,
            max: typeof range.max === "number" ? range.max : null,
          }));
        }
        return [];
      });
    });
  }, [selected.price_ranges, preferredCurrency, startTransition]);

  useEffect(() => {
    setPriceRanges((ranges) => {
      const next = ranges.map((range) => ({ ...range, currency: preferredCurrency }));
      for (let index = 0; index < ranges.length; index += 1) {
        if (ranges[index].currency !== next[index].currency) {
          return next;
        }
      }
      return ranges;
    });
  }, [preferredCurrency]);

  useEffect(() => {
    if (!navCurrency) {
      return;
    }
    if (searchParams.get("price_currency") === navCurrency) {
      return;
    }
    updateQuery((params) => {
      params.set("price_currency", navCurrency);
    });
  }, [navCurrency, searchParams, updateQuery]);

  useEffect(() => {
    startTransition(() => {
      setMeasurementRanges((previous) => {
        const next = computeMeasurementRanges();
        if (previous.length !== next.length) {
          return next;
        }
        for (let index = 0; index < previous.length; index += 1) {
          if (
            previous[index].name !== next[index].name ||
            previous[index].min !== next[index].min ||
            previous[index].max !== next[index].max
          ) {
            return next;
          }
        }
        return previous;
      });
    });
  }, [computeMeasurementRanges, startTransition]);

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
      if (param === "tag") {
        params.set("tag_match", tagMatch);
      }
      if (param === "color") {
        params.set("color_match", colorMatch);
      }
    });
  };

  const handleMeasurementRangeChange = (
    rangeId: string,
    key: "min" | "max",
    value: string
  ) => {
    setMeasurementRanges((prev) => {
      const nextRanges = prev.map((range) =>
        range.id === rangeId ? { ...range, [key]: value } : range
      );
      return nextRanges;
    });
  };

  const updateMeasurementRangeValues = (
    rangeId: string,
    min: string,
    max: string,
    commit = false
  ) => {
    setMeasurementRanges((prev) => {
      const nextRanges = prev.map((range) =>
        range.id === rangeId ? { ...range, min, max } : range
      );
      if (commit) {
        pendingMeasurementCommitRef.current = nextRanges;
      }
      return nextRanges;
    });
  };

  const handleMeasurementNameChange = (rangeId: string, name: string) => {
    setMeasurementRanges((prev) =>
      prev.map((range) => {
        if (range.id !== rangeId) {
          return range;
        }
        const option = measurementOptionsMap.get(name);
        if (!option) {
          return { ...range, name };
        }
        const baseUnit = option.unit || "cm";
        const minValue =
          typeof option.min === "number"
            ? `${Math.floor(convertMeasurementValue(option.min, baseUnit, measurementUnit))}`
            : "";
        const maxValue =
          typeof option.max === "number"
            ? `${Math.ceil(convertMeasurementValue(option.max, baseUnit, measurementUnit))}`
            : "";
        return {
          ...range,
          name,
          min: minValue,
          max: maxValue,
        };
      })
    );
  };

  const addMeasurementRange = () => {
    const fallbackName = measurementOptions[0]?.name ?? "";
    setMeasurementRanges((prev) => {
      const selectedOption = measurementOptionsMap.get(fallbackName);
      const baseUnit = selectedOption?.unit ?? "cm";
      const minValue =
        typeof selectedOption?.min === "number"
          ? `${Math.floor(convertMeasurementValue(selectedOption.min, baseUnit, measurementUnit))}`
          : "";
      const maxValue =
        typeof selectedOption?.max === "number"
          ? `${Math.ceil(convertMeasurementValue(selectedOption.max, baseUnit, measurementUnit))}`
          : "";
      return [
        ...prev,
        {
          id: createRangeId(),
          name: fallbackName,
          min: minValue,
          max: maxValue,
        },
      ];
    });
  };

  const removeMeasurementRange = (rangeId: string) => {
    setMeasurementRanges((prev) => prev.filter((range) => range.id !== rangeId));
  };

  const commitMeasurementRangesQuery = useCallback(
    (rangesList: MeasurementRangeState[]) => {
      updateQuery((params) => {
        for (const { param } of MEASUREMENT_PARAM_MAP) {
          params.delete(param);
        }
        params.delete("measurement_range");

        rangesList.forEach((range) => {
          const measurementName = range.name.trim().toLowerCase();
          if (!measurementName) {
            return;
          }
          const minValue = range.min.trim();
          const maxValue = range.max.trim();
          if (!minValue && !maxValue) {
            return;
          }
          const minNumeric = minValue ? Number(minValue) : NaN;
          const maxNumeric = maxValue ? Number(maxValue) : NaN;
          const minPart =
            minValue && !Number.isNaN(minNumeric)
              ? formatMeasurementNumber(convertMeasurementValue(minNumeric, measurementUnit, "cm"))
              : "";
          const maxPart =
            maxValue && !Number.isNaN(maxNumeric)
              ? formatMeasurementNumber(convertMeasurementValue(maxNumeric, measurementUnit, "cm"))
              : "";
          if (!minPart && !maxPart) {
            return;
          }
          params.append("measurement_range", `${measurementName}:${minPart}:${maxPart}`);
        });
      });
    },
    [measurementUnit, updateQuery],
  );

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

  const handleCommitOnEnter = useCallback((event: React.KeyboardEvent, commit: () => void) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
    }
  }, []);

  const getParamValues = (param: string, fallback: readonly string[]) => {
    const values = searchParams.getAll(param);
    if (values.length > 0) {
      return Array.from(new Set(values));
    }
    return Array.from(new Set(fallback));
  };

  const tagMatch = searchParams.get("tag_match") === "all" ? "all" : "any";
  const colorMatch = searchParams.get("color_match") === "any" ? "any" : "all";
  const fabricMatch = searchParams.get("fabric_match") === "all" ? "all" : "any";
  const featureMatch = searchParams.get("feature_match") === "all" ? "all" : "any";

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
    updater: (range: ReleaseYearRangeState) => ReleaseYearRangeState,
    commit = false
  ) => {
    setReleaseYearRanges((ranges) => {
      const next = ranges.map((range) => (range.id === id ? updater(range) : range));
      if (commit) {
        pendingReleaseYearCommitRef.current = next;
      }
      return next;
    });
  };

  const addReleaseYearRange = () => {
    setReleaseYearRanges((ranges) => {
      const minBound = releaseYearBounds.min ?? YEAR_FALLBACK_MIN;
      const maxBound = releaseYearBounds.max ?? new Date().getFullYear();
      const next = [
        ...ranges,
        {
          id: createRangeId(),
          min: `${minBound}`,
          max: `${maxBound}`,
        },
      ];
      return next;
    });
  };

  const removeReleaseYearRange = (id: string) => {
    setReleaseYearRanges((ranges) => {
      const next = ranges.filter((range) => range.id !== id);
      pendingReleaseYearCommitRef.current = next;
      return next;
    });
  };

  const updatePriceRange = (
    id: string,
    partial: Partial<PriceRangeState>,
    commit = false
  ) => {
    setPriceRanges((ranges) => {
      const next = ranges.map((range) =>
        range.id === id ? { ...range, ...partial } : range
      );
      if (commit) {
        pendingPriceCommitRef.current = next;
      }
      return next;
    });
  };

  const addPriceRange = () => {
    setPriceRanges((ranges) => {
      const rawMinBound = priceMetadata.min ?? 0;
      const rawMaxBound = priceMetadata.max ?? Math.max(rawMinBound + 100, rawMinBound + 1);
      const minBound = Math.floor(rawMinBound);
      const maxBound = Math.ceil(rawMaxBound);
      const next = [
        ...ranges,
        {
          id: createRangeId(),
          currency: preferredCurrency,
          min: minBound,
          max: maxBound,
        },
      ];
      return next;
    });
  };

  const removePriceRange = (id: string) => {
    setPriceRanges((ranges) => {
      const next = ranges.filter((range) => range.id !== id);
      pendingPriceCommitRef.current = next;
      return next;
    });
  };

  useEffect(() => {
    if (!pendingReleaseYearCommitRef.current) {
      return;
    }
    const next = pendingReleaseYearCommitRef.current;
    pendingReleaseYearCommitRef.current = null;
    commitReleaseYearQuery(next);
  }, [commitReleaseYearQuery, releaseYearRanges]);

  useEffect(() => {
    if (!pendingPriceCommitRef.current) {
      return;
    }
    const next = pendingPriceCommitRef.current;
    pendingPriceCommitRef.current = null;
    commitPriceRangesQuery(next);
  }, [commitPriceRangesQuery, priceRanges]);

  useEffect(() => {
    if (!pendingMeasurementCommitRef.current) {
      return;
    }
    const next = pendingMeasurementCommitRef.current;
    pendingMeasurementCommitRef.current = null;
    commitMeasurementRangesQuery(next);
  }, [commitMeasurementRangesQuery, measurementRanges]);

  const renderRangeRow = (
    range: ReleaseYearRangeState,
    index: number,
    bounds: ReleaseYearBounds,
    onChange: (
      id: string,
      updater: (current: ReleaseYearRangeState) => ReleaseYearRangeState,
      commit?: boolean
    ) => void,
    onRemove: (id: string) => void,
    onCommit: () => void
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
      const clamped = clampYear(Math.round(value), bounds);
      onChange(
        range.id,
        (current) => {
        const stringValue = `${clamped}`;
        const currentMaxNumeric = parseYearInput(current.max);
        let nextMax = current.max;
        if (currentMaxNumeric !== null && currentMaxNumeric < clamped) {
          nextMax = stringValue;
        }
        return { ...current, min: stringValue, max: nextMax };
        },
      );
    };

    const handleMaxSliderChange = (value: number) => {
      const clamped = clampYear(Math.round(value), bounds);
      onChange(
        range.id,
        (current) => {
        const stringValue = `${clamped}`;
        const currentMinNumeric = parseYearInput(current.min);
        let nextMin = current.min;
        if (currentMinNumeric !== null && clamped < currentMinNumeric) {
          nextMin = stringValue;
        }
        return { ...current, max: stringValue, min: nextMin };
        },
      );
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
              onKeyDown={(event) => handleCommitOnEnter(event, onCommit)}
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
              onKeyDown={(event) => handleCommitOnEnter(event, onCommit)}
              placeholder={bounds.max !== null ? `${bounds.max}` : undefined}
              className="w-full rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm text-rose-700 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
            />
          </label>
        </div>
        <div className="flex flex-col gap-1 text-xs text-rose-400">
          <span>Adjust quickly</span>
          <RangeSlider
            min={minBound}
            max={maxBound}
            step={1}
            valueMin={sliderMinValue}
            valueMax={sliderMaxValue}
            onChangeMin={handleMinSliderChange}
            onChangeMax={handleMaxSliderChange}
            onCommit={onCommit}
          />
        </div>
      </div>
    );
  };

  const renderPriceRangeRow = (
    range: PriceRangeState,
    index: number,
    metadata: { min: number | null; max: number | null; currency: string },
    onChange: (id: string, partial: Partial<PriceRangeState>) => void,
    onRemove: (id: string) => void,
    onCommit: () => void
  ) => {
    const rawMinBound = metadata.min ?? 0;
    const rawMaxBound = metadata.max ?? Math.max(rawMinBound + 100, rawMinBound + 1);
    const minBound = Math.floor(rawMinBound);
    const maxBound = Math.ceil(rawMaxBound);
    const clampValue = (value: number) => Math.min(Math.max(Math.round(value), minBound), maxBound);
    const minSliderValue = typeof range.min === "number" ? clampValue(range.min) : minBound;
    const maxSliderValue = typeof range.max === "number" ? clampValue(range.max) : maxBound;
    const applyMinValue = (value: number) => {
      const updatedMax = typeof range.max === "number" && range.max < value ? value : range.max;
      onChange(range.id, { min: value, max: updatedMax });
    };

    const applyMaxValue = (value: number) => {
      const updatedMin = typeof range.min === "number" && range.min > value ? value : range.min;
      onChange(range.id, { max: value, min: updatedMin });
    };

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
              step={1}
              value={range.min ?? ""}
              onChange={(event) => {
                const raw = event.target.value.trim();
                if (raw === "") {
                  onChange(range.id, { min: null });
                  return;
                }
                const parsed = Math.floor(Number(raw));
                if (Number.isNaN(parsed)) {
                  return;
                }
                const updatedMax =
                  typeof range.max === "number" && range.max < parsed ? parsed : range.max;
                onChange(range.id, { min: parsed, max: updatedMax });
              }}
              onKeyDown={(event) => handleCommitOnEnter(event, onCommit)}
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
              step={1}
              value={range.max ?? ""}
              onChange={(event) => {
                const raw = event.target.value.trim();
                if (raw === "") {
                  onChange(range.id, { max: null });
                  return;
                }
                const parsed = Math.ceil(Number(raw));
                if (Number.isNaN(parsed)) {
                  return;
                }
                const updatedMin =
                  typeof range.min === "number" && range.min > parsed ? parsed : range.min;
                onChange(range.id, { max: parsed, min: updatedMin });
              }}
              onKeyDown={(event) => handleCommitOnEnter(event, onCommit)}
              min={minBound}
              max={maxBound}
              placeholder={metadata.max !== null ? `${metadata.max}` : undefined}
              className="w-full rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm text-rose-700 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
            />
          </label>
        </div>
        <div className="flex flex-col gap-1 text-xs text-rose-400">
          <span>Adjust quickly</span>
          <RangeSlider
            min={minBound}
            max={maxBound}
            step={1}
            valueMin={minSliderValue}
            valueMax={maxSliderValue}
            onChangeMin={applyMinValue}
            onChangeMax={applyMaxValue}
            onCommit={onCommit}
          />
        </div>
      </div>
    );
  };

  return (
    <form
      action="/search"
      method="get"
      className="flex w-full min-w-0 flex-col gap-6"
      aria-label="Filters"
    >
      <input type="hidden" name="q" value={query ?? ""} />
      <input type="hidden" name="tag_match" value={tagMatch} />
      <input type="hidden" name="color_match" value={colorMatch} />
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
        actions={
          <button
            type="button"
            onClick={() =>
              updateQuery((params) => {
                params.set("tag_match", tagMatch === "all" ? "any" : "all");
              })
            }
            className="inline-flex h-7 items-center gap-2 rounded-full border border-rose-200 px-3 text-xs font-semibold uppercase tracking-wide text-rose-500 transition hover:border-rose-300 hover:text-rose-700"
            aria-pressed={tagMatch === "all"}
          >
            {tagMatch === "all" ? "AND" : "OR"}
          </button>
        }
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
        actions={
          <button
            type="button"
            onClick={() =>
              updateQuery((params) => {
                params.set("color_match", colorMatch === "all" ? "any" : "all");
              })
            }
            className="inline-flex h-7 items-center gap-2 rounded-full border border-rose-200 px-3 text-xs font-semibold uppercase tracking-wide text-rose-500 transition hover:border-rose-300 hover:text-rose-700"
            aria-pressed={colorMatch === "all"}
          >
            {colorMatch === "all" ? "AND" : "OR"}
          </button>
        }
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
        actions={
          <button
            type="button"
            onClick={() =>
              updateQuery((params) => {
                params.set("fabric_match", fabricMatch === "all" ? "any" : "all");
              })
            }
            className="inline-flex h-7 items-center gap-2 rounded-full border border-rose-200 px-3 text-xs font-semibold uppercase tracking-wide text-rose-500 transition hover:border-rose-300 hover:text-rose-700"
            aria-pressed={fabricMatch === "all"}
          >
            {fabricMatch === "all" ? "AND" : "OR"}
          </button>
        }
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
        actions={
          <button
            type="button"
            onClick={() =>
              updateQuery((params) => {
                params.set("feature_match", featureMatch === "all" ? "any" : "all");
              })
            }
            className="inline-flex h-7 items-center gap-2 rounded-full border border-rose-200 px-3 text-xs font-semibold uppercase tracking-wide text-rose-500 transition hover:border-rose-300 hover:text-rose-700"
            aria-pressed={featureMatch === "all"}
          >
            {featureMatch === "all" ? "AND" : "OR"}
          </button>
        }
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
        description={measurementDescription}
        collapsible={false}
      >
        <div className="flex flex-col gap-4">
          {measurementRanges.length === 0 ? (
            <p className="text-xs text-rose-400">No measurements selected. Add one to get started.</p>
          ) : null}
          {measurementRanges.map((range, index) => {
            const selectedOption = measurementOptionsMap.get(range.name);
            const baseUnit = selectedOption?.unit ?? "cm";
            const displayUnit = measurementUnit === "inch" ? "in" : baseUnit;
            const minDisplay =
              selectedOption?.min !== null && selectedOption?.min !== undefined
                ? formatMeasurementValue(selectedOption.min, baseUnit, measurementUnit)
                : null;
            const maxDisplay =
              selectedOption?.max !== null && selectedOption?.max !== undefined
                ? formatMeasurementValue(selectedOption.max, baseUnit, measurementUnit)
                : null;
            const minLimit =
              typeof selectedOption?.min === "number"
                ? convertMeasurementValue(selectedOption.min, baseUnit, measurementUnit)
                : undefined;
            const maxLimit =
              typeof selectedOption?.max === "number"
                ? convertMeasurementValue(selectedOption.max, baseUnit, measurementUnit)
                : undefined;
            const hasSliderBounds =
              typeof minLimit === "number" &&
              typeof maxLimit === "number" &&
              maxLimit > minLimit;

            return (
              <div key={range.id} className="grid gap-3 rounded-xl border border-rose-100 bg-white/60 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="sr-only" htmlFor={`measurement-name-${index}`}>
                      Measurement
                    </label>
                    <RoseDropdown
                      id={`measurement-name-${index}`}
                      value={range.name}
                      onChange={(value) => handleMeasurementNameChange(range.id, value)}
                      size="xs"
                      options={measurementOptions.map((option) => ({
                        value: option.name,
                        label: option.label,
                      }))}
                    />
                    <span className="text-xs text-rose-400">{displayUnit}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeMeasurementRange(range.id)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-rose-200 text-sm text-rose-500 transition hover:border-rose-300 hover:text-rose-700"
                    title="Remove range"
                  >
                    ×
                  </button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-xs text-rose-400">
                    <span>Min</span>
                    <input
                      type="number"
                      step={1}
                      value={range.min}
                      onChange={(event) => handleMeasurementRangeChange(range.id, "min", event.target.value)}
                      onKeyDown={(event) => handleCommitOnEnter(event, () => commitMeasurementRangesQuery(measurementRanges))}
                      min={minLimit}
                      max={maxLimit}
                      placeholder={minDisplay || undefined}
                      className="w-full rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm text-rose-700 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-rose-400">
                    <span>Max</span>
                    <input
                      type="number"
                      step={1}
                      value={range.max}
                      onChange={(event) => handleMeasurementRangeChange(range.id, "max", event.target.value)}
                      onKeyDown={(event) => handleCommitOnEnter(event, () => commitMeasurementRangesQuery(measurementRanges))}
                      min={minLimit}
                      max={maxLimit}
                      placeholder={maxDisplay || undefined}
                      className="w-full rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm text-rose-700 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
                    />
                  </label>
                </div>
                {hasSliderBounds ? (() => {
                  const minBound = Math.floor(minLimit as number);
                  const maxBound = Math.ceil(maxLimit as number);
                  const clampValue = (value: number) => Math.min(Math.max(value, minBound), maxBound);
                  const parseValue = (value: string, fallback: number) => {
                    const parsed = Number(value);
                    return Number.isFinite(parsed) ? parsed : fallback;
                  };
                  const sliderMinValue = clampValue(parseValue(range.min, minBound));
                  const sliderMaxValue = clampValue(parseValue(range.max, maxBound));
                  const applyMinValue = (value: number, commit = false) => {
                    const clamped = clampValue(value);
                    const minString = formatMeasurementNumber(clamped);
                    const currentMax = Number(range.max);
                    let nextMax = range.max;
                    if (!Number.isNaN(currentMax) && currentMax < clamped) {
                      nextMax = formatMeasurementNumber(clamped);
                    }
                    updateMeasurementRangeValues(range.id, minString, nextMax, commit);
                  };
                  const applyMaxValue = (value: number, commit = false) => {
                    const clamped = clampValue(value);
                    const maxString = formatMeasurementNumber(clamped);
                    const currentMin = Number(range.min);
                    let nextMin = range.min;
                    if (!Number.isNaN(currentMin) && clamped < currentMin) {
                      nextMin = formatMeasurementNumber(clamped);
                    }
                    updateMeasurementRangeValues(range.id, nextMin, maxString, commit);
                  };

                  return (
                    <div className="flex flex-col gap-1 text-xs text-rose-400">
                      <span>Adjust quickly</span>
                      <RangeSlider
                        min={Math.floor(minBound)}
                        max={Math.ceil(maxBound)}
                        step={1}
                        valueMin={Math.round(sliderMinValue)}
                        valueMax={Math.round(sliderMaxValue)}
                        onChangeMin={(value) => applyMinValue(Math.round(value))}
                        onChangeMax={(value) => applyMaxValue(Math.round(value))}
                        onCommit={() => pendingMeasurementCommitRef.current = measurementRanges}
                      />
                    </div>
                  );
                })() : null}
              </div>
            );
          })}
          <button
            type="button"
            onClick={addMeasurementRange}
            className="inline-flex items-center gap-2 rounded-full border border-rose-200 px-3 py-1 text-xs font-medium text-rose-500 transition hover:border-rose-300 hover:text-rose-700"
          >
            <span aria-hidden="true">＋</span>
            Add measurement
          </button>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        id="release-years"
        title="Release Year"
        description="Add one or more year spans to narrow the timeline."
        collapsible={false}
      >
        {releaseYearRanges.length === 0 ? (
          <p className="text-xs text-rose-400">No ranges selected. Add one to get started.</p>
        ) : null}
        {releaseYearRanges.map((range, index) =>
          renderRangeRow(
            range,
            index,
            releaseYearBounds,
            updateReleaseYearRange,
            removeReleaseYearRange,
            () => commitReleaseYearQuery(releaseYearRanges)
          )
        )}
        <button
          type="button"
          onClick={addReleaseYearRange}
          className="inline-flex items-center gap-2 rounded-full border border-rose-200 px-3 py-1 text-xs font-medium text-rose-500 transition hover:border-rose-300 hover:text-rose-700"
        >
          <span aria-hidden="true">＋</span>
          Add range
        </button>
      </CollapsibleSection>

      <CollapsibleSection
        id="prices"
        title="Price"
        description={`Target price bands in ${preferredCurrency}.`}
        collapsible={false}
      >
        {priceRanges.length === 0 ? (
          <p className="text-xs text-rose-400">No ranges selected. Add one to focus pricing.</p>
        ) : null}
        {priceRanges.map((range, index) =>
          renderPriceRangeRow(
            range,
            index,
            priceMetadata,
            updatePriceRange,
            removePriceRange,
            () => commitPriceRangesQuery(priceRanges)
          )
        )}
        <button
          type="button"
          onClick={addPriceRange}
          className="inline-flex items-center gap-2 rounded-full border border-rose-200 px-3 py-1 text-xs font-medium text-rose-500 transition hover:border-rose-300 hover:text-rose-700"
        >
          <span aria-hidden="true">＋</span>
          Add range
        </button>
      </CollapsibleSection>
    </form>
  );
}
