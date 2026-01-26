import { notFound } from "next/navigation";
import { cookies } from "next/headers";

import ItemDetailClient from "./item-detail-client";

import { getItemDetail } from "@/lib/api";

type ItemDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function ItemDetailPage({ params }: ItemDetailPageProps) {
  const resolvedParams = await params;
  const cookieStore = await cookies();
  const preferredLanguage = cookieStore.get("jiraibrary.guest.language")?.value ?? "en";
  const preferredCurrency = cookieStore.get("jiraibrary.guest.currency")?.value ?? "USD";
  let item;
  try {
    item = await getItemDetail(resolvedParams.slug, {
      language: preferredLanguage,
      currency: preferredCurrency,
    });
  } catch {
    notFound();
  }
  if (!item) {
    notFound();
  }
  return <ItemDetailClient item={item} />;
}
