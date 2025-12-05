"use client";

import { useEffect, useState } from "react";

import { listCurrencies, type CurrencySummary } from "./api";

export type CurrencyOption = {
  code: string;
  label: string;
};

const FALLBACK_CURRENCIES: CurrencyOption[] = [
  { code: "USD", label: "USD · US Dollar" },
  { code: "EUR", label: "EUR · Euro" },
  { code: "JPY", label: "JPY · Japanese Yen" },
  { code: "GBP", label: "GBP · British Pound" },
  { code: "CAD", label: "CAD · Canadian Dollar" },
  { code: "AUD", label: "AUD · Australian Dollar" },
];

function mapCurrencySummaries(currencies: CurrencySummary[]): CurrencyOption[] {
  const unique = new Map<string, CurrencyOption>();
  currencies
    .filter((currency) => currency.code && currency.is_active)
    .forEach((currency) => {
      const code = currency.code.toUpperCase();
      if (unique.has(code)) {
        return;
      }
      const normalizedLabel = currency.name ? `${code} · ${currency.name}` : code;
      unique.set(code, { code, label: normalizedLabel });
    });
  return Array.from(unique.values()).sort((a, b) => a.code.localeCompare(b.code));
}

export function useCurrencyOptions(): { currencyOptions: CurrencyOption[]; currencyLoading: boolean } {
  const [currencyOptions, setCurrencyOptions] = useState<CurrencyOption[]>(FALLBACK_CURRENCIES);
  const [currencyLoading, setCurrencyLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setCurrencyLoading(true);
      try {
        const currencies = await listCurrencies();
        if (cancelled) {
          return;
        }
        const mapped = mapCurrencySummaries(currencies);
        if (mapped.length > 0) {
          setCurrencyOptions(mapped);
        }
      } catch (error) {
        console.error("Failed to load currencies", error);
      } finally {
        if (!cancelled) {
          setCurrencyLoading(false);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { currencyOptions, currencyLoading };
}
