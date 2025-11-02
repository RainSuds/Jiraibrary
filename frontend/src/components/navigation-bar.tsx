"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FocusEvent, useCallback, useEffect, useRef, useState } from "react";

import { useAuth } from "@/components/auth-provider";

export default function NavigationBar() {
  const { user, logout, loading } = useAuth();
  const [pending, setPending] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
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

  return (
    <header className="border-b border-rose-100/80 bg-white/75 backdrop-blur">
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-lg font-semibold tracking-tight text-rose-700">
          Jiraibrary
        </Link>
        <div className="flex items-center gap-4 text-sm font-medium text-rose-600">
          <Link href="/" className="transition hover:text-rose-800">
            Home
          </Link>
          <Link href="/search" className="transition hover:text-rose-800">
            Search
          </Link>
          <a
            href="/admin/"
            className="transition hover:text-rose-800"
            rel="noreferrer"
            target="_blank"
          >
            Admin
          </a>
          {user ? (
            <Link href="/add-entry" className="transition hover:text-rose-800">
              Add Entry
            </Link>
          ) : (
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
