import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  getPublicUserProfile,
  listUserReviews,
  listUserSubmissions,
  type ItemReview,
  type PublicUserProfile,
  type SubmissionSummary,
} from "@/lib/api";

type PublicProfilePageProps = {
  params: Promise<{ username: string }>;
};

function formatDate(value: string): string {
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return value;
  }
}

function normalizeExternalUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return trimmed;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

function formatWebsiteLabel(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return trimmed;
  }
  const normalized = normalizeExternalUrl(trimmed);
  try {
    const url = new URL(normalized);
    const host = url.host.replace(/^www\./i, "");
    const path = url.pathname && url.pathname !== "/" ? url.pathname : "";
    return `${host}${path}`;
  } catch {
    return trimmed;
  }
}

export default async function PublicProfilePage({ params }: PublicProfilePageProps) {
  const { username } = await params;

  let profile: PublicUserProfile;
  let submissions: SubmissionSummary[];
  let reviews: ItemReview[];

  try {
    [profile, submissions, reviews] = await Promise.all([
      getPublicUserProfile(username),
      listUserSubmissions(username, 50),
      listUserReviews(username, 50),
    ]);
  } catch {
    notFound();
  }

  const showClosetCard = Boolean(profile.share_owned_public || profile.share_wishlist_public);

  const profileCards = [
    { label: "Submissions", helper: "Stats appear after your first submission." },
    { label: "Reviews", helper: "Track pending and approved reviews." },
  ] as const;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      <div className="rounded-3xl border border-rose-100 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative h-16 w-16 overflow-hidden rounded-2xl border border-rose-100 bg-rose-50">
            {profile.avatar_url ? (
              <Image src={profile.avatar_url} alt="Avatar" fill sizes="64px" className="object-cover" />
            ) : null}
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-rose-900">{profile.display_name}</h1>
            <p className="mt-1 text-sm text-rose-500">
              @{profile.username}
              {profile.pronouns ? <span className="ml-2">• {profile.pronouns}</span> : null}
            </p>
            {profile.bio ? (
              <p className="mt-3 text-sm text-slate-700">
                <span className="font-semibold text-rose-900">Bio:</span> {profile.bio}
              </p>
            ) : null}
            {profile.location ? (
              <p className="mt-2 text-sm text-rose-500">
                <span className="font-semibold text-rose-700">Location:</span> {profile.location}
              </p>
            ) : null}
            {profile.website ? (
              <p className="mt-2 text-sm text-rose-500">
                <span className="font-semibold text-rose-700">Website or socials:</span>{" "}
                <a
                  href={normalizeExternalUrl(profile.website)}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-rose-700 hover:text-rose-900"
                >
                  {formatWebsiteLabel(profile.website)}
                </a>
              </p>
            ) : null}
          </div>
          <Link
            href="/search"
            className="ml-auto rounded-full border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:text-rose-900"
          >
            Browse catalog
          </Link>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {profileCards.map((card) => (
          <div key={card.label} className="rounded-2xl border border-rose-100 bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-rose-400">{card.label}</p>
            <p className="text-2xl font-semibold text-rose-900">-</p>
            <p className="text-xs text-rose-400">{card.helper}</p>
          </div>
        ))}
        <div className="rounded-2xl border border-rose-100 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-rose-400">Closet</p>
          <p className="text-2xl font-semibold text-rose-900">-</p>
          {showClosetCard ? (
            <p className="text-xs text-rose-400">Wardrobe + wishlist now live on the Closet page.</p>
          ) : null}
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border border-rose-100 bg-white p-6">
          <h2 className="text-lg font-semibold text-rose-900">Submissions</h2>
          <p className="mt-2 text-sm text-rose-500">Approved catalog submissions by this user.</p>

          {submissions.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-rose-200 bg-rose-50/60 p-4 text-sm text-rose-500">
              No approved submissions yet.
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {submissions.map((submission) => {
                const linkedSlug = submission.linked_item || submission.item_slug;
                return (
                  <div key={submission.id} className="rounded-2xl border border-rose-100 bg-white/70 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      {linkedSlug ? (
                        <Link
                          href={`/items/${encodeURIComponent(linkedSlug)}`}
                          className="text-sm font-semibold text-rose-900 hover:underline"
                        >
                          {submission.title}
                        </Link>
                      ) : (
                        <span className="text-sm font-semibold text-rose-900">{submission.title}</span>
                      )}
                      <span className="ml-auto text-xs text-rose-400">{formatDate(submission.updated_at)}</span>
                    </div>
                    <p className="mt-2 text-sm text-rose-700">{submission.brand_name}</p>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-rose-100 bg-white p-6">
          <h2 className="text-lg font-semibold text-rose-900">Reviews</h2>
          <p className="mt-2 text-sm text-rose-500">Approved reviews by this user.</p>

          {reviews.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-rose-200 bg-rose-50/60 p-4 text-sm text-rose-500">
              No approved reviews yet.
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {reviews.map((review) => (
                <div key={review.id} className="rounded-2xl border border-rose-100 bg-white/70 p-4">
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
                    <span className="ml-auto text-xs text-rose-400">{formatDate(review.created_at)}</span>
                  </div>
                  {review.body ? <p className="mt-2 text-sm text-slate-700">{review.body}</p> : null}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
