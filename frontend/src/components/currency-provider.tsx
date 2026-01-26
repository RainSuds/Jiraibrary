"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { listCurrencies } from "@/lib/api";

const CURRENCY_STORAGE_KEY = "jiraibrary.guest.currency";
const DEFAULT_CURRENCY = "USD";

type CurrencyContextValue = {
  currency: string;
  setCurrency: (value: string) => void;
  formatCurrency: (value: number, options?: Intl.NumberFormatOptions) => string;
};

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

const normalizeCurrency = (value: string | null | undefined) => {
  if (!value) return "";
  return value.trim().toUpperCase();
};

const resolveInitialCurrency = (initialCurrency?: string) => {
  const normalizedInitial = normalizeCurrency(initialCurrency);
  if (normalizedInitial) {
    return normalizedInitial;
  }
  if (typeof window === "undefined") {
    return DEFAULT_CURRENCY;
  }
  const stored = normalizeCurrency(window.localStorage.getItem(CURRENCY_STORAGE_KEY));
  return stored || DEFAULT_CURRENCY;
};

type CurrencyProviderProps = {
  children: React.ReactNode;
  initialCurrency?: string | null;
};

export function CurrencyProvider({ children, initialCurrency }: CurrencyProviderProps) {
  const [currency, setCurrencyState] = useState(() => resolveInitialCurrency(initialCurrency));
  const [supportedCurrencies, setSupportedCurrencies] = useState<string[]>([DEFAULT_CURRENCY]);

  useEffect(() => {
    let cancelled = false;
    const hydrateCurrencies = async () => {
      try {
        const results = await listCurrencies();
        if (cancelled) return;
        const codes = results
          .map((item) => normalizeCurrency(item.code))
          .filter(Boolean);
        if (codes.length > 0) {
          setSupportedCurrencies(Array.from(new Set([DEFAULT_CURRENCY, ...codes])));
        }
      } catch {
        // Ignore currency loading failures; default fallback remains.
      }
    };
    void hydrateCurrencies();
    return () => {
      cancelled = true;
    };
  }, []);

  const applyCurrency = useCallback((value: string) => {
    const normalized = normalizeCurrency(value) || DEFAULT_CURRENCY;
    setCurrencyState(normalized);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(CURRENCY_STORAGE_KEY, normalized);
      document.cookie = `${CURRENCY_STORAGE_KEY}=${normalized}; path=/; max-age=31536000`;
    }
  }, []);

  useEffect(() => {
    if (supportedCurrencies.length === 0) return;
    if (!supportedCurrencies.includes(currency)) {
      applyCurrency(DEFAULT_CURRENCY);
    }
  }, [applyCurrency, currency, supportedCurrencies]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = normalizeCurrency(window.localStorage.getItem(CURRENCY_STORAGE_KEY));
    if (stored && stored !== currency) {
      applyCurrency(stored);
      return;
    }
    if (!stored && currency) {
      window.localStorage.setItem(CURRENCY_STORAGE_KEY, currency);
      document.cookie = `${CURRENCY_STORAGE_KEY}=${currency}; path=/; max-age=31536000`;
    }
  }, [applyCurrency, currency]);

  const formatCurrency = useCallback(
    (value: number, options?: Intl.NumberFormatOptions) =>
      new Intl.NumberFormat(undefined, {
        style: "currency",
        currency,
        ...options,
      }).format(value),
    [currency],
  );

  const contextValue = useMemo<CurrencyContextValue>(
    () => ({
      currency,
      setCurrency: applyCurrency,
      formatCurrency,
    }),
    [applyCurrency, currency, formatCurrency],
  );

  return <CurrencyContext.Provider value={contextValue}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  const value = useContext(CurrencyContext);
  if (!value) {
    return {
      currency: DEFAULT_CURRENCY,
      setCurrency: () => {},
      formatCurrency: (amount: number, options?: Intl.NumberFormatOptions) =>
        new Intl.NumberFormat(undefined, {
          style: "currency",
          currency: DEFAULT_CURRENCY,
          ...options,
        }).format(amount),
    } satisfies CurrencyContextValue;
  }
  return value;
}
