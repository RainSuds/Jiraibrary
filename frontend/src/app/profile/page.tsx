"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useAuth } from "@/components/auth-provider";

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.replace(`/login?next=${encodeURIComponent("/profile")}`);
    }
  }, [loading, router, user]);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-2xl rounded-3xl border border-rose-100 bg-white/90 p-8 shadow-lg">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-1/3 rounded-full bg-rose-100" />
          <div className="h-4 w-2/3 rounded-full bg-rose-50" />
          <div className="h-4 w-1/2 rounded-full bg-rose-50" />
          <div className="h-8 w-1/4 rounded-full bg-rose-100" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto w-full max-w-sm rounded-3xl border border-rose-100 bg-white/90 p-8 text-center shadow-lg">
        <p className="text-sm font-medium text-rose-600">Redirecting to login…</p>
      </div>
    );
  }

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-10">
      <header className="rounded-3xl border border-rose-100 bg-white/90 p-8 shadow-lg">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold uppercase tracking-[0.3em] text-rose-500">
            Account
          </span>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-3xl font-semibold text-rose-900">
              Welcome back, {user.display_name || user.username}
            </h1>
            <div className="relative h-20 w-20 overflow-hidden rounded-full border border-rose-100 bg-rose-50">
              {user.avatar_url ? (
                <Image
                  src={user.avatar_url}
                  alt={`${user.display_name || user.username}'s profile picture`}
                  fill
                  sizes="80px"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-2xl font-semibold text-rose-500">
                  {(user.display_name || user.username).charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          </div>
          <p className="text-sm text-rose-500">
            Manage your Jiraibrary profile, review saved favorites, and continue contributing to the catalog.
          </p>
        </div>
        <div className="mt-6 flex flex-wrap gap-4 text-sm text-slate-600">
          <div className="flex flex-col">
            <span className="text-xs uppercase tracking-wide text-rose-400">Username</span>
            <span className="font-medium text-rose-900">{user.username}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs uppercase tracking-wide text-rose-400">Email</span>
            <span className="font-medium text-rose-900">{user.email}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs uppercase tracking-wide text-rose-400">Role</span>
            <span className="font-medium text-rose-900">
              {user.role ? `${user.role.name} (${user.role.scopes.length} scopes)` : "Standard user"}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs uppercase tracking-wide text-rose-400">Staff access</span>
            <span className="font-medium text-rose-900">{user.is_staff ? "Enabled" : "Disabled"}</span>
          </div>
        </div>
        <div className="mt-8 flex flex-wrap gap-4">
          <Link
            href="/add-entry"
            className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700"
          >
            Submit a new entry
          </Link>
          <Link
            href="/search"
            className="rounded-full border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-600 transition hover:border-rose-300 hover:text-rose-700"
          >
            Browse the catalog
          </Link>
          <button
            type="button"
            onClick={() => {
              void handleLogout();
            }}
            className="rounded-full border border-transparent px-4 py-2 text-sm font-semibold text-rose-500 transition hover:border-rose-200 hover:bg-rose-50"
          >
            Sign out
          </button>
        </div>
      </header>

      <section className="rounded-3xl border border-dashed border-rose-100 bg-white/90 p-8 text-sm text-rose-600 shadow-inner">
        <p>
          Favorites and submission history appear here once you start saving items or contributing entries. Visit the
          {" "}
          <Link href="/search" className="font-semibold text-rose-700 hover:text-rose-900">
            search catalog
          </Link>
          {" "}
          to bookmark looks you love, or head to
          {" "}
          <Link href="/add-entry" className="font-semibold text-rose-700 hover:text-rose-900">
            submit a new entry
          </Link>
          {" "}
          to share references with the community.
        </p>
      </section>
    </div>
  );
}
