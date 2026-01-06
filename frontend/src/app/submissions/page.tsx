"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { deleteSubmissionDraft, listMySubmissions, type SubmissionSummary } from "@/lib/api";

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "draft", label: "Drafts" },
  { value: "pending_review", label: "Pending review" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
];

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  pending_review: "Pending review",
  published: "Published",
  archived: "Archived",
};

const STATUS_BADGE_CLASSES: Record<string, string> = {
  draft: "border-rose-200 text-rose-600",
  pending_review: "border-amber-200 text-amber-600",
  published: "border-emerald-200 text-emerald-700",
  archived: "border-slate-200 text-slate-600",
};

export default function SubmissionsPage() {
  const router = useRouter();
  const { user, loading, token } = useAuth();
  const [submissions, setSubmissions] = useState<SubmissionSummary[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [submissionsError, setSubmissionsError] = useState<string | null>(null);
  const [submissionActionError, setSubmissionActionError] = useState<string | null>(null);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    if (!loading && !user) {
      router.replace(`/login?next=${encodeURIComponent("/submissions")}`);
    }
  }, [loading, router, user]);

  useEffect(() => {
    if (loading || !user || !token) {
      return;
    }

    let cancelled = false;
    const fetchSubmissions = async () => {
      setSubmissionsLoading(true);
      setSubmissionsError(null);
      setSubmissionActionError(null);
      try {
        const data = await listMySubmissions(token);
        if (!cancelled) {
          setSubmissions(data);
        }
      } catch {
        if (!cancelled) {
          setSubmissionsError("Unable to load submissions right now. Please try again.");
        }
      } finally {
        if (!cancelled) {
          setSubmissionsLoading(false);
        }
      }
    };

    fetchSubmissions();

    return () => {
      cancelled = true;
    };
  }, [loading, token, user]);

  const handleDeleteDraft = useCallback(
    async (draftId: string) => {
      if (!token) {
        return;
      }
      setSubmissionActionError(null);
      setPendingDeleteIds((current) => ({ ...current, [draftId]: true }));
      try {
        await deleteSubmissionDraft(token, draftId);
        setSubmissions((current) => current.filter((submission) => submission.id !== draftId));
      } catch {
        setSubmissionActionError("Unable to delete that draft. Please try again.");
      } finally {
        setPendingDeleteIds((current) => {
          const next = { ...current };
          delete next[draftId];
          return next;
        });
      }
    },
    [token]
  );

  const filteredSubmissions = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return submissions.filter((submission) => {
      const matchesStatus = statusFilter === "all" ? true : submission.status === statusFilter;
      if (!matchesStatus) {
        return false;
      }
      if (!normalizedQuery) {
        return true;
      }
      const searchable = `${submission.title ?? ""} ${submission.brand_name ?? ""}`.toLowerCase();
      return searchable.includes(normalizedQuery);
    });
  }, [searchQuery, statusFilter, submissions]);

  const hasAppliedFilters = statusFilter !== "all" || searchQuery.trim().length > 0;

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-4xl rounded-3xl border border-rose-100 bg-white/90 p-8 shadow-lg">
        <div className="space-y-4">
          <div className="h-6 w-1/3 animate-pulse rounded-full bg-rose-100" />
          <div className="h-5 w-1/2 animate-pulse rounded-full bg-rose-50" />
          <div className="h-5 w-2/3 animate-pulse rounded-full bg-rose-50" />
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

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
      <header className="rounded-3xl border border-rose-100 bg-white/90 p-8 shadow-lg">
        <div className="space-y-3">
          <span className="text-sm font-semibold uppercase tracking-[0.3em] text-rose-500">Submissions</span>
          <h1 className="text-3xl font-semibold text-rose-900">Your catalog contributions</h1>
          <p className="text-sm text-rose-500">
            Track drafts, pending reviews, and approved entries in one place. Start a new submission whenever you
            discover a piece worth sharing with the community.
          </p>
        </div>
        <div className="mt-6 flex flex-wrap gap-4">
          <Link
            href="/add-entry"
            className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700"
          >
            Submit a new entry
          </Link>
          <Link
            href="/profile"
            className="rounded-full border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-600 transition hover:border-rose-300 hover:text-rose-700"
          >
            Back to profile
          </Link>
        </div>
      </header>

      <section className="rounded-3xl border border-rose-100 bg-white/95 p-8 shadow-lg">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold text-rose-900">Submission history</h2>
          <p className="text-sm text-rose-500">Search past entries or narrow the list by review status.</p>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,200px)]">
          <label className="flex flex-col gap-2 text-sm font-medium text-rose-600">
            <span>Search by title or brand</span>
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="e.g. Dior Saddle"
              className="rounded-2xl border border-rose-100 px-4 py-2 text-sm font-normal text-rose-900 outline-none transition focus:border-rose-300 focus:ring-2 focus:ring-rose-100"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium text-rose-600">
            <span>Status filter</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-2xl border border-rose-100 px-4 py-2 text-sm font-normal text-rose-900 outline-none transition focus:border-rose-300 focus:ring-2 focus:ring-rose-100"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {submissionActionError ? (
          <p className="mt-4 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
            {submissionActionError}
          </p>
        ) : null}

        {submissionsLoading ? (
          <div className="mt-6 space-y-4">
            {[0, 1, 2].map((key) => (
              <div key={key} className="rounded-2xl border border-rose-100 bg-rose-50/30 p-4">
                <div className="h-5 w-1/3 animate-pulse rounded-full bg-rose-100" />
                <div className="mt-3 h-4 w-2/3 animate-pulse rounded-full bg-rose-50" />
              </div>
            ))}
          </div>
        ) : submissionsError ? (
          <p className="mt-4 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
            {submissionsError}
          </p>
        ) : filteredSubmissions.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-rose-100 bg-rose-50/40 p-6 text-sm text-rose-500">
            {hasAppliedFilters ? (
              <p>No submissions match your search. Try clearing or changing the filters.</p>
            ) : (
              <p>You haven’t submitted anything yet. Start a new entry to see it appear here.</p>
            )}
          </div>
        ) : (
          <ul className="mt-6 space-y-4">
            {filteredSubmissions.map((submission) => {
              const badgeClass = STATUS_BADGE_CLASSES[submission.status] ?? "border-rose-200 text-rose-600";
              const friendlyStatus = STATUS_LABELS[submission.status] ?? submission.status;
              return (
                <li key={submission.id} className="rounded-2xl border border-rose-100 bg-rose-50/60 p-5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-lg font-semibold text-rose-900">{submission.title || "Untitled entry"}</p>
                      <p className="text-sm text-rose-500">
                        {submission.brand_name || "Unknown brand"} · Last updated {new Date(submission.updated_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${badgeClass}`}
                      >
                        {friendlyStatus}
                      </span>
                      {submission.status === "draft" ? (
                        <>
                          <Link
                            href={`/add-entry?draft=${submission.id}`}
                            className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700"
                          >
                            Continue editing
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleDeleteDraft(submission.id)}
                            disabled={Boolean(pendingDeleteIds[submission.id])}
                            className="rounded-full border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-600 transition hover:border-rose-300 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {pendingDeleteIds[submission.id] ? "Deleting…" : "Delete draft"}
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
