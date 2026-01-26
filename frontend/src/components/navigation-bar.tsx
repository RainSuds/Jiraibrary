"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FocusEvent, useCallback, useEffect, useRef, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { useCurrency } from "@/components/currency-provider";
import { useFlash } from "@/components/flash-provider";
import { useLocale } from "@/components/locale-provider";
import { useMeasurementUnit } from "@/components/measurement-unit-provider";
import NavigationSearch from "@/components/navigation-search";
import RoseDropdown from "@/components/ui/rose-dropdown";
import {
  CurrencySummary,
  LanguageSummary,
  UpdateUserPreferencesPayload,
  listCurrencies,
  listLanguages,
} from "@/lib/api";

const LANGUAGE_STORAGE_KEY = "jiraibrary.guest.language";
const CURRENCY_STORAGE_KEY = "jiraibrary.guest.currency";
const MEASUREMENT_STORAGE_KEY = "jiraibrary.guest.measurement";

export default function NavigationBar() {
  const { user, logout, loading, updatePreferences } = useAuth();
  const { addFlash } = useFlash();
  const { locale, setLocale } = useLocale();
  const { currency, setCurrency } = useCurrency();
  const { unit: measurementUnit, setUnit: setMeasurementUnit } = useMeasurementUnit();
  const [pending, setPending] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [preferencePending, setPreferencePending] = useState(false);
  const [languages, setLanguages] = useState<LanguageSummary[]>([]);
  const [currencies, setCurrencies] = useState<CurrencySummary[]>([]);
  const [languageSelection, setLanguageSelection] = useState<string>(user?.preferred_language ?? "en");
  const [currencySelection, setCurrencySelection] = useState<string>(user?.preferred_currency ?? "USD");
  const [measurementSelection, setMeasurementSelection] = useState<string>(user?.preferred_measurement_system ?? "cm");
  const router = useRouter();
  const pathname = usePathname();
  const loginHref = pathname && pathname !== "/profile" ? `/login?next=${encodeURIComponent(pathname)}` : "/login";
  const displayName = user ? user.display_name || user.username : "";
  const avatarInitial = displayName ? displayName.charAt(0).toUpperCase() : "";
  const avatarUrl = user?.avatar_url ?? null;
  const closeTimeoutRef = useRef<number | null>(null);

  const handleLogout = useCallback(async () => {
    setMenuOpen(false);
    setPending(true);
    try {
      await logout();
      addFlash({ kind: "success", title: "Signed out", message: "You have been signed out.", timeoutMs: 1500 });
      router.push("/");
    } finally {
      setPending(false);
    }
  }, [addFlash, logout, router]);

  const handleMenuBlur = useCallback((event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setMenuOpen(false);
    }
  }, []);

  const cancelClose = useCallback(() => {
    if (closeTimeoutRef.current) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    cancelClose();
    closeTimeoutRef.current = window.setTimeout(() => {
      setMenuOpen(false);
      closeTimeoutRef.current = null;
    }, 150);
  }, [cancelClose]);

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        window.clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (user) {
      const nextLanguage = user.preferred_language ?? "en";
      setLanguageSelection(nextLanguage);
      setLocale(nextLanguage);
      const nextCurrency = user.preferred_currency ?? "USD";
      setCurrencySelection(nextCurrency);
      setCurrency(nextCurrency);
      const nextMeasurement = user.preferred_measurement_system ?? "cm";
      setMeasurementSelection(nextMeasurement);
      setMeasurementUnit(nextMeasurement === "inch" ? "inch" : "cm");
      return;
    }
    if (typeof window === "undefined") {
      setLanguageSelection("en");
      setLocale("en");
      setCurrencySelection("USD");
      setCurrency("USD");
      setMeasurementSelection("cm");
      setMeasurementUnit("cm");
      return;
    }
    const storedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY) ?? "en";
    const storedCurrency = window.localStorage.getItem(CURRENCY_STORAGE_KEY) ?? "USD";
    const storedMeasurement = window.localStorage.getItem(MEASUREMENT_STORAGE_KEY) ?? "cm";
    setLanguageSelection(storedLanguage);
    setLocale(storedLanguage);
    setCurrencySelection(storedCurrency);
    setCurrency(storedCurrency);
    setMeasurementSelection(storedMeasurement);
    setMeasurementUnit(storedMeasurement === "inch" ? "inch" : "cm");
  }, [setCurrency, setLocale, setMeasurementUnit, user]);

  useEffect(() => {
    let cancelled = false;
    const hydrateOptions = async () => {
      try {
        const [languageResults, currencyResults] = await Promise.all([listLanguages(), listCurrencies()]);
        if (!cancelled) {
          setLanguages(languageResults);
          setCurrencies(currencyResults);
        }
      } catch (error) {
        console.error("Failed to load locale options", error);
      }
    };
    void hydrateOptions();
    return () => {
      cancelled = true;
    };
  }, []);

  const applyPreferenceChange = useCallback(
    async (updates: UpdateUserPreferencesPayload) => {
      if (!user) {
        return;
      }
      setPreferencePending(true);
      try {
        await updatePreferences(updates);
        addFlash({ kind: "success", title: "Settings saved", message: "Your preferences have been updated.", timeoutMs: 1500 });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to update preferences.";
        addFlash({ kind: "error", title: "Save failed", message });
      } finally {
        setPreferencePending(false);
      }
    },
    [addFlash, updatePreferences, user],
  );

  const handleLanguageChange = useCallback(
    (value: string) => {
      setLanguageSelection(value);
      setLocale(value);
      if (user) {
        void applyPreferenceChange({ preferred_language: value });
      } else if (typeof window !== "undefined") {
        window.localStorage.setItem(LANGUAGE_STORAGE_KEY, value);
      }
      router.refresh();
    },
    [applyPreferenceChange, router, setLocale, user],
  );

  const handleCurrencyChange = useCallback(
    (value: string) => {
      setCurrencySelection(value);
      setCurrency(value);
      if (user) {
        void applyPreferenceChange({ preferred_currency: value });
      } else if (typeof window !== "undefined") {
        window.localStorage.setItem(CURRENCY_STORAGE_KEY, value);
      }
      router.refresh();
    },
    [applyPreferenceChange, router, setCurrency, user],
  );

  const handleMeasurementChange = useCallback(
    (value: string) => {
      const normalized = value === "inch" ? "inch" : "cm";
      setMeasurementSelection(normalized);
      setMeasurementUnit(normalized);
      if (user) {
        void applyPreferenceChange({ preferred_measurement_system: normalized });
      } else if (typeof window !== "undefined") {
        window.localStorage.setItem(MEASUREMENT_STORAGE_KEY, normalized);
      }
      router.refresh();
    },
    [applyPreferenceChange, router, setMeasurementUnit, user],
  );

  return (
    <header className="border-b border-rose-100/80 bg-white/75 backdrop-blur">
      <nav className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-4 px-6 py-4 md:grid-cols-[auto_1fr] md:items-center">
        <Link href="/" className="text-lg font-semibold tracking-tight text-rose-700">
          Jiraibrary
        </Link>
        <div className="flex w-full flex-wrap items-center gap-4 text-sm font-medium text-rose-600 md:justify-end">
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-rose-500">
              <label className="sr-only" htmlFor="language-select">
                Preferred language
              </label>
              <RoseDropdown
                id="language-select"
                value={languageSelection}
                onChange={handleLanguageChange}
                disabled={preferencePending}
                options={
                  languages.length === 0
                    ? [{ value: "en", label: "English" }]
                    : languages.map((language) => ({
                        value: language.code,
                        label: language.name,
                      }))
                }
              />
              <label className="sr-only" htmlFor="currency-select">
                Preferred currency
              </label>
              <RoseDropdown
                id="currency-select"
                value={currencySelection}
                onChange={handleCurrencyChange}
                disabled={preferencePending}
                options={
                  currencies.length === 0
                    ? [{ value: "USD", label: "USD" }]
                    : currencies.map((currency) => ({
                        value: currency.code,
                        label: `${currency.code} ${currency.symbol ?? ""}`.trim(),
                      }))
                }
              />
              <label className="sr-only" htmlFor="measurement-select">
                Preferred measurement
              </label>
              <RoseDropdown
                id="measurement-select"
                value={measurementSelection}
                onChange={handleMeasurementChange}
                disabled={preferencePending}
                options={[
                  { value: "cm", label: "CM" },
                  { value: "inch", label: "IN" },
                ]}
              />
          </div>
          <NavigationSearch className="order-last w-full md:order-none md:w-60 lg:w-72" />
          <Link
            href="/support"
            className="rounded-full border border-rose-200 px-3 py-1 text-rose-600 transition hover:border-rose-300 hover:text-rose-800"
          >
            Support
          </Link>
          {user ? null : (
            <Link
              href={loginHref}
              className="rounded-full border border-rose-200 px-3 py-1 text-rose-600 transition hover:border-rose-300 hover:text-rose-800"
            >
              {loading ? "Loading…" : "Login"}
            </Link>
          )}
          {user ? (
            <div
              className="relative"
              onMouseEnter={() => {
                cancelClose();
                setMenuOpen(true);
              }}
              onMouseLeave={scheduleClose}
              onBlur={handleMenuBlur}
            >
              <button
                type="button"
                className="relative flex h-10 w-10 items-center justify-center rounded-full border border-rose-200 bg-rose-50 text-sm font-semibold text-rose-600 transition hover:border-rose-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                onClick={() => {
                  cancelClose();
                  setMenuOpen((value) => !value);
                }}
                onFocus={() => {
                  cancelClose();
                  setMenuOpen(true);
                }}
                aria-haspopup="menu"
              >
                <span className="sr-only">Open account menu</span>
                {avatarUrl ? (
                  <Image
                    src={avatarUrl}
                    alt={`${displayName}'s profile picture`}
                    fill
                    sizes="40px"
                    className="absolute inset-0 h-full w-full rounded-full object-cover"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center">{avatarInitial || "?"}</span>
                )}
              </button>
              <div
                className={`absolute right-0 z-20 mt-3 ${menuOpen ? "flex" : "hidden"} w-44 flex-col gap-2 rounded-2xl border border-rose-100 bg-white/95 p-3 text-sm text-rose-600 shadow-lg`}
                onMouseEnter={cancelClose}
                onMouseLeave={scheduleClose}
              >
                <div className="border-b border-rose-100 pb-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-rose-400">Signed in as</p>
                  <p className="text-sm font-semibold text-rose-900">{displayName}</p>
                </div>
                <Link
                  href="/profile"
                  onClick={() => {
                    cancelClose();
                    setMenuOpen(false);
                  }}
                  className="rounded-xl px-3 py-1 text-left font-medium text-rose-700 transition hover:bg-rose-50 hover:text-rose-900"
                >
                  Profile
                </Link>
                <Link
                  href="/closet"
                  onClick={() => {
                    cancelClose();
                    setMenuOpen(false);
                  }}
                  className="rounded-xl px-3 py-1 text-left font-medium text-rose-700 transition hover:bg-rose-50 hover:text-rose-900"
                >
                  Closet
                </Link>
                <Link
                  href="/profile?panel=account"
                  onClick={() => {
                    cancelClose();
                    setMenuOpen(false);
                  }}
                  className="rounded-xl px-3 py-1 text-left font-medium text-rose-700 transition hover:bg-rose-50 hover:text-rose-900"
                >
                  Settings
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    cancelClose();
                    void handleLogout();
                  }}
                  disabled={pending}
                  className="rounded-xl px-3 py-1 text-left font-medium text-rose-600 transition hover:bg-rose-50 hover:text-rose-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {pending ? "Signing out…" : "Log out"}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </nav>
    </header>
  );
}
