import { notFound } from "next/navigation";

import ItemDetailClient from "./item-detail-client";

import { getItemDetail } from "@/lib/api";

type ItemDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function ItemDetailPage({ params }: ItemDetailPageProps) {
  const resolvedParams = await params;
  let item;
  try {
    item = await getItemDetail(resolvedParams.slug);
  } catch {
    notFound();
  }
  if (!item) {
    notFound();
  }
  return <ItemDetailClient item={item} />;
}
