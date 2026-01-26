"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const MEASUREMENT_STORAGE_KEY = "jiraibrary.guest.measurement";
const DEFAULT_MEASUREMENT = "cm";

type MeasurementUnit = "cm" | "inch";

type MeasurementContextValue = {
  unit: MeasurementUnit;
  setUnit: (value: MeasurementUnit) => void;
};

const MeasurementContext = createContext<MeasurementContextValue | null>(null);

const normalizeUnit = (value: string | null | undefined): MeasurementUnit | "" => {
  if (!value) return "";
  const trimmed = value.trim().toLowerCase();
  if (trimmed === "inch" || trimmed === "in") return "inch";
  if (trimmed === "cm") return "cm";
  return "";
};

const resolveInitialUnit = (initialUnit?: string | null): MeasurementUnit => {
  const normalizedInitial = normalizeUnit(initialUnit);
  if (normalizedInitial) {
    return normalizedInitial;
  }
  if (typeof window === "undefined") {
    return DEFAULT_MEASUREMENT;
  }
  const stored = normalizeUnit(window.localStorage.getItem(MEASUREMENT_STORAGE_KEY));
  return stored || DEFAULT_MEASUREMENT;
};

type MeasurementProviderProps = {
  children: React.ReactNode;
  initialUnit?: string | null;
};

export function MeasurementUnitProvider({ children, initialUnit }: MeasurementProviderProps) {
  const [unit, setUnitState] = useState<MeasurementUnit>(() => resolveInitialUnit(initialUnit));

  const applyUnit = useCallback((value: MeasurementUnit) => {
    const normalized = normalizeUnit(value) || DEFAULT_MEASUREMENT;
    setUnitState(normalized);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(MEASUREMENT_STORAGE_KEY, normalized);
      document.cookie = `${MEASUREMENT_STORAGE_KEY}=${normalized}; path=/; max-age=31536000`;
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = normalizeUnit(window.localStorage.getItem(MEASUREMENT_STORAGE_KEY));
    if (stored && stored !== unit) {
      applyUnit(stored);
      return;
    }
    if (!stored && unit) {
      window.localStorage.setItem(MEASUREMENT_STORAGE_KEY, unit);
      document.cookie = `${MEASUREMENT_STORAGE_KEY}=${unit}; path=/; max-age=31536000`;
    }
  }, [applyUnit, unit]);

  const contextValue = useMemo<MeasurementContextValue>(
    () => ({
      unit,
      setUnit: applyUnit,
    }),
    [applyUnit, unit],
  );

  return <MeasurementContext.Provider value={contextValue}>{children}</MeasurementContext.Provider>;
}

export function useMeasurementUnit(): MeasurementContextValue {
  const value = useContext(MeasurementContext);
  if (!value) {
    return {
      unit: DEFAULT_MEASUREMENT,
      setUnit: () => {},
    } satisfies MeasurementContextValue;
  }
  return value;
}
