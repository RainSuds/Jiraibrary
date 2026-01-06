"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { useFlash } from "@/components/flash-provider";
import { type ItemReview, listMyReviews } from "@/lib/api";

type ReviewStatusFilter = "all" | "pending" | "approved" | "rejected";

type PreviewState = {
  open: boolean;
  images: { id: string; url: string }[];
  index: number;
};

function formatRecommendation(value: ItemReview["recommendation"]): string {
  switch (value) {
    case "recommend":
      return "Recommend";
    case "not_recommend":
      return "Not recommend";
    default:
      return "Mixed";
  }
}

function formatReviewDate(value: string): string {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export default function ProfileReviewsPage() {
  const { user, token, loading } = useAuth();
  const { addFlash } = useFlash();

  const [status, setStatus] = useState<ReviewStatusFilter>("all");
  const [reviews, setReviews] = useState<ItemReview[]>([]);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState>({ open: false, images: [], index: 0 });

  const previewImage = preview.open ? preview.images[preview.index] : undefined;

  const statusLabel = useMemo(() => {
    switch (status) {
      case "pending":
        return "Pending";
      case "approved":
        return "Approved";
      case "rejected":
        return "Rejected";
      default:
        return "All";
    }
  }, [status]);

  useEffect(() => {
    if (!token || !user) {
      return;
    }
    let cancelled = false;
    setError(null);
    setFetching(true);

    void (async () => {
      try {
        const data = await listMyReviews(token, { status });
        if (!cancelled) {
          setReviews(data);
        }
      } catch (err) {
        console.error("Failed to load user reviews", err);
        if (!cancelled) {
          setError("Unable to load your reviews right now.");
          setReviews([]);
        }
      } finally {
        if (!cancelled) {
          setFetching(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status, token, user]);

  useEffect(() => {
    if (!preview.open) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPreview({ open: false, images: [], index: 0 });
        return;
      }
      if (event.key === "ArrowRight") {
        setPreview((prev) => {
          if (!prev.open || prev.images.length === 0) {
            return prev;
          }
          return { ...prev, index: (prev.index + 1) % prev.images.length };
        });
        return;
      }
      if (event.key === "ArrowLeft") {
        setPreview((prev) => {
          if (!prev.open || prev.images.length === 0) {
            return prev;
          }
          return { ...prev, index: (prev.index - 1 + prev.images.length) % prev.images.length };
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [preview.open]);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-3xl rounded-3xl border border-rose-100 bg-white/90 p-8 shadow-lg">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-1/3 rounded-full bg-rose-100" />
          <div className="h-4 w-2/3 rounded-full bg-rose-50" />
        </div>
      </div>
    );
  }

  if (!user || !token) {
    return (
      <div className="mx-auto w-full max-w-md rounded-3xl border border-rose-100 bg-white/90 p-8 text-center shadow-lg">
        <p className="text-sm font-medium text-rose-600">Sign in to view your reviews.</p>
        <Link
          href="/login"
          className="mt-4 inline-flex rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700"
        >
          Go to login
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div className="rounded-3xl border border-rose-100 bg-white/90 p-6 shadow-lg">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-rose-900">My Reviews</h1>
            <p className="mt-1 text-sm text-rose-500">See pending reviews and your submission history.</p>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-3">
            <Link
              href="/profile"
              className="rounded-full border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:text-rose-900"
            >
              Back to profile
            </Link>
            <label className="flex items-center gap-2 rounded-full border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-700">
              <span className="text-rose-500">Filter</span>
              <select
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value as ReviewStatusFilter);
                }}
                className="bg-transparent text-rose-900 focus:outline-none"
              >
                <option value="all">All</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </label>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-rose-100 bg-white p-6">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold text-rose-900">{statusLabel} reviews</h2>
          {fetching ? <span className="text-sm text-rose-500">Loading…</span> : null}
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50/60 p-4 text-sm text-rose-700">
            {error}
            <button
              type="button"
              onClick={() => {
                addFlash({ kind: "error", title: "Load failed", message: error });
              }}
              className="mt-2 block text-xs font-semibold text-rose-700 underline"
            >
              Show details
            </button>
          </div>
        ) : reviews.length === 0 && !fetching ? (
          <div className="mt-4 rounded-2xl border border-dashed border-rose-200 bg-rose-50/60 p-5 text-sm text-rose-500">
            No reviews found for this filter.
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {reviews.map((review) => (
              <article key={review.id} className="rounded-3xl border border-rose-100 bg-white/80 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  {review.item_slug ? (
                    <Link
                      href={`/items/${encodeURIComponent(review.item_slug)}`}
                      className="text-sm font-semibold text-rose-900 hover:underline"
                    >
                      {review.item_name || review.item_slug}
                    </Link>
                  ) : (
                    <span className="text-sm font-semibold text-rose-900">{review.item_name || "Item"}</span>
                  )}
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                    {formatRecommendation(review.recommendation)}
                  </span>
                  <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700">
                    {review.status}
                  </span>
                  <span className="ml-auto text-xs text-rose-400">{formatReviewDate(review.created_at)}</span>
                </div>

                {review.body ? <p className="mt-3 text-sm text-rose-700">{review.body}</p> : null}

                {review.moderated_at || (review.moderation_note && review.moderation_note.trim().length > 0) ? (
                  <div className="mt-4 rounded-2xl border border-rose-100 bg-rose-50/60 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-rose-500">Moderation</p>
                    {review.moderated_at ? (
                      <p className="mt-1 text-sm text-rose-700">Reviewed: {formatReviewDate(review.moderated_at)}</p>
                    ) : null}
                    {review.moderation_note && review.moderation_note.trim().length > 0 ? (
                      <p className="mt-2 text-sm text-rose-700">{review.moderation_note}</p>
                    ) : null}
                  </div>
                ) : null}

                {review.images?.length ? (
                  <div className="mt-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-rose-500">Photos</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {review.images.map((image, index) => (
                        <button
                          key={image.id}
                          type="button"
                          onClick={() => {
                            setPreview({
                              open: true,
                              images: review.images.map((entry) => ({ id: entry.id, url: entry.url })),
                              index,
                            });
                          }}
                          className="relative h-16 w-16 overflow-hidden rounded-2xl border border-rose-100 bg-white hover:border-rose-200"
                          aria-label="Preview image"
                        >
                          <img src={image.url} alt="Review photo" className="h-full w-full object-cover" />
                        </button>
                      ))}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-3">
                      {review.item_slug ? (
                        <Link
                          href={`/items/${encodeURIComponent(review.item_slug)}`}
                          className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700"
                        >
                          Open catalog page
                        </Link>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </div>

      {preview.open && previewImage ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4"
          onClick={() => {
            setPreview({ open: false, images: [], index: 0 });
          }}
        >
          <div
            className="w-full max-w-4xl rounded-3xl border border-rose-100 bg-white p-4"
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-rose-900">
                Image {preview.index + 1} of {preview.images.length}
              </p>
              <a
                href={previewImage.url}
                target="_blank"
                rel="noreferrer"
                className="ml-auto rounded-full border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:text-rose-900"
              >
                Open in new tab
              </a>
              <button
                type="button"
                onClick={() => {
                  setPreview({ open: false, images: [], index: 0 });
                }}
                className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700"
              >
                Close
              </button>
            </div>

            <div className="mt-4 overflow-hidden rounded-2xl border border-rose-100 bg-rose-50/30">
              <img src={previewImage.url} alt="Review photo preview" className="max-h-[75vh] w-full object-contain" />
            </div>

            {preview.images.length > 1 ? (
              <div className="mt-4 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setPreview((prev) => ({
                      ...prev,
                      index: (prev.index - 1 + prev.images.length) % prev.images.length,
                    }));
                  }}
                  className="rounded-full border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:text-rose-900"
                >
                  Prev
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPreview((prev) => ({
                      ...prev,
                      index: (prev.index + 1) % prev.images.length,
                    }));
                  }}
                  className="rounded-full border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:text-rose-900"
                >
                  Next
                </button>
                <p className="ml-auto text-xs text-rose-400">Tip: use arrow keys to navigate, Esc to close.</p>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
