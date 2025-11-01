type QueryParams = Record<string, string | undefined | null>;

type HeadersInit = globalThis.HeadersInit;

const API_BASE = (() => {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
  return base.endsWith("/") ? base : `${base}/`;
})();

function buildUrl(path: string, params?: QueryParams): string {
  const trimmed = path.replace(/^\/+/, "");
  const url = new URL(trimmed, API_BASE);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, value);
      }
    }
  }
  return url.toString();
}

async function fetchJson<T>(
  path: string,
  params?: QueryParams,
  init?: RequestInit
): Promise<T> {
  const url = buildUrl(path, params);
  const headers = new Headers(init?.headers as HeadersInit);
  headers.set("Accept", "application/json");

  const response = await fetch(url, {
    ...init,
    headers,
  });

  if (!response.ok) {
    throw new Error(`Request to ${url} failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

export type BrandSummary = {
  slug: string;
  name: string;
  icon_url: string | null;
  country: string | null;
  item_count: number;
};

export type BrandReference = Omit<BrandSummary, "item_count">;

export type BrandListResponse = {
  results: BrandSummary[];
  result_count: number;
};

export type FilterOption = {
  id: string;
  name: string;
  selected: boolean;
  hex?: string | null;
  type?: string | null;
  item_count?: number;
};

export type BrandFilterOption = {
  slug: string;
  name: string;
  selected: boolean;
  item_count?: number;
  country: string | null;
};

export type CollectionFilterOption = {
  id: string;
  name: string;
  brand_slug: string;
  year: number | null;
  selected: boolean;
};

export type ActiveFilter = {
  label: string;
  value: string;
  param: string;
};

export type PriceSummary = {
  amount: string;
  currency: string;
  source: string;
};

export type ColorSummary = {
  id: string;
  name: string;
  hex: string | null;
  is_primary: boolean;
};

export type TagSummary = {
  id: string;
  name: string;
  type: string;
};

export type ImagePreview = {
  id: string | null;
  url: string;
  is_cover: boolean;
};

export type ImageDetail = ImagePreview & {
  type: string;
  width: number | null;
  height: number | null;
};

export type ItemSummary = {
  slug: string;
  name: string;
  brand: BrandReference | null;
  category: { id: string; name: string } | null;
  release_year: number | null;
  has_matching_set: boolean;
  verified_source: boolean;
  primary_price: PriceSummary | null;
  colors: ColorSummary[];
  tags: TagSummary[];
  cover_image: ImagePreview | null;
};

export type ItemTranslationPayload = {
  language: string;
  name: string;
  description: string;
  pattern: string;
  fit: string;
  length: string;
  occasion: string;
  season: string;
  lining: string;
  closure_type: string;
  care_instructions: string;
};

export type ItemPriceDetail = {
  currency: string;
  amount: string;
  source: string;
  rate_used: string | null;
};

export type ItemVariantPayload = {
  label: string;
  sku: string;
  color: string | null;
  size_descriptor: string;
  stock_status: string;
  notes: Record<string, unknown>;
};

export type ItemMetadataPayload = {
  pattern: string | null;
  sleeve_type: string | null;
  occasion: string | null;
  season: string | null;
  fit: string | null;
  length: string | null;
  lining: string | null;
  closure_type: string | null;
  care_instructions: string | null;
  inspiration: string | null;
  ai_confidence: string | null;
};

export type ItemCollectionPlacement = {
  id: string;
  name: string;
  season: string | null;
  year: number | null;
  brand_slug: string | null;
  role: string;
};

export type ItemSubstyleDetail = {
  id: string;
  name: string;
  slug: string;
  weight: string | null;
};

export type ItemFabricDetail = {
  id: string;
  name: string;
  percentage: string | null;
};

export type ItemFeatureDetail = {
  id: string;
  name: string;
  category: string;
  is_prominent: boolean;
  notes: string;
};

export type ItemListResponse = {
  results: ItemSummary[];
  result_count: number;
  filters: {
    brands: BrandFilterOption[];
    categories: FilterOption[];
    tags: FilterOption[];
    colors: FilterOption[];
    collections: CollectionFilterOption[];
  };
  selected: {
    q: string | null;
    brand: string | null;
    category: string | null;
    tag: string | null;
    color: string | null;
    collection: string | null;
  };
  active_filters: ActiveFilter[];
};

export type ItemDetail = {
  id: string;
  slug: string;
  brand: BrandReference | null;
  category: { id: string; name: string } | null;
  default_language: string | null;
  default_currency: string | null;
  release_year: number | null;
  release_date: string | null;
  status: string;
  limited_edition: boolean;
  has_matching_set: boolean;
  metadata: ItemMetadataPayload | null;
  extra_metadata: Record<string, unknown> | null;
  translations: ItemTranslationPayload[];
  prices: ItemPriceDetail[];
  variants: ItemVariantPayload[];
  colors: ColorSummary[];
  tags: TagSummary[];
  collections: ItemCollectionPlacement[];
  substyles: ItemSubstyleDetail[];
  fabrics: ItemFabricDetail[];
  features: ItemFeatureDetail[];
  cover_image: ImagePreview | null;
  gallery: ImageDetail[];
};

export async function getBrandList(): Promise<BrandListResponse> {
  return fetchJson<BrandListResponse>("api/brands/", undefined, {
    cache: "no-store",
  });
}

export async function getItemList(
  params: Record<string, string | undefined>
): Promise<ItemListResponse> {
  return fetchJson<ItemListResponse>("api/items/", params, { cache: "no-store" });
}

export async function getItemDetail(slug: string): Promise<ItemDetail> {
  return fetchJson<ItemDetail>(`api/items/${encodeURIComponent(slug)}/`, undefined, {
    cache: "no-store",
  });
}
