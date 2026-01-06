"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { useFlash } from "@/components/flash-provider";
import { type ItemReview, listMyReviews, uploadAvatar } from "@/lib/api";
import { resolveMediaUrl } from "@/lib/media";

type ProfileTab = {
  id: string;
  label: string;
  description: string;
};

export default function ProfilePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, token, loading, logout, updatePreferences, deleteAccount, updateProfile, refresh } = useAuth();
  const { addFlash } = useFlash();
  const defaultTabId = "activity";

  const [shareSettings, setShareSettings] = useState(() => ({
    owned: Boolean(user?.share_owned_public),
    wishlist: Boolean(user?.share_wishlist_public),
  }));
  const [shareSaving, setShareSaving] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [profileUsername, setProfileUsername] = useState("");
  const [profileDisplayName, setProfileDisplayName] = useState("");
  const [profileBio, setProfileBio] = useState("");
  const [profileWebsite, setProfileWebsite] = useState("");
  const [pronounsPreset, setPronounsPreset] = useState<"" | "She / Her" | "He / Him" | "They / Them" | "__custom__">("");
  const [pronounsCustom, setPronounsCustom] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<"owned" | "wishlist" | null>(null);
  const [shareOrigin, setShareOrigin] = useState("");
  const [recentReviews, setRecentReviews] = useState<ItemReview[] | null>(null);
  const [recentReviewsLoading, setRecentReviewsLoading] = useState(false);
  const [recentReviewsError, setRecentReviewsError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      return;
    }
    setProfileUsername(user.username);
    setProfileDisplayName(user.display_name || "");
    setProfileBio(user.bio || "");
    setProfileWebsite(user.website || "");

    const rawPronouns = (user.pronouns || "").trim();
    if (rawPronouns === "" || rawPronouns === "She / Her" || rawPronouns === "He / Him" || rawPronouns === "They / Them") {
      setPronounsPreset(rawPronouns as "" | "She / Her" | "He / Him" | "They / Them");
      setPronounsCustom("");
    } else {
      setPronounsPreset("__custom__");
      setPronounsCustom(rawPronouns);
    }
    setShareSettings({
      owned: Boolean(user.share_owned_public),
      wishlist: Boolean(user.share_wishlist_public),
    });
  }, [user]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    setShareOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (!token || !user) {
      return;
    }
    let cancelled = false;
    setRecentReviewsError(null);
    setRecentReviewsLoading(true);
    void (async () => {
      try {
        const reviews = await listMyReviews(token, { limit: 3, status: "all" });
        if (!cancelled) {
          setRecentReviews(reviews);
        }
      } catch (error) {
        console.error("Failed to load recent reviews", error);
        if (!cancelled) {
          setRecentReviewsError("Unable to load your reviews right now.");
          setRecentReviews(null);
        }
      } finally {
        if (!cancelled) {
          setRecentReviewsLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, user]);

  useEffect(() => {
    if (!copyFeedback) {
      return;
    }
    const timeout = window.setTimeout(() => setCopyFeedback(null), 2000);
    return () => window.clearTimeout(timeout);
  }, [copyFeedback]);

  const roleName = user?.role?.name?.toLowerCase() ?? "user";
  const isAdmin = Boolean(user?.is_superuser || roleName === "admin");
  const isModerator = Boolean(user?.is_staff || isAdmin || roleName === "moderator");

  const availableTabs = useMemo<ProfileTab[]>(() => {
    const tabs: ProfileTab[] = [
      { id: "activity", label: "My Activity", description: "Recent comments & timeline" },
      { id: "submissions", label: "My Submissions", description: "Drafts and published entries" },
      { id: "profile", label: "Edit Profile", description: "Avatar, bio, and socials" },
      { id: "account", label: "Account Settings", description: "Preferences & access" },
    ];
    if (isModerator) {
      tabs.push({ id: "moderation", label: "Moderation", description: "Queues that need review" });
    }
    if (isAdmin) {
      tabs.push({ id: "admin", label: "Admin Panel", description: "People & platform settings" });
    }
    return tabs;
  }, [isAdmin, isModerator]);

  const shareOwnedUrl = useMemo(() => {
    if (!user || !shareOrigin) {
      return "";
    }
    return `${shareOrigin}/closet?tab=owned&user=${encodeURIComponent(user.username)}`;
  }, [shareOrigin, user]);

  const shareWishlistUrl = useMemo(() => {
    if (!user || !shareOrigin) {
      return "";
    }
    return `${shareOrigin}/closet?tab=wishlist&user=${encodeURIComponent(user.username)}`;
  }, [shareOrigin, user]);

  const handleShareToggle = useCallback(
    async (field: "owned" | "wishlist", nextValue: boolean) => {
      if (!user) {
        return;
      }
      const previousValue = field === "owned" ? shareSettings.owned : shareSettings.wishlist;
      if (previousValue === nextValue) {
        return;
      }
      setShareError(null);
      setShareSettings((prev) => ({ ...prev, [field]: nextValue }));
      setShareSaving(true);
      try {
        const payload = field === "owned" ? { share_owned_public: nextValue } : { share_wishlist_public: nextValue };
        await updatePreferences(payload);
        addFlash({
          kind: "success",
          title: "Settings saved",
          message: `Sharing ${field === "owned" ? "owned" : "wishlist"} items is now ${nextValue ? "enabled" : "disabled"}.`,
          timeoutMs: 1800,
        });
      } catch (error) {
        console.error("Failed to update sharing preference", error);
        setShareError("Unable to update sharing preference. Try again in a moment.");
        const message = error instanceof Error ? error.message : "Unable to update sharing preference.";
        addFlash({ kind: "error", title: "Save failed", message });
        setShareSettings((prev) => ({ ...prev, [field]: previousValue }));
      } finally {
        setShareSaving(false);
      }
    },
    [addFlash, shareSettings, updatePreferences, user],
  );

  const handleShareCopy = useCallback(
    async (field: "owned" | "wishlist") => {
      const target = field === "owned" ? shareOwnedUrl : shareWishlistUrl;
      if (!target) {
        return;
      }
      setShareError(null);
      try {
        if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(target);
        } else {
          const textarea = document.createElement("textarea");
          textarea.value = target;
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand("copy");
          document.body.removeChild(textarea);
        }
        setCopyFeedback(field);
        addFlash({ kind: "success", title: "Copied", message: "Share link copied to clipboard.", timeoutMs: 1500 });
      } catch (error) {
        console.error("Failed to copy share link", error);
        setShareError("Unable to copy link automatically. Please copy it manually.");
        addFlash({ kind: "error", title: "Copy failed", message: "Unable to copy link automatically. Please copy it manually." });
      }
    },
    [addFlash, shareOwnedUrl, shareWishlistUrl],
  );

  const selectTab = useCallback(
    (tabId: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (tabId === defaultTabId) {
        params.delete("panel");
      } else {
        params.set("panel", tabId);
      }
      const query = params.toString();
      router.replace(`/profile${query ? `?${query}` : ""}`, { scroll: false });
    },
    [defaultTabId, router, searchParams],
  );

  const panelParam = searchParams.get("panel");
  const fallbackTabId = availableTabs[0]?.id ?? defaultTabId;
  const activeTab = panelParam && availableTabs.some((tab) => tab.id === panelParam) ? panelParam : fallbackTabId;

  useEffect(() => {
    if (!panelParam) {
      return;
    }
    const exists = availableTabs.some((tab) => tab.id === panelParam);
    if (!exists && fallbackTabId) {
      selectTab(fallbackTabId);
    }
  }, [availableTabs, fallbackTabId, panelParam, selectTab]);

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

  const roleBadgeKey = isAdmin ? "admin" : isModerator ? "moderator" : "user";
  const roleBadgeClass = {
    user: "bg-slate-200 text-slate-700",
    moderator: "bg-purple-100 text-purple-700",
    admin: "bg-rose-600 text-white",
  }[roleBadgeKey];
  const roleBadgeLabel = isAdmin ? "ADMIN" : isModerator ? "MODERATOR" : (roleName || "user").toUpperCase();

  const joinedDisplay = user.is_staff || user.is_superuser ? "Core team" : "Community member";
  const handleLogout = async () => {
    await logout();
    addFlash({ kind: "success", title: "Signed out", message: "You have been signed out.", timeoutMs: 1500 });
    router.push("/");
  };

  const handleSaveProfile = async () => {
    if (!user || profileSaving) {
      return;
    }

    const normalizedUsername = profileUsername.trim().replace(/^@+/, "");
    const normalizedDisplayName = profileDisplayName.trim();
    const normalizedPronouns = (
      pronounsPreset === "__custom__" ? pronounsCustom.trim() : (pronounsPreset || "").trim()
    ).trim();
    const normalizedBio = profileBio.trim();
    const normalizedWebsite = profileWebsite.trim();

    setProfileError(null);
    setProfileSaving(true);
    try {
      await updateProfile({
        username: normalizedUsername,
        displayName: normalizedDisplayName,
        pronouns: normalizedPronouns,
        bio: normalizedBio,
        website: normalizedWebsite,
      });
      addFlash({ kind: "success", title: "Profile updated", message: "Your profile changes have been saved.", timeoutMs: 2000 });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save profile.";
      setProfileError(message);
      const isCooldown = typeof error === "object" && error !== null && "status" in error && (error as { status?: unknown }).status === 429;
      addFlash({ kind: isCooldown ? "warning" : "error", title: isCooldown ? "Username cooldown" : "Save failed", message });
    } finally {
      setProfileSaving(false);
    }
  };

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!file) {
      return;
    }
    if (!token) {
      addFlash({ kind: "error", title: "Upload failed", message: "Login is required before uploading an avatar." });
      return;
    }
    if (!file.type.startsWith("image/")) {
      addFlash({ kind: "error", title: "Upload failed", message: "Please choose an image file." });
      return;
    }

    setAvatarUploading(true);
    try {
      await uploadAvatar(token, file);
      await refresh();
      addFlash({ kind: "success", title: "Avatar updated", message: "Your profile photo has been updated.", timeoutMs: 2000 });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to upload avatar.";
      addFlash({ kind: "error", title: "Upload failed", message });
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteSaving) {
      return;
    }

    setDeleteError(null);

    const confirmed = typeof window !== "undefined" ? window.confirm("Delete your Jiraibrary account permanently? This cannot be undone.") : false;
    if (!confirmed) {
      return;
    }

    setDeleteSaving(true);
    try {
      await deleteAccount();
      addFlash({
        kind: "warning",
        title: "Account deleted",
        message: "Your account has been deleted. We're sorry to see you go.",
        timeoutMs: 3500,
      });
      router.push("/");
    } catch (error) {
      console.error("Failed to delete account", error);
      setDeleteError("Unable to delete your account right now. Please try again.");
      const message = error instanceof Error ? error.message : "Unable to delete your account right now.";
      addFlash({ kind: "error", title: "Delete failed", message });
    } finally {
      setDeleteSaving(false);
    }
  };

  const contributionStats = [
    { label: "Submissions", helper: "Stats appear after your first submission." },
    { label: "Reviews", helper: "Track pending and approved reviews." },
    { label: "Closet", helper: "Wardrobe + wishlist now live on the Closet page." },
  ] as const;

  const usesGoogleAuth = user.auth_provider === "google";

  const renderActivePanel = () => {
    switch (activeTab) {
      case "activity":
        return (
          <div className="space-y-6">
            <section className="rounded-3xl border border-rose-100 bg-white p-5">
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-lg font-semibold text-rose-900">My Reviews</h3>
                <Link
                  href="/profile/reviews"
                  className="ml-auto rounded-full border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:text-rose-900"
                >
                  View all
                </Link>
              </div>
              <p className="mt-2 text-sm text-rose-500">Track pending reviews and what you&apos;ve submitted.</p>
              {recentReviewsError ? <p className="mt-3 text-sm text-rose-600">{recentReviewsError}</p> : null}
              {recentReviewsLoading ? (
                <div className="mt-4 rounded-2xl border border-dashed border-rose-200 bg-rose-50/60 p-4 text-sm text-rose-500">
                  Loading your reviews...
                </div>
              ) : recentReviews && recentReviews.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {recentReviews.map((review) => (
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
                        <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700">
                          {review.status}
                        </span>
                        <span className="ml-auto text-xs text-rose-400">
                          {new Date(review.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      {review.body ? <p className="mt-2 text-sm text-rose-700">{review.body}</p> : null}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-dashed border-rose-200 bg-rose-50/60 p-4 text-sm text-rose-500">
                  You haven&apos;t submitted any reviews yet.
                </div>
              )}
            </section>
            <section className="rounded-3xl border border-rose-100 bg-white p-5">
              <h3 className="text-lg font-semibold text-rose-900">Comments</h3>
              <p className="mt-2 text-sm text-rose-500">
                Catalog conversations will appear once the comment service is wired into the profile view.
              </p>
              <div className="mt-4 rounded-2xl border border-dashed border-rose-200 bg-rose-50/60 p-4 text-sm text-rose-500">
                Reply on any item to start your timeline. We&apos;ll surface highlights here soon.
              </div>
            </section>
            <section className="rounded-3xl border border-rose-100 bg-white p-5">
              <h3 className="text-lg font-semibold text-rose-900">Signals</h3>
              <p className="mt-2 text-sm text-rose-500">
                Mentions, follows, and favorites will land here. For wardrobe + wishlist data use the new Closet hub.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href="/closet"
                  className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700"
                >
                  Open Closet
                </Link>
                <Link
                  href="/search"
                  className="rounded-full border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:text-rose-900"
                >
                  Browse catalog
                </Link>
              </div>
            </section>
          </div>
        );
      case "submissions":
        return (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-4">
              <h3 className="text-xl font-semibold text-rose-900">Contribution timeline</h3>
              <Link
                href="/add-entry"
                className="ml-auto rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700"
              >
                Submit new item
              </Link>
            </div>
            <div className="rounded-3xl border border-dashed border-rose-200 bg-white/70 p-6 text-sm text-rose-500">
              Drafts and approvals will display here once the submissions API is connected. Until then, keep sharing finds from the catalog.
            </div>
          </div>
        );
      case "profile":
        return (
          <div className="space-y-6">
            <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
              <div className="rounded-3xl border border-rose-100 bg-white p-5">
                <p className="text-xs uppercase tracking-wide text-rose-400">Username</p>
                <div className="mt-2 flex items-center gap-2 rounded-2xl border border-rose-200 px-4 py-2">
                  <span className="text-sm font-semibold text-rose-400">@</span>
                  <input
                    type="text"
                    value={profileUsername}
                    onChange={(event) => setProfileUsername(event.target.value)}
                    className="w-full bg-transparent text-sm text-rose-900 focus:outline-none"
                    inputMode="text"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                </div>
                <p className="mt-2 text-xs text-rose-400">Username must be unique. You can change it once every 30 days.</p>
                <p className="text-xs uppercase tracking-wide text-rose-400">Display name</p>
                <input
                  type="text"
                  value={profileDisplayName}
                  onChange={(event) => setProfileDisplayName(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-rose-200 px-4 py-2 text-sm focus:border-rose-400 focus:outline-none"
                />
                <p className="mt-2 text-xs text-rose-400">Display names can include spaces and don&apos;t have to be unique.</p>
                <p className="mt-4 text-xs uppercase tracking-wide text-rose-400">Bio</p>
                <textarea
                  rows={4}
                  value={profileBio}
                  onChange={(event) => setProfileBio(event.target.value)}
                  placeholder="Share inspirations, favorite brands, or wardrobe focus."
                  className="mt-2 w-full rounded-2xl border border-rose-200 px-4 py-2 text-sm focus:border-rose-400 focus:outline-none"
                />
                <p className="mt-4 text-xs uppercase tracking-wide text-rose-400">Website or socials</p>
                <input
                  type="url"
                  value={profileWebsite}
                  onChange={(event) => setProfileWebsite(event.target.value)}
                  placeholder="https://"
                  className="mt-2 w-full rounded-2xl border border-rose-200 px-4 py-2 text-sm focus:border-rose-400 focus:outline-none"
                />
              </div>
              <div className="rounded-3xl border border-rose-100 bg-white p-5">
                <p className="text-xs uppercase tracking-wide text-rose-400">Avatar</p>
                <div className="mt-3 flex flex-col items-center gap-3">
                  <div className="relative h-24 w-24 overflow-hidden rounded-full border border-rose-100 bg-rose-50">
                    {user.avatar_url ? (
                      <Image
                        src={resolveMediaUrl(user.avatar_url) ?? user.avatar_url}
                        alt="Profile photo"
                        fill
                        sizes="96px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-3xl font-semibold text-rose-500">
                        {(user.display_name || user.username).charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <label className="rounded-full border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:text-rose-900">
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(event) => {
                        void handleAvatarChange(event);
                      }}
                      disabled={avatarUploading}
                    />
                    {avatarUploading ? "Uploading…" : "Upload photo"}
                  </label>
                </div>
                <p className="mt-6 text-xs uppercase tracking-wide text-rose-400">Pronouns</p>
                <select
                  value={pronounsPreset}
                  onChange={(event) => {
                    const next = event.target.value as typeof pronounsPreset;
                    setPronounsPreset(next);
                    if (next !== "__custom__") {
                      setPronounsCustom("");
                    }
                  }}
                  className="mt-2 w-full rounded-2xl border border-rose-200 px-4 py-2 text-sm"
                >
                  <option value="">Prefer not to say</option>
                  <option value="She / Her">She / Her</option>
                  <option value="He / Him">He / Him</option>
                  <option value="They / Them">They / Them</option>
                  <option value="__custom__">Custom</option>
                </select>
                {pronounsPreset === "__custom__" ? (
                  <input
                    type="text"
                    value={pronounsCustom}
                    onChange={(event) => setPronounsCustom(event.target.value)}
                    placeholder="Custom pronouns"
                    className="mt-2 w-full rounded-2xl border border-rose-200 px-4 py-2 text-sm focus:border-rose-400 focus:outline-none"
                  />
                ) : null}
              </div>
            </div>
            {profileError ? (
              <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{profileError}</p>
            ) : null}
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void handleSaveProfile()}
                disabled={profileSaving}
                className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60"
              >
                {profileSaving ? "Saving…" : "Save profile"}
              </button>
              <button
                type="button"
                onClick={() => selectTab("account")}
                className="rounded-full border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700"
              >
                Open settings
              </button>
            </div>
          </div>
        );
      case "account":
        return (
          <div className="space-y-8">
            {usesGoogleAuth ? (
              <div className="rounded-3xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                This account is linked through Google Sign-In. Update your email or password from your Google Account settings.
              </div>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl border border-rose-100 bg-white p-5">
                <p className="text-xs uppercase tracking-wide text-rose-400">Email</p>
                <div className="mt-2">
                  <input
                    type="email"
                    defaultValue={user.email}
                    disabled
                    className="w-full rounded-2xl border border-rose-200 px-4 py-2 text-sm focus:border-rose-400 focus:outline-none disabled:cursor-not-allowed disabled:bg-rose-50 disabled:text-rose-400"
                  />
                </div>
                <p className="mt-2 text-xs text-rose-400">Email cannot be changed.</p>
              </div>
              <div className="rounded-3xl border border-rose-100 bg-white p-5">
                <p className="text-xs uppercase tracking-wide text-rose-400">Password</p>
                <div className="mt-2 flex gap-2">
                  <input
                    type="password"
                    placeholder={usesGoogleAuth ? "Managed by Google" : "New password"}
                    disabled={usesGoogleAuth}
                    className="w-full rounded-2xl border border-rose-200 px-4 py-2 text-sm focus:border-rose-400 focus:outline-none disabled:cursor-not-allowed disabled:bg-rose-50 disabled:text-rose-400"
                  />
                  <button
                    disabled={usesGoogleAuth}
                    className="rounded-2xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Change
                  </button>
                </div>
                {usesGoogleAuth ? (
                  <p className="mt-2 text-xs text-rose-400">Password changes are managed through Google.</p>
                ) : null}
              </div>
              <div className="rounded-3xl border border-rose-100 bg-white p-5">
                <p className="text-xs uppercase tracking-wide text-rose-400">Notifications</p>
                <label className="mt-3 flex items-center gap-2 text-sm text-rose-600">
                  <input type="checkbox" className="rounded border-rose-300 text-rose-600 focus:ring-rose-500" />
                  Email me about submission updates
                </label>
                <label className="mt-2 flex items-center gap-2 text-sm text-rose-600">
                  <input type="checkbox" className="rounded border-rose-300 text-rose-600 focus:ring-rose-500" />
                  New collection drops
                </label>
              </div>
              <div className="rounded-3xl border border-rose-100 bg-white p-5">
                <p className="text-xs uppercase tracking-wide text-rose-400">Profile visibility</p>
                <select className="mt-3 rounded-2xl border border-rose-200 px-4 py-2 text-sm">
                  <option>Public</option>
                  <option>Followers only</option>
                  <option>Private</option>
                </select>
              </div>
            </div>
              <div className="rounded-3xl border border-rose-100 bg-white p-5">
                <p className="text-xs uppercase tracking-wide text-rose-400">Closet sharing</p>
                <p className="mt-2 text-sm text-rose-500">
                  Decide when each tab exposes a shareable link. Turning sharing off instantly disables old links.
                </p>
                <div className="mt-4 space-y-6">
                  {(
                    [
                      {
                        key: "owned" as const,
                        label: "Owned wardrobe",
                        description: "Share a read-only view of everything you own.",
                        url: shareOwnedUrl,
                      },
                      {
                        key: "wishlist" as const,
                        label: "Wishlist",
                        description: "Let friends peek at what you&apos;re hunting for next.",
                        url: shareWishlistUrl,
                      },
                    ]
                  ).map(({ key, label, description, url }) => {
                    const isEnabled = key === "owned" ? shareSettings.owned : shareSettings.wishlist;
                    const statusClasses = isEnabled
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-slate-100 text-slate-500";
                    return (
                      <div key={key} className="space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-rose-900">{label}</p>
                            <p className="text-xs text-rose-500">{description}</p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${statusClasses}`}>
                              {isEnabled ? "Link active" : "Link disabled"}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                void handleShareToggle(key, !isEnabled);
                              }}
                              disabled={shareSaving}
                              aria-pressed={isEnabled}
                              className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-700 transition hover:border-rose-300 hover:text-rose-900 disabled:opacity-60"
                            >
                              {isEnabled ? "Turn off sharing" : "Enable sharing"}
                            </button>
                          </div>
                        </div>
                        {isEnabled ? (
                          <div className="space-y-2 rounded-2xl border border-rose-100 bg-rose-50/60 p-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-rose-400">Share link</p>
                            <div className="flex flex-wrap gap-2">
                              <input
                                type="text"
                                value={url}
                                readOnly
                                className="min-w-0 flex-1 rounded-2xl border border-rose-200 bg-white px-3 py-2 text-xs text-rose-700"
                              />
                              <button
                                type="button"
                                onClick={() => void handleShareCopy(key)}
                                className="rounded-full border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:border-rose-300 hover:text-rose-900"
                              >
                                {copyFeedback === key ? "Copied!" : "Copy"}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-rose-400">
                            Only you can see this tab until sharing is enabled.
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
                {shareError ? (
                  <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{shareError}</p>
                ) : null}
              </div>
            <div className="rounded-3xl border border-rose-100 bg-white p-5">
              <p className="text-xs uppercase tracking-wide text-rose-400">Delete account</p>
              <p className="mt-2 text-sm text-rose-500">Permanently remove your profile and associated data. This action cannot be undone.</p>
              {deleteError ? (
                <p className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{deleteError}</p>
              ) : null}
              <button
                type="button"
                onClick={() => void handleDeleteAccount()}
                disabled={deleteSaving}
                className="mt-3 rounded-full border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-600 disabled:opacity-60"
              >
                {deleteSaving ? "Deleting…" : "Delete account"}
              </button>
            </div>
          </div>
        );
      case "moderation":
        return isModerator ? (
          <div className="space-y-6">
            <div className="rounded-3xl border border-dashed border-rose-200 bg-white/70 p-6 text-sm text-rose-500">
              Moderation queue metrics will surface here once the review dashboard is live. Continue using the admin console for counts today.
            </div>
            <div className="rounded-3xl border border-rose-100 bg-white p-5">
              <h3 className="text-lg font-semibold text-rose-900">Quick links</h3>
              <p className="text-sm text-rose-500">Jump to the existing tools while this panel is wired up.</p>
              <div className="mt-4 flex flex-wrap gap-3 text-xs">
                <Link href="/admin/" target="_blank" className="rounded-full border border-rose-200 px-3 py-1 text-rose-700">
                  Open Django admin
                </Link>
                <Link href="/profile?panel=submissions" className="rounded-full border border-rose-200 px-3 py-1 text-rose-700">
                  Review submissions
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-rose-500">Moderation access is limited to moderators and admins.</p>
        );
      case "admin":
        return isAdmin ? (
          <div className="space-y-6">
            <div className="rounded-3xl border border-dashed border-rose-200 bg-white/70 p-6 text-sm text-rose-500">
              Admin analytics and management shortcuts will appear once the dashboard is powered by live data.
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <Link href="/admin/" target="_blank" className="rounded-3xl border border-rose-100 bg-white p-5 text-sm text-rose-700">
                Open Django admin
              </Link>
              <Link href="/profile?panel=moderation" className="rounded-3xl border border-rose-100 bg-white p-5 text-sm text-rose-700">
                View moderation panel
              </Link>
            </div>
          </div>
        ) : (
          <p className="text-sm text-rose-500">Admin controls are restricted to platform administrators.</p>
        );
      default:
        return <p className="text-sm text-rose-500">Select a section to get started.</p>;
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 lg:flex-row">
      <aside className="rounded-3xl border border-rose-100 bg-white/80 p-4 shadow-inner lg:w-64" aria-label="Profile sections">
        <div className="flex flex-col" role="tablist">
          {availableTabs.map((tab) => {
            const isSelected = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => selectTab(tab.id)}
                className={`mb-2 rounded-2xl border px-4 py-3 text-left transition ${
                  isSelected
                    ? "border-rose-300 bg-rose-50 text-rose-900"
                    : "border-transparent text-rose-500 hover:border-rose-100 hover:bg-rose-50"
                }`}
              >
                <span className="text-sm font-semibold">{tab.label}</span>
                <span className="block text-xs text-rose-400">{tab.description}</span>
              </button>
            );
          })}
        </div>
      </aside>
      <div className="flex-1 space-y-10">
        <header className="rounded-3xl border border-rose-100 bg-white/95 p-8 shadow-lg">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-1 items-center gap-4">
              <div className="relative h-20 w-20 overflow-hidden rounded-full border border-rose-100 bg-rose-50">
                {user.avatar_url ? (
                  <Image
                    src={resolveMediaUrl(user.avatar_url) ?? user.avatar_url}
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
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-3xl font-semibold text-rose-900">{user.display_name || user.username}</h1>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${roleBadgeClass}`}>
                    {roleBadgeLabel}
                  </span>
                </div>
                <p className="text-sm text-rose-500">
                  @{user.username} · {joinedDisplay}
                </p>
                <p className="text-sm text-rose-500">{user.email}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/closet"
                className="rounded-full border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:text-rose-900"
              >
                Closet page
              </Link>
              <button
                type="button"
                onClick={() => selectTab("profile")}
                className="rounded-full border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:text-rose-900"
              >
                Edit profile
              </button>
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
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {contributionStats.map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-rose-100 p-4">
                <p className="text-xs uppercase tracking-wide text-rose-400">{stat.label}</p>
                <p className="text-2xl font-semibold text-rose-900">-</p>
                <p className="text-xs text-rose-400">{stat.helper}</p>
              </div>
            ))}
          </div>
        </header>
        <section className="rounded-3xl border border-rose-100 bg-white/95 p-8 shadow-lg" role="tabpanel">
          {renderActivePanel()}
        </section>
      </div>
    </div>
  );
}
