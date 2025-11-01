"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { useAuth } from "@/components/auth-provider";

export default function NavigationBar() {
  const { user, logout, loading } = useAuth();
  const [pending, setPending] = useState(false);
  const router = useRouter();

  const handleLogout = useCallback(async () => {
    setPending(true);
    try {
      await logout();
      router.push("/");
    } finally {
      setPending(false);
    }
  }, [logout, router]);

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
          ) : null}
          {user ? (
            <button
              type="button"
              onClick={handleLogout}
              disabled={pending}
              className="rounded-full border border-rose-200 px-3 py-1 text-rose-600 transition hover:border-rose-300 hover:text-rose-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? "Signing out…" : `Logout (${user.display_name})`}
            </button>
          ) : (
            <Link
              href="/login"
              className="rounded-full border border-rose-200 px-3 py-1 text-rose-600 transition hover:border-rose-300 hover:text-rose-800"
            >
              {loading ? "Loading…" : "Login"}
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
