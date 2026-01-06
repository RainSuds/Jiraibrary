"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChangeEvent, FocusEvent, useCallback, useEffect, useRef, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import NavigationSearch from "@/components/navigation-search";
import {
  CurrencySummary,
  LanguageSummary,
  UpdateUserPreferencesPayload,
  listCurrencies,
  listLanguages,
} from "@/lib/api";

const LANGUAGE_STORAGE_KEY = "jiraibrary.guest.language";
const CURRENCY_STORAGE_KEY = "jiraibrary.guest.currency";

export default function NavigationBar() {
  const { user, logout, loading, updatePreferences } = useAuth();
  const [pending, setPending] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [preferencePending, setPreferencePending] = useState(false);
  const [languages, setLanguages] = useState<LanguageSummary[]>([]);
  const [currencies, setCurrencies] = useState<CurrencySummary[]>([]);
  const [languageSelection, setLanguageSelection] = useState<string>(user?.preferred_language ?? "en");
  const [currencySelection, setCurrencySelection] = useState<string>(user?.preferred_currency ?? "USD");
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
      router.push("/");
    } finally {
      setPending(false);
    }
  }, [logout, router]);

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
      setLanguageSelection(user.preferred_language ?? "en");
      setCurrencySelection(user.preferred_currency ?? "USD");
      return;
    }
    if (typeof window === "undefined") {
      setLanguageSelection("en");
      setCurrencySelection("USD");
      return;
    }
    const storedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY) ?? "en";
    const storedCurrency = window.localStorage.getItem(CURRENCY_STORAGE_KEY) ?? "USD";
    setLanguageSelection(storedLanguage);
    setCurrencySelection(storedCurrency);
  }, [user]);

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
      } finally {
        setPreferencePending(false);
      }
    },
    [updatePreferences, user],
  );

  const handleLanguageChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const value = event.target.value;
      setLanguageSelection(value);
      if (user) {
        void applyPreferenceChange({ preferred_language: value });
      } else if (typeof window !== "undefined") {
        window.localStorage.setItem(LANGUAGE_STORAGE_KEY, value);
      }
    },
    [applyPreferenceChange, user],
  );

  const handleCurrencyChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const value = event.target.value;
      setCurrencySelection(value);
      if (user) {
        void applyPreferenceChange({ preferred_currency: value });
      } else if (typeof window !== "undefined") {
        window.localStorage.setItem(CURRENCY_STORAGE_KEY, value);
      }
    },
    [applyPreferenceChange, user],
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
              <select
                id="language-select"
                value={languageSelection}
                onChange={handleLanguageChange}
                disabled={preferencePending}
                className="rounded-full border border-rose-200 bg-white px-3 py-1 text-rose-700 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
              >
                {languages.length === 0 ? (
                  <option value="en">English</option>
                ) : (
                  languages.map((language) => (
                    <option key={language.id} value={language.code}>
                      {language.name}
                    </option>
                  ))
                )}
              </select>
              <label className="sr-only" htmlFor="currency-select">
                Preferred currency
              </label>
              <select
                id="currency-select"
                value={currencySelection}
                onChange={handleCurrencyChange}
                disabled={preferencePending}
                className="rounded-full border border-rose-200 bg-white px-3 py-1 text-rose-700 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
              >
                {currencies.length === 0 ? (
                  <option value="USD">USD</option>
                ) : (
                  currencies.map((currency) => (
                    <option key={currency.id} value={currency.code}>
                      {currency.code} {currency.symbol ?? ""}
                    </option>
                  ))
                )}
              </select>
          </div>
          <NavigationSearch className="order-last w-full md:order-none md:w-60 lg:w-72" />
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
