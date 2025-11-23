type QueryParams = Record<string, string | readonly string[] | undefined | null>;

type HeadersInit = globalThis.HeadersInit;

export const API_BASE = (() => {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
  return base.endsWith("/") ? base : `${base}/`;
})();

export class ApiError extends Error {
  status: number;
  payload?: unknown;

  constructor(message: string, status: number, payload?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

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

async function fetchCollection<T>(path: string, params?: QueryParams): Promise<T[]> {
  const mergedParams: QueryParams = { page_size: "200", ...params };
  const data = await fetchJson<unknown>(path, mergedParams, { cache: "no-store" });
  if (Array.isArray(data)) {
    return data as T[];
  }
  if (
    data &&
    typeof data === "object" &&
    "results" in data &&
    Array.isArray((data as { results: unknown[] }).results)
  ) {
    return (data as { results: T[] }).results;
  }
  return [];
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

export type CategorySummary = {
  id: string;
  name: string;
  slug: string;
  description?: string;
};

export type SubcategorySummary = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  category: CategorySummary | null;
};

export type TagOptionSummary = {
  id: string;
  name: string;
  type: string;
  description?: string;
  is_featured?: boolean;
};

export type ColorOptionSummary = {
  id: string;
  name: string;
  hex_code: string | null;
};

export type StyleSummary = {
  id: string;
  name: string;
  slug: string;
  description?: string;
};

export type SubstyleSummary = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  style: StyleSummary | null;
};

export type FabricSummary = {
  id: string;
  name: string;
  description: string;
};

export type FeatureSummary = {
  id: string;
  name: string;
  description: string;
  category: string;
  is_visible: boolean;
};

export type CollectionSummary = {
  id: string;
  name: string;
  season: string | null;
  year: number | null;
  description: string;
  brand: BrandReference | null;
};

export type LanguageSummary = {
  id: string;
  code: string;
  name: string;
  native_name: string;
  is_supported: boolean;
};

export type CurrencySummary = {
  id: string;
  code: string;
  name: string;
  symbol: string | null;
  is_active: boolean;
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
  subcategory: { id: string; name: string; slug?: string | null } | null;
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
  style: { id: string; name: string; slug: string } | null;
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

export type ItemContributorSummary = {
  id: string;
  username: string;
  display_name: string;
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
  subcategory: { id: string; name: string; slug?: string | null } | null;
  default_language: string | null;
  default_currency: string | null;
  release_year: number | null;
  release_date: string | null;
  status: string;
  limited_edition: boolean;
  has_matching_set: boolean;
  submitted_by: ItemContributorSummary | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
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

export async function listBrandSummaries(): Promise<BrandSummary[]> {
  return fetchCollection<BrandSummary>("api/brands/", { page_size: "300" });
}

export async function listCategories(): Promise<CategorySummary[]> {
  const categories = await fetchCollection<CategorySummary>("api/categories/", { page_size: "300" });
  return categories.sort((a, b) => a.name.localeCompare(b.name));
}

export async function listSubcategories(): Promise<SubcategorySummary[]> {
  return fetchCollection<SubcategorySummary>("api/subcategories/", { page_size: "400" });
}

export async function listTags(): Promise<TagOptionSummary[]> {
  const tags = await fetchCollection<TagOptionSummary>("api/tags/", { page_size: "400" });
  return tags.sort((a, b) => a.name.localeCompare(b.name));
}

export async function listColors(): Promise<ColorOptionSummary[]> {
  const colors = await fetchCollection<ColorOptionSummary>("api/colors/", { page_size: "300" });
  return colors.sort((a, b) => a.name.localeCompare(b.name));
}

export async function listStyles(): Promise<StyleSummary[]> {
  const styles = await fetchCollection<StyleSummary>("api/styles/", { page_size: "300" });
  return styles.sort((a, b) => a.name.localeCompare(b.name));
}

export async function listSubstyles(): Promise<SubstyleSummary[]> {
  const substyles = await fetchCollection<SubstyleSummary>("api/substyles/", { page_size: "400" });
  return substyles.sort((a, b) => a.name.localeCompare(b.name));
}

export async function listFabrics(): Promise<FabricSummary[]> {
  const fabrics = await fetchCollection<FabricSummary>("api/fabrics/", { page_size: "300" });
  return fabrics.sort((a, b) => a.name.localeCompare(b.name));
}

export async function listFeatures(): Promise<FeatureSummary[]> {
  const features = await fetchCollection<FeatureSummary>("api/features/", { page_size: "400" });
  return features.sort((a, b) => a.name.localeCompare(b.name));
}

export async function listCollections(): Promise<CollectionSummary[]> {
  const collections = await fetchCollection<CollectionSummary>("api/collections/", { page_size: "400" });
  return collections;
}

export async function listLanguages(): Promise<LanguageSummary[]> {
  return fetchCollection<LanguageSummary>("api/languages/", { page_size: "300" });
}

export async function listCurrencies(): Promise<CurrencySummary[]> {
  return fetchCollection<CurrencySummary>("api/currencies/", { page_size: "300" });
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
  preferred_language: string | null;
  preferred_currency: string | null;
};

export type AuthResponse = {
  token: string;
  user: UserProfile;
};

export type UpdateUserPreferencesPayload = {
  preferred_language?: string | null;
  preferred_currency?: string | null;
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

function extractErrorMessage(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }
  if (
    "detail" in payload &&
    typeof (payload as { detail: unknown }).detail === "string" &&
    (payload as { detail: string }).detail.trim().length > 0
  ) {
    return (payload as { detail: string }).detail;
  }
  if ("message" in payload && typeof (payload as { message: unknown }).message === "string") {
    return (payload as { message: string }).message;
  }
  if (Array.isArray(payload)) {
    return payload.map((entry) => String(entry)).join("\n");
  }
  return undefined;
}

async function handleJsonResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) {
    return undefined as T;
  }
  const text = await response.text();
  if (!response.ok) {
    let parsed: unknown;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = undefined;
      }
    }
    const extractedMessage = parsed ? extractErrorMessage(parsed) : undefined;
    const message = extractedMessage || text || `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status, parsed ?? text);
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

export async function updateUserPreferences(
  token: string,
  payload: UpdateUserPreferencesPayload
): Promise<UserProfile> {
  const response = await fetch(buildUrl("api/auth/me/"), {
    method: "PATCH",
    headers: buildJsonHeaders(buildAuthHeaders(token)),
    body: JSON.stringify(payload),
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

export type ItemMetadataInput = {
  pattern?: string;
  sleeve_type?: string;
  season?: string;
  fit?: string;
  length?: string;
  lining?: string;
  closure_type?: string;
  care_instructions?: string;
  inspiration?: string;
  ai_confidence?: number | null;
};

export type ItemTranslationInput = {
  language: string;
  dialect?: string;
  name: string;
  description?: string;
  pattern?: string;
  fit?: string;
  length?: string;
  season?: string;
  lining?: string;
  closure_type?: string;
  care_instructions?: string;
  source?: string;
  quality?: string;
  auto_translated?: boolean;
};

export type ItemTagInput = {
  id: string;
  tag_context?: "primary" | "secondary";
  confidence?: number | null;
};

export type ItemColorInput = {
  id: string;
  is_primary?: boolean;
};

export type ItemSubstyleInput = {
  id: string;
  weight?: number | null;
};

export type ItemFabricInput = {
  id: string;
  percentage?: number | null;
};

export type ItemFeatureInput = {
  id: string;
  is_prominent?: boolean;
  notes?: string;
};

export type ItemCollectionInput = {
  id: string;
  role?: string;
};

export type ItemPriceInput = {
  currency: string;
  amount: number;
  source?: string;
  rate_used?: number | null;
  valid_from?: string | null;
  valid_to?: string | null;
};

export type ItemVariantInput = {
  label: string;
  sku?: string;
  color?: string | null;
  size_descriptor?: string;
  stock_status?: string;
  notes?: Record<string, unknown>;
};

export type ItemMeasurementInput = {
  variant_label?: string | null;
  is_one_size?: boolean;
  bust_cm?: number | null;
  waist_cm?: number | null;
  hip_cm?: number | null;
  length_cm?: number | null;
  sleeve_length_cm?: number | null;
  hem_cm?: number | null;
  heel_height_cm?: number | null;
  bag_depth_cm?: number | null;
  fit_notes?: string;
};

export type ItemImageAssociation = {
  id: string;
  type?: string;
  is_cover?: boolean;
  caption?: string;
  variant_label?: string | null;
};

export type ItemCreatePayload = {
  slug: string;
  brand_slug: string;
  category_id?: string | null;
  subcategory_id?: string | null;
  origin_country?: string;
  default_language?: string;
  default_currency?: string;
  release_year?: number | null;
  release_date?: string | null;
  collaboration?: string;
  limited_edition?: boolean;
  has_matching_set?: boolean;
  verified_source?: boolean;
  status?: string;
  extra_metadata?: Record<string, unknown>;
  metadata?: ItemMetadataInput | null;
  translations: ItemTranslationInput[];
  tags?: ItemTagInput[];
  colors?: ItemColorInput[];
  substyles?: ItemSubstyleInput[];
  fabrics?: ItemFabricInput[];
  features?: ItemFeatureInput[];
  collections?: ItemCollectionInput[];
  prices?: ItemPriceInput[];
  variants?: ItemVariantInput[];
  measurements?: ItemMeasurementInput[];
  images?: ItemImageAssociation[];
};

export type UploadedImageSummary = {
  id: string;
  url: string;
  type: string;
  caption: string | null;
  is_cover: boolean;
  width: number | null;
  height: number | null;
  item?: string | null;
  brand?: string | null;
  variant?: string | null;
  file_size_bytes?: number | null;
  hash_signature?: string | null;
  dominant_color?: string | null;
  source?: string | null;
  license?: string | null;
};

export async function createItem(token: string, payload: ItemCreatePayload): Promise<ItemDetail> {
  const response = await fetch(buildUrl("api/items/"), {
    method: "POST",
    headers: buildJsonHeaders(buildAuthHeaders(token)),
    body: JSON.stringify(payload),
  });
  return handleJsonResponse<ItemDetail>(response);
}

type UploadImageOptions = {
  type?: string;
  caption?: string;
  itemId?: string;
  brandId?: string;
  variantId?: string;
  isCover?: boolean;
  source?: string;
  license?: string;
};

export async function uploadItemImage(
  token: string,
  file: File,
  options?: UploadImageOptions
): Promise<UploadedImageSummary> {
  const formData = new FormData();
  formData.append("image_file", file);
  if (options?.type) {
    formData.append("type", options.type);
  }
  if (options?.caption) {
    formData.append("caption", options.caption);
  }
  if (options?.itemId) {
    formData.append("item", options.itemId);
  }
  if (options?.brandId) {
    formData.append("brand", options.brandId);
  }
  if (options?.variantId) {
    formData.append("variant", options.variantId);
  }
  if (options?.isCover !== undefined) {
    formData.append("is_cover", String(options.isCover));
  }
  if (options?.source) {
    formData.append("source", options.source);
  }
  if (options?.license) {
    formData.append("license", options.license);
  }

  const headers = new Headers();
  headers.set("Accept", "application/json");
  headers.set("Authorization", `Token ${token}`);

  const response = await fetch(buildUrl("api/images/"), {
    method: "POST",
    headers,
    body: formData,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Image upload failed with status ${response.status}`);
  }

  const payload = (await response.json()) as UploadedImageSummary;
  return payload;
}

export async function deleteItemImage(token: string, imageId: string): Promise<void> {
  const response = await fetch(buildUrl(`api/images/${encodeURIComponent(imageId)}/`), {
    method: "DELETE",
    headers: buildAuthHeaders(token),
  });
  if (!response.ok && response.status !== 204) {
    const message = await response.text();
    throw new Error(message || `Failed to delete image (${response.status})`);
  }
}

export type UpdateImagePayload = {
  type?: string | null;
  caption?: string | null;
  is_cover?: boolean;
  itemId?: string | null;
  brandId?: string | null;
  variantId?: string | null;
  source?: string | null;
  license?: string | null;
};

export async function updateItemImage(
  token: string,
  imageId: string,
  payload: UpdateImagePayload
): Promise<UploadedImageSummary> {
  const formData = new FormData();
  if (payload.type !== undefined) {
    formData.append("type", payload.type ?? "");
  }
  if (payload.caption !== undefined) {
    formData.append("caption", payload.caption ?? "");
  }
  if (payload.is_cover !== undefined) {
    formData.append("is_cover", String(payload.is_cover));
  }
  if (payload.itemId !== undefined) {
    if (payload.itemId) {
      formData.append("item", payload.itemId);
    } else {
      formData.append("item", "");
    }
  }
  if (payload.brandId !== undefined) {
    if (payload.brandId) {
      formData.append("brand", payload.brandId);
    } else {
      formData.append("brand", "");
    }
  }
  if (payload.variantId !== undefined) {
    if (payload.variantId) {
      formData.append("variant", payload.variantId);
    } else {
      formData.append("variant", "");
    }
  }
  if (payload.source !== undefined) {
    formData.append("source", payload.source ?? "");
  }
  if (payload.license !== undefined) {
    formData.append("license", payload.license ?? "");
  }

  const headers = new Headers();
  headers.set("Accept", "application/json");
  headers.set("Authorization", `Token ${token}`);

  const response = await fetch(buildUrl(`api/images/${encodeURIComponent(imageId)}/`), {
    method: "PATCH",
    headers,
    body: formData,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Failed to update image (${response.status})`);
  }

  return (await response.json()) as UploadedImageSummary;
}

export type ItemSubmissionPayload = {
  id: string;
  user: string;
  item_slug: string;
  title: string;
  name_translations: SubmissionNameTranslation[];
  description_translations: SubmissionDescriptionTranslation[];
  brand_name: string;
  brand_slug: string | null;
  description: string;
  reference_url: string;
  reference_urls: string[];
  image_url: string;
  tags: string[];
  release_year: number | null;
  category_slug: string;
  subcategory_slug: string;
  style_slugs: string[];
  substyle_slugs: string[];
  color_slugs: string[];
  fabric_breakdown: SubmissionFabricBreakdown[];
  feature_slugs: string[];
  collection_reference: string;
  collection_proposal: CollectionProposalPayload | Record<string, never>;
  price_amounts: SubmissionPriceAmount[];
  origin_country: string;
  production_country: string;
  limited_edition: boolean;
  has_matching_set: boolean;
  verified_source: boolean;
  status: string;
  moderator_notes: string | null;
  linked_item: string | null;
  created_at: string;
  updated_at: string;
  size_measurements: SubmissionSizeMeasurement[];
};

export type SubmissionNameTranslation = {
  language: string;
  value: string;
};

export type SubmissionDescriptionTranslation = SubmissionNameTranslation;

export type SubmissionFabricBreakdown = {
  fabric: string;
  percentage?: string;
};

export type SubmissionPriceAmount = {
  currency: string;
  amount: string;
};

export type SubmissionSizeMeasurement = {
  size_label: string;
  size_category?: string;
  unit_system: "metric" | "imperial";
  is_one_size: boolean;
  notes?: string;
  measurements: Record<string, number>;
};

export type CreateSubmissionSizeMeasurementEntry = {
  size_label: string;
  size_category?: string;
  unit_system: "metric" | "imperial";
  is_one_size?: boolean;
  notes?: string;
  bust?: string | number;
  waist?: string | number;
  hip?: string | number;
  length?: string | number;
  sleeve_length?: string | number;
  hem?: string | number;
  heel_height?: string | number;
  bag_depth?: string | number;
};

export type CollectionProposalPayload = {
  name: string;
  season?: string;
  year?: number | null;
  notes?: string;
  brand_slug?: string | null;
};

export type CreateSubmissionPayload = {
  title: string;
  name_translations?: SubmissionNameTranslation[];
  description_translations?: SubmissionDescriptionTranslation[];
  brand_name: string;
  brand_slug?: string | null;
  description?: string;
  reference_url?: string;
  reference_urls?: string[];
  image_url?: string;
  tags?: string[];
  item_slug?: string;
  release_year?: number | null;
  category_slug?: string | null;
  subcategory_slug?: string | null;
  style_slugs?: string[];
  substyle_slugs?: string[];
  color_slugs?: string[];
  fabric_breakdown?: SubmissionFabricBreakdown[];
  feature_slugs?: string[];
  collection_reference?: string;
  collection_proposal?: CollectionProposalPayload;
  price_amounts?: SubmissionPriceAmount[];
  origin_country?: string;
  production_country?: string;
  limited_edition?: boolean;
  has_matching_set?: boolean;
  verified_source?: boolean;
  size_measurements?: CreateSubmissionSizeMeasurementEntry[];
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

export type SubmissionSummary = {
  id: string;
  title: string;
  brand_name: string;
  brand_slug: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  release_year: number | null;
  category_slug: string | null;
  subcategory_slug: string | null;
  image_url: string | null;
  reference_url: string | null;
};

export async function listMySubmissions(
  token: string,
  params?: { status?: string[] }
): Promise<SubmissionSummary[]> {
  const query: QueryParams = {};
  if (params?.status && params.status.length > 0) {
    query.status = params.status.join(",");
  }
  const response = await fetch(buildUrl("api/submissions/mine/", query), {
    headers: buildAuthHeaders(token),
    cache: "no-store",
  });
  return handleJsonResponse<SubmissionSummary[]>(response);
}

export async function getSubmissionDetail(
  token: string,
  submissionId: string
): Promise<ItemSubmissionPayload> {
  const response = await fetch(buildUrl(`api/item-submissions/${submissionId}/`), {
    headers: buildAuthHeaders(token),
    cache: "no-store",
  });
  return handleJsonResponse<ItemSubmissionPayload>(response);
}

export async function saveSubmissionDraft(
  token: string,
  payload: CreateSubmissionPayload,
  draftId?: string
): Promise<ItemSubmissionPayload> {
  const path = draftId ? `api/submissions/drafts/${draftId}/` : "api/submissions/drafts/";
  const method = draftId ? "PATCH" : "POST";
  const response = await fetch(buildUrl(path), {
    method,
    headers: buildJsonHeaders(buildAuthHeaders(token)),
    body: JSON.stringify(payload),
  });
  return handleJsonResponse<ItemSubmissionPayload>(response);
}

export async function deleteSubmissionDraft(token: string, draftId: string): Promise<void> {
  const response = await fetch(buildUrl(`api/submissions/drafts/${draftId}/`), {
    method: "DELETE",
    headers: buildAuthHeaders(token),
  });
  if (!response.ok) {
    throw new Error(`Failed to delete draft ${draftId}.`);
  }
}
