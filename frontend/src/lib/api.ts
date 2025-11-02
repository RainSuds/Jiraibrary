type QueryParams = Record<string, string | readonly string[] | undefined | null>;

type HeadersInit = globalThis.HeadersInit;

export const API_BASE = (() => {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
  return base.endsWith("/") ? base : `${base}/`;
})();

function buildUrl(path: string, params?: QueryParams): string {
  const trimmed = path.replace(/^\/+/, "");
  const url = new URL(trimmed, API_BASE);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (Array.isArray(value)) {
        for (const entry of value) {
          if (entry !== undefined && entry !== null && entry !== "") {
            url.searchParams.append(key, entry);
          }
        }
        continue;
      }
      if (
        typeof value === "string" &&
        value !== undefined &&
        value !== null &&
        value !== ""
      ) {
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

export type CategoryFilterOption = FilterOption & {
  subcategories: FilterOption[];
};

export type BrandFilterOption = {
  slug: string;
  name: string;
  selected: boolean;
  item_count?: number;
  country: string | null;
};

export type StyleFilterOption = {
  slug: string;
  name: string;
  selected: boolean;
  item_count?: number;
  substyles: SubstyleFilterOption[];
};

export type SubstyleFilterOption = {
  slug: string;
  name: string;
  selected: boolean;
  item_count?: number;
};

export type CollectionFilterOption = {
  id: string;
  name: string;
  brand_slug: string;
  year: number | null;
  selected: boolean;
};

export type FeatureFilterOption = FilterOption & {
  category?: string | null;
};

export type MeasurementOption = {
  field: string;
  label: string;
  unit: string;
  min: number | null;
  max: number | null;
};

export type ReleaseYearFilter = {
  min: number | null;
  max: number | null;
};

export type PriceFilterOption = {
  currency: string;
  min: number | null;
  max: number | null;
};

export type ActiveFilter = {
  label: string;
  value: string;
  param: string;
  value_key?: string;
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
    categories: CategoryFilterOption[];
    styles: StyleFilterOption[];
    tags: FilterOption[];
    colors: FilterOption[];
    collections: CollectionFilterOption[];
    fabrics: FilterOption[];
    features: FeatureFilterOption[];
    measurements: MeasurementOption[];
    release_year: ReleaseYearFilter;
    prices: PriceFilterOption;
  };
  selected: {
    q: string | null;
    brand: string[];
    category: string[];
    subcategory: string[];
    style: string[];
    substyle: string[];
    tag: string[];
    color: string[];
    collection: string[];
    fabric: string[];
    feature: string[];
    measurement: {
      bust_min: number | null;
      bust_max: number | null;
      waist_min: number | null;
      waist_max: number | null;
      hip_min: number | null;
      hip_max: number | null;
      length_min: number | null;
      length_max: number | null;
    };
    release_year_ranges: {
      min: number | null;
      max: number | null;
      value_key: string;
    }[];
    price_currency: string | null;
    price_ranges: {
      currency: string;
      min: number | null;
      max: number | null;
      value_key: string;
    }[];
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
  params: Record<string, string | readonly string[] | undefined>
): Promise<ItemListResponse> {
  return fetchJson<ItemListResponse>("api/items/", params, { cache: "no-store" });
}

export async function getItemDetail(slug: string): Promise<ItemDetail> {
  return fetchJson<ItemDetail>(`api/items/${encodeURIComponent(slug)}/`, undefined, {
    cache: "no-store",
  });
}

export type UserRole = {
  name: string;
  scopes: string[];
};

export type UserProfile = {
  id: string;
  username: string;
  email: string;
  is_staff: boolean;
  display_name: string;
  role: UserRole | null;
  avatar_url: string | null;
};

export type AuthResponse = {
  token: string;
  user: UserProfile;
};

function buildAuthHeaders(token: string, extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  headers.set("Accept", "application/json");
  headers.set("Authorization", `Token ${token}`);
  return headers;
}

function buildJsonHeaders(init?: HeadersInit): Headers {
  const headers = new Headers(init);
  headers.set("Accept", "application/json");
  headers.set("Content-Type", "application/json");
  return headers;
}

async function handleJsonResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) {
    return undefined as T;
  }
  const text = await response.text();
  if (!response.ok) {
    throw new Error(text || `Request failed with status ${response.status}`);
  }
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

export async function login(identifier: string, password: string): Promise<AuthResponse> {
  const response = await fetch(buildUrl("api/auth/login/"), {
    method: "POST",
    headers: buildJsonHeaders(),
    body: JSON.stringify({ identifier, username: identifier, password }),
  });
  return handleJsonResponse<AuthResponse>(response);
}

export async function loginWithGoogle(idToken: string): Promise<AuthResponse> {
  const response = await fetch(buildUrl("api/auth/google/"), {
    method: "POST",
    headers: buildJsonHeaders(),
    body: JSON.stringify({ id_token: idToken }),
  });
  return handleJsonResponse<AuthResponse>(response);
}

export async function logout(token: string): Promise<void> {
  const response = await fetch(buildUrl("api/auth/logout/"), {
    method: "POST",
    headers: buildAuthHeaders(token),
  });
  await handleJsonResponse<void>(response);
}

export type RegisterPayload = {
  username: string;
  email: string;
  password: string;
  displayName?: string;
};

export async function register(payload: RegisterPayload): Promise<AuthResponse> {
  const response = await fetch(buildUrl("api/auth/register/"), {
    method: "POST",
    headers: buildJsonHeaders(),
    body: JSON.stringify({
      username: payload.username,
      email: payload.email,
      password: payload.password,
      display_name: payload.displayName ?? payload.username,
    }),
  });
  return handleJsonResponse<AuthResponse>(response);
}

export async function getCurrentUser(token: string): Promise<UserProfile> {
  const response = await fetch(buildUrl("api/auth/me/"), {
    headers: buildAuthHeaders(token),
    cache: "no-store",
  });
  return handleJsonResponse<UserProfile>(response);
}

export type ItemFavorite = {
  id: string;
  item: string;
  item_detail: ItemSummary;
  created_at: string;
};

export async function listFavorites(token: string, params?: { item?: string }): Promise<ItemFavorite[]> {
  const response = await fetch(
    buildUrl("api/item-favorites/", params?.item ? { item: params.item } : undefined),
    {
      headers: buildAuthHeaders(token),
      cache: "no-store",
    }
  );
  return handleJsonResponse<ItemFavorite[]>(response);
}

export async function createFavorite(token: string, slug: string): Promise<ItemFavorite> {
  const response = await fetch(buildUrl("api/item-favorites/"), {
    method: "POST",
    headers: buildJsonHeaders(buildAuthHeaders(token)),
    body: JSON.stringify({ item: slug }),
  });
  return handleJsonResponse<ItemFavorite>(response);
}

export async function deleteFavorite(token: string, favoriteId: string): Promise<void> {
  const response = await fetch(buildUrl(`api/item-favorites/${encodeURIComponent(favoriteId)}/`), {
    method: "DELETE",
    headers: buildAuthHeaders(token),
  });
  if (!response.ok && response.status !== 204) {
    throw new Error(`Failed to remove favorite (${response.status})`);
  }
}

export type ItemSubmissionPayload = {
  id: string;
  user: string;
  title: string;
  brand_name: string;
  description: string;
  reference_url: string;
  image_url: string;
  tags: string[];
  status: string;
  moderator_notes: string | null;
  linked_item: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateSubmissionPayload = {
  title: string;
  brand_name: string;
  description?: string;
  reference_url?: string;
  image_url?: string;
  tags?: string[];
};

export async function createSubmission(
  token: string,
  payload: CreateSubmissionPayload
): Promise<ItemSubmissionPayload> {
  const response = await fetch(buildUrl("api/item-submissions/"), {
    method: "POST",
    headers: buildJsonHeaders(buildAuthHeaders(token)),
    body: JSON.stringify(payload),
  });
  return handleJsonResponse<ItemSubmissionPayload>(response);
}

export async function listSubmissions(token: string): Promise<ItemSubmissionPayload[]> {
  const response = await fetch(buildUrl("api/item-submissions/"), {
    headers: buildAuthHeaders(token),
    cache: "no-store",
  });
  return handleJsonResponse<ItemSubmissionPayload[]>(response);
}
