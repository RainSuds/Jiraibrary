"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { listLanguages } from "@/lib/api";

const LOCALE_STORAGE_KEY = "jiraibrary.guest.language";
const DEFAULT_LOCALE = "en";
const RTL_LOCALES = new Set(["ar", "fa", "he", "ur"]);

type LocaleContextValue = {
  locale: string;
  setLocale: (value: string) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  formatDate: (value: Date | number | string, options?: Intl.DateTimeFormatOptions) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
};

type Messages = Record<string, string>;

type LocaleMessages = Record<string, Messages>;

const messages: LocaleMessages = {
  en: {
    "nav.login": "Login",
    "nav.logout": "Sign out",
    "nav.search": "Search",
    "profile.title": "Profile",
    "profile.moderation": "Moderation",
    "profile.admin": "Admin",
  },
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

const normalizeLocale = (value: string | null | undefined) => {
  if (!value) return "";
  return value.trim().toLowerCase();
};

const resolveInitialLocale = () => {
  if (typeof window === "undefined") {
    return DEFAULT_LOCALE;
  }
  const stored = normalizeLocale(window.localStorage.getItem(LOCALE_STORAGE_KEY));
  if (stored) return stored;
  const browser = normalizeLocale(window.navigator.language);
  return browser || DEFAULT_LOCALE;
};

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState(resolveInitialLocale);
  const [supportedLocales, setSupportedLocales] = useState<string[]>([DEFAULT_LOCALE]);

  useEffect(() => {
    let cancelled = false;
    const hydrateLocales = async () => {
      try {
        const results = await listLanguages();
        if (cancelled) return;
        const codes = results
          .map((language) => normalizeLocale(language.code))
          .filter(Boolean);
        if (codes.length > 0) {
          setSupportedLocales(Array.from(new Set([DEFAULT_LOCALE, ...codes])));
        }
      } catch {
        // Ignore locale loading failures; default fallback remains.
      }
    };
    void hydrateLocales();
    return () => {
      cancelled = true;
    };
  }, []);

  const applyLocale = useCallback((value: string) => {
    const normalized = normalizeLocale(value) || DEFAULT_LOCALE;
    setLocaleState(normalized);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, normalized);
      document.documentElement.lang = normalized;
      document.documentElement.dir = RTL_LOCALES.has(normalized) ? "rtl" : "ltr";
    }
  }, []);

  useEffect(() => {
    if (supportedLocales.length === 0) return;
    if (!supportedLocales.includes(locale)) {
      applyLocale(DEFAULT_LOCALE);
    }
  }, [applyLocale, locale, supportedLocales]);

  const translate = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      const bucket = messages[locale] ?? messages[DEFAULT_LOCALE] ?? {};
      const template = bucket[key] ?? key;
      if (!vars) return template;
      return Object.keys(vars).reduce((acc, varKey) => acc.replace(`{${varKey}}`, String(vars[varKey])), template);
    },
    [locale],
  );

  const formatDate = useCallback(
    (value: Date | number | string, options?: Intl.DateTimeFormatOptions) => {
      const date = value instanceof Date ? value : new Date(value);
      return new Intl.DateTimeFormat(locale || DEFAULT_LOCALE, options).format(date);
    },
    [locale],
  );

  const formatNumber = useCallback(
    (value: number, options?: Intl.NumberFormatOptions) =>
      new Intl.NumberFormat(locale || DEFAULT_LOCALE, options).format(value),
    [locale],
  );

  const contextValue = useMemo<LocaleContextValue>(
    () => ({
      locale,
      setLocale: applyLocale,
      t: translate,
      formatDate,
      formatNumber,
    }),
    [applyLocale, formatDate, formatNumber, locale, translate],
  );

  return <LocaleContext.Provider value={contextValue}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const value = useContext(LocaleContext);
  if (!value) {
    return {
      locale: DEFAULT_LOCALE,
      setLocale: () => {},
      t: (key: string) => key,
      formatDate: (value: Date | number | string, options?: Intl.DateTimeFormatOptions) =>
        new Intl.DateTimeFormat(DEFAULT_LOCALE, options).format(new Date(value)),
      formatNumber: (value: number, options?: Intl.NumberFormatOptions) =>
        new Intl.NumberFormat(DEFAULT_LOCALE, options).format(value),
    } satisfies LocaleContextValue;
  }
  return value;
}
