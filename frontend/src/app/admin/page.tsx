"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";

import { useAuth } from "@/components/auth-provider";

const quickDestinations = [
  {
    label: "Profile controls",
    description: "Adjust sharing rules, roles, or announce maintenance windows.",
    href: "/profile?panel=account",
  },
  {
    label: "Moderation queue",
    description: "Speed-run reported items and signal cleanups.",
    href: "/profile?panel=moderation",
  },
  {
    label: "Closet intelligence",
    description: "Browse active wardrobes to spot catalog gaps.",
    href: "/closet",
  },
];

const roadmapCalls = [
  {
    title: "Weekly curation sync",
    meta: "Handoff ETA: 2d",
    detail: "Prioritize which pending submissions deserve fast-track review.",
  },
  {
    title: "Merchant partnerships",
    meta: "Needs owner",
    detail: "Surface which brands are missing lookbooks before the next pitch.",
  },
  {
    title: "Data hygiene",
    meta: "45% ready",
    detail: "Tidy mis-labeled categories and archive duplicates before metrics go live.",
  },
];

const checklist = [
  {
    label: "Catalog health",
    status: "On track",
    percent: 68,
    tone: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  {
    label: "Community safety",
    status: "Needs follow-up",
    percent: 42,
    tone: "border-amber-200 bg-amber-50 text-amber-700",
  },
  {
    label: "Roadmap clarity",
    status: "Blocked",
    percent: 25,
    tone: "border-rose-200 bg-rose-50 text-rose-700",
  },
];

export default function AdminHubPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const roleName = useMemo(() => user?.role?.name?.toLowerCase() ?? "user", [user]);
  const isAdmin = Boolean(user?.is_superuser || roleName === "admin");

  useEffect(() => {
    if (!loading && user && !isAdmin) {
      router.replace("/403");
    }
  }, [loading, user, isAdmin, router]);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-4xl rounded-3xl border border-rose-100 bg-white/90 p-8 shadow-lg">
        <div className="space-y-4">
          <div className="h-6 w-1/3 rounded-full bg-rose-100" />
          <div className="h-4 w-2/3 rounded-full bg-rose-50" />
          <div className="h-4 w-1/2 rounded-full bg-rose-50" />
        </div>
      </div>
    );
  }

  if (!user) {
    router.replace(`/login?next=${encodeURIComponent("/admin")}`);
    return (
      <div className="mx-auto w-full max-w-sm rounded-3xl border border-rose-100 bg-white/90 p-8 text-center shadow-lg">
        <p className="text-sm font-medium text-rose-600">Redirecting to login…</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto w-full max-w-3xl rounded-3xl border border-rose-100 bg-white/90 p-8 text-center shadow-lg">
        <p className="text-sm font-medium text-rose-600">Checking admin access…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      <section className="rounded-3xl border border-rose-100 bg-white/95 p-8 shadow-lg">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-rose-400">Admin lab</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-rose-900">Guide the catalog.</h1>
            <p className="mt-3 max-w-2xl text-sm text-rose-500">
              Keep curation smooth, unblock moderators, and broadcast product direction. Nothing here pings the Django admin directly—use it to plan, not to deploy.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/profile?panel=moderation"
              className="rounded-full border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:text-rose-900"
            >
              Open queues
            </Link>
            <Link
              href="/profile?panel=submissions"
              className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700"
            >
              Review submissions
            </Link>
          </div>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {checklist.map((item) => (
            <div key={item.label} className="rounded-2xl border border-rose-100 bg-rose-50/60 p-4">
              <p className="text-xs uppercase tracking-wide text-rose-400">{item.label}</p>
              <div className="mt-2 flex items-center justify-between text-sm text-rose-900">
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${item.tone}`}>{item.status}</span>
                <span>{item.percent}%</span>
              </div>
              <div className="mt-3 h-2 rounded-full bg-rose-100">
                <span
                  className="block h-full rounded-full bg-gradient-to-r from-rose-400 to-rose-600"
                  style={{ width: `${item.percent}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-rose-100 bg-white/95 p-8 shadow-lg">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-rose-400">Shortcuts</p>
            <p className="text-sm text-rose-500">Hop to the control surfaces you need most often.</p>
          </div>
          <span className="ml-auto rounded-full border border-rose-100 px-3 py-1 text-xs text-rose-400">Signed in as {user.display_name || user.username}</span>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {quickDestinations.map((destination) => (
            <Link
              key={destination.label}
              href={destination.href}
              className="flex h-full flex-col rounded-2xl border border-rose-100 bg-rose-50/60 p-4 transition hover:-translate-y-1 hover:border-rose-200 hover:bg-white"
            >
              <p className="text-sm font-semibold text-rose-900">{destination.label}</p>
              <p className="mt-2 flex-1 text-xs text-rose-500">{destination.description}</p>
              <span className="mt-4 text-xs font-semibold text-rose-400">Open</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-rose-100 bg-white/95 p-8 shadow-lg">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-rose-400">Roadmap calls</p>
            <p className="text-sm text-rose-500">Context for the next leadership sync.</p>
          </div>
          <Link href="/profile?panel=activity" className="ml-auto rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-700">
            View activity feed
          </Link>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {roadmapCalls.map((callout) => (
            <div key={callout.title} className="rounded-2xl border border-rose-100 bg-white p-4 shadow-inner">
              <p className="text-sm font-semibold text-rose-900">{callout.title}</p>
              <p className="text-xs uppercase tracking-wide text-rose-400">{callout.meta}</p>
              <p className="mt-3 text-sm text-rose-500">{callout.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-rose-100 bg-white/95 p-8 shadow-lg">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-rose-400">Operational checklist</p>
            <p className="text-sm text-rose-500">Flag key actions before shipping the next drop.</p>
          </div>
          <Link href="/profile?panel=submissions" className="ml-auto rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-700">
            Assign owners
          </Link>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {["Backlog grooming", "Escalation log", "Creator outreach", "Release notes"].map((item) => (
            <div key={item} className="rounded-2xl border border-rose-100 bg-rose-50/60 p-4">
              <div className="flex items-center justify-between text-sm font-semibold text-rose-900">
                <span>{item}</span>
                <span className="text-xs text-rose-400">Drafting</span>
              </div>
              <p className="mt-2 text-xs text-rose-500">Capture decisions here so the rest of the team is never blocked.</p>
              <button className="mt-3 rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-700 transition hover:border-rose-300 hover:text-rose-900">
                Mark as noted
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
