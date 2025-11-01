"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { ItemFavorite, createFavorite, deleteFavorite, listFavorites } from "@/lib/api";

type FavoriteToggleProps = {
  itemSlug: string;
};

export default function FavoriteToggle({ itemSlug }: FavoriteToggleProps) {
  const { user, token } = useAuth();
  const router = useRouter();
  const [favorite, setFavorite] = useState<ItemFavorite | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!token) {
      setFavorite(null);
      return;
    }
    let active = true;
    const fetchFavorite = async () => {
      try {
        const [match] = await listFavorites(token, { item: itemSlug });
        if (active) {
          setFavorite(match ?? null);
        }
      } catch (error) {
        console.error("Failed to load favorite status", error);
      }
    };
    void fetchFavorite();
    return () => {
      active = false;
    };
  }, [itemSlug, token]);

  const handleClick = async () => {
    if (!token) {
      router.push(`/login?next=/items/${encodeURIComponent(itemSlug)}`);
      return;
    }
    setPending(true);
    try {
      if (favorite) {
        await deleteFavorite(token, favorite.id);
        setFavorite(null);
      } else {
        const created = await createFavorite(token, itemSlug);
        setFavorite(created);
      }
    } catch (error) {
      console.error("Failed to toggle favorite", error);
    } finally {
      setPending(false);
    }
  };

  if (!user) {
    return (
      <Link
        href={`/login?next=/items/${encodeURIComponent(itemSlug)}`}
        className="rounded-full border border-rose-200 px-3 py-1 text-xs font-medium text-rose-600 transition hover:border-rose-300 hover:text-rose-800"
      >
        Login to favorite
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className={`rounded-full px-3 py-1 text-xs font-medium transition ${
        favorite
          ? "border border-rose-400 bg-rose-100 text-rose-700"
          : "border border-rose-200 text-rose-600 hover:border-rose-300 hover:text-rose-800"
      } disabled:cursor-not-allowed disabled:opacity-60`}
    >
      {pending ? "Saving…" : favorite ? "Favorited" : "Add to favorites"}
    </button>
  );
}
