"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { API_BASE } from "@/lib/api";

type ResourceConfig = {
  id: string;
  label: string;
  description: string;
  listPath: string;
  detailPath: (id: string) => string;
  idField: string;
  displayField: string;
  updateMethod?: "PATCH" | "PUT";
  adminOnly?: boolean;
  single?: boolean;
  defaultPayload: Record<string, unknown>;
};

const buildUrl = (path: string) => {
  const trimmed = path.replace(/^\/+/, "");
  const base = API_BASE.endsWith("/") ? API_BASE : `${API_BASE}/`;
  return new URL(trimmed, base).toString();
};

const resourceGroups: { title: string; resources: ResourceConfig[] }[] = [
  {
    title: "People",
    resources: [
      {
        id: "users",
        label: "Users",
        description: "Edit profiles, roles, and access flags.",
        listPath: "api/admin/users/",
        detailPath: (id) => `api/admin/users/${encodeURIComponent(id)}/`,
        idField: "id",
        displayField: "username",
        adminOnly: true,
        defaultPayload: {
          username: "",
          email: "",
          first_name: "",
          last_name: "",
          is_active: true,
          is_staff: false,
          is_superuser: false,
          role_id: null,
          display_name: "",
          bio: "",
          avatar_url: "",
          pronouns: "",
          location: "",
          website: "",
        },
      },
      {
        id: "roles",
        label: "Roles",
        description: "Create and tune role scopes.",
        listPath: "api/admin/roles/",
        detailPath: (id) => `api/admin/roles/${encodeURIComponent(id)}/`,
        idField: "id",
        displayField: "name",
        adminOnly: true,
        defaultPayload: {
          name: "",
          description: "",
          scopes: [],
        },
      },
    ],
  },
  {
    title: "Catalog",
    resources: [
      {
        id: "items",
        label: "Items",
        description: "Full CRUD for catalog items.",
        listPath: "api/items/",
        detailPath: (id) => `api/items/${encodeURIComponent(id)}/`,
        idField: "slug",
        displayField: "slug",
        updateMethod: "PUT",
        adminOnly: true,
        defaultPayload: {
          slug: "",
          brand_slug: "",
          category_slug: "",
          subcategory_slug: "",
          release_year: null,
          status: "published",
          tags: [],
          translations: [],
          variants: [],
        },
      },
      {
        id: "brands",
        label: "Brands",
        description: "Manage brand metadata and translations.",
        listPath: "api/brands/",
        detailPath: (id) => `api/brands/${encodeURIComponent(id)}/`,
        idField: "slug",
        displayField: "slug",
        adminOnly: true,
        defaultPayload: {
          slug: "",
          names: { en: "" },
          descriptions: {},
          country: "",
          founded_year: null,
          icon_url: "",
          official_site_url: "",
          status: "active",
        },
      },
      {
        id: "collections",
        label: "Collections",
        description: "Seasons and drops attached to brands.",
        listPath: "api/collections/",
        detailPath: (id) => `api/collections/${encodeURIComponent(id)}/`,
        idField: "id",
        displayField: "name",
        adminOnly: true,
        defaultPayload: {
          name: "",
          season: "",
          year: null,
          description: "",
          brand_id: null,
        },
      },
      {
        id: "categories",
        label: "Categories",
        description: "Top-level catalog categories.",
        listPath: "api/categories/",
        detailPath: (id) => `api/categories/${encodeURIComponent(id)}/`,
        idField: "slug",
        displayField: "name",
        adminOnly: true,
        defaultPayload: {
          name: "",
          slug: "",
          description: "",
        },
      },
      {
        id: "subcategories",
        label: "Subcategories",
        description: "Subcategory taxonomy nodes.",
        listPath: "api/subcategories/",
        detailPath: (id) => `api/subcategories/${encodeURIComponent(id)}/`,
        idField: "slug",
        displayField: "name",
        adminOnly: true,
        defaultPayload: {
          name: "",
          slug: "",
          description: "",
          category_id: null,
        },
      },
      {
        id: "styles",
        label: "Styles",
        description: "Primary styles and tags.",
        listPath: "api/styles/",
        detailPath: (id) => `api/styles/${encodeURIComponent(id)}/`,
        idField: "slug",
        displayField: "name",
        adminOnly: true,
        defaultPayload: {
          name: "",
          slug: "",
          description: "",
        },
      },
      {
        id: "substyles",
        label: "Substyles",
        description: "Secondary style tags.",
        listPath: "api/substyles/",
        detailPath: (id) => `api/substyles/${encodeURIComponent(id)}/`,
        idField: "slug",
        displayField: "name",
        adminOnly: true,
        defaultPayload: {
          name: "",
          slug: "",
          description: "",
          style_id: null,
        },
      },
      {
        id: "tags",
        label: "Tags",
        description: "Item tags used in filters.",
        listPath: "api/tags/",
        detailPath: (id) => `api/tags/${encodeURIComponent(id)}/`,
        idField: "slug",
        displayField: "name",
        adminOnly: true,
        defaultPayload: {
          name: "",
          slug: "",
          type: "general",
          is_featured: false,
        },
      },
      {
        id: "colors",
        label: "Colors",
        description: "Color swatches and palette mapping.",
        listPath: "api/colors/",
        detailPath: (id) => `api/colors/${encodeURIComponent(id)}/`,
        idField: "id",
        displayField: "name",
        adminOnly: true,
        defaultPayload: {
          name: "",
          hex_code: "",
          lch_values: {},
        },
      },
      {
        id: "fabrics",
        label: "Fabrics",
        description: "Fabric and material dictionary.",
        listPath: "api/fabrics/",
        detailPath: (id) => `api/fabrics/${encodeURIComponent(id)}/`,
        idField: "id",
        displayField: "name",
        adminOnly: true,
        defaultPayload: {
          name: "",
          description: "",
        },
      },
      {
        id: "features",
        label: "Features",
        description: "Construction features and signals.",
        listPath: "api/features/",
        detailPath: (id) => `api/features/${encodeURIComponent(id)}/`,
        idField: "id",
        displayField: "name",
        adminOnly: true,
        defaultPayload: {
          name: "",
          description: "",
          synonyms: [],
          category: "",
          is_visible: true,
        },
      },
      {
        id: "languages",
        label: "Languages",
        description: "Localized name support.",
        listPath: "api/languages/",
        detailPath: (id) => `api/languages/${encodeURIComponent(id)}/`,
        idField: "code",
        displayField: "code",
        adminOnly: true,
        defaultPayload: {
          code: "",
          name: "",
          native_name: "",
          is_supported: true,
        },
      },
      {
        id: "currencies",
        label: "Currencies",
        description: "Currency catalog and activation.",
        listPath: "api/currencies/",
        detailPath: (id) => `api/currencies/${encodeURIComponent(id)}/`,
        idField: "code",
        displayField: "code",
        adminOnly: true,
        defaultPayload: {
          code: "",
          name: "",
          symbol: "",
          is_active: true,
        },
      },
    ],
  },
  {
    title: "Moderation",
    resources: [
      {
        id: "submissions",
        label: "Submissions",
        description: "Review and triage incoming submissions.",
        listPath: "api/item-submissions/",
        detailPath: (id) => `api/item-submissions/${encodeURIComponent(id)}/`,
        idField: "id",
        displayField: "title",
        defaultPayload: {
          title: "",
          brand_name: "",
          status: "pending",
          moderator_notes: "",
          linked_item: null,
        },
      },
      {
        id: "reviews",
        label: "Reviews",
        description: "Moderate and edit reviews.",
        listPath: "api/admin/reviews/",
        detailPath: (id) => `api/admin/reviews/${encodeURIComponent(id)}/`,
        idField: "id",
        displayField: "item_slug",
        defaultPayload: {
          item: null,
          recommendation: "recommend",
          body: "",
          status: "pending",
          moderation_note: "",
        },
      },
    ],
  },
  {
    title: "Ingestion",
    resources: [
      {
        id: "ingestion",
        label: "Ingestion jobs",
        description: "Crawl a source URL and create a pending submission draft.",
        listPath: "api/admin/ingestion/",
        detailPath: (id) => `api/admin/ingestion/${encodeURIComponent(id)}/`,
        idField: "id",
        displayField: "source_url",
        adminOnly: true,
        defaultPayload: {
          source_url: "",
          source_language: "en",
          brand_name: "",
          brand_slug: "",
        },
      },
    ],
  },
  {
    title: "Site",
    resources: [
      {
        id: "site-settings",
        label: "Site settings",
        description: "Maintenance mode and global toggles.",
        listPath: "api/admin/site-settings/",
        detailPath: (_id) => "api/admin/site-settings/",
        idField: "id",
        displayField: "id",
        adminOnly: true,
        single: true,
        defaultPayload: {
          maintenance_mode: false,
          maintenance_message: "",
        },
      },
    ],
  },
];

export default function AdminHubPage() {
  const router = useRouter();
  const { user, token, loading } = useAuth();

  const roleName = useMemo(() => user?.role?.name?.toLowerCase() ?? "user", [user]);
  const isAdmin = Boolean(user?.is_superuser || roleName === "admin" || (user?.is_staff && roleName !== "moderator"));
  const isModerator = Boolean(user?.is_staff || roleName === "moderator" || isAdmin);

  const availableResources = useMemo(() => {
    return resourceGroups.map((group) => ({
      ...group,
      resources: group.resources.filter((resource) => !resource.adminOnly || isAdmin),
    })).filter((group) => group.resources.length > 0);
  }, [isAdmin]);

  const initialResourceId = availableResources[0]?.resources[0]?.id ?? "";
  const [activeResourceId, setActiveResourceId] = useState(initialResourceId);
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editorValue, setEditorValue] = useState<string>("");
  const [loadingResource, setLoadingResource] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [roleMap, setRoleMap] = useState<Record<string, string | number>>({});

  const resource = useMemo(() => {
    for (const group of availableResources) {
      const found = group.resources.find((entry) => entry.id === activeResourceId);
      if (found) return found;
    }
    return availableResources[0]?.resources[0];
  }, [activeResourceId, availableResources]);

  useEffect(() => {
    if (!loading && user && !isModerator) {
      router.replace("/403");
    }
  }, [loading, user, isModerator, router]);

  useEffect(() => {
    if (!resource && availableResources[0]?.resources[0]?.id) {
      setActiveResourceId(availableResources[0].resources[0].id);
    }
  }, [availableResources, resource]);

  const fetchJson = useCallback(
    async (path: string, init?: RequestInit) => {
      if (!token) {
        throw new Error("Missing auth token.");
      }
      const response = await fetch(buildUrl(path), {
        ...init,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Token ${token}`,
          ...(init?.headers ?? {}),
        },
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Request failed with status ${response.status}`);
      }
      if (response.status === 204) {
        return null as unknown;
      }
      return (await response.json()) as unknown;
    },
    [token],
  );

  useEffect(() => {
    if (!token || !isAdmin) return;
    const loadRoles = async () => {
      try {
        const data = await fetchJson("api/admin/roles/");
        const list = Array.isArray(data)
          ? data
          : Array.isArray((data as { results?: unknown[] }).results)
            ? (data as { results: unknown[] }).results
            : [];
        const mapped: Record<string, string | number> = {};
        for (const entry of list as Array<{ id?: string | number; name?: string }>) {
          if (!entry?.name || entry.id === undefined || entry.id === null) continue;
          mapped[entry.name.toLowerCase()] = entry.id;
        }
        setRoleMap(mapped);
      } catch (err) {
        setRoleMap({});
      }
    };
    void loadRoles();
  }, [fetchJson, isAdmin, token]);

  const loadResource = useCallback(async () => {
    if (!resource) return;
    setLoadingResource(true);
    setError(null);
    setNotice(null);
    try {
      if (resource.single) {
        const data = (await fetchJson(resource.listPath)) as Record<string, unknown>;
        setItems(data ? [data] : []);
        const idValue = data?.[resource.idField] ? String(data[resource.idField]) : "singleton";
        setSelectedId(idValue);
        setEditorValue(JSON.stringify(data ?? resource.defaultPayload, null, 2));
      } else {
        const data = await fetchJson(resource.listPath);
        const list = Array.isArray(data) ? data : Array.isArray((data as { results?: unknown[] }).results) ? (data as { results: unknown[] }).results : [];
        setItems(list as Record<string, unknown>[]);
        const first = list[0] as Record<string, unknown> | undefined;
        if (first && first[resource.idField]) {
          const idValue = String(first[resource.idField]);
          setSelectedId(idValue);
          const detail = (await fetchJson(resource.detailPath(idValue))) as Record<string, unknown>;
          setEditorValue(JSON.stringify(detail, null, 2));
        } else {
          setSelectedId(null);
          setEditorValue(JSON.stringify(resource.defaultPayload, null, 2));
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load data.");
    } finally {
      setLoadingResource(false);
    }
  }, [fetchJson, resource]);

  useEffect(() => {
    if (!resource || !token) return;
    void loadResource();
  }, [loadResource, resource, token]);

  const handleSelect = useCallback(
    async (idValue: string) => {
      if (!resource) return;
      setSelectedId(idValue);
      setLoadingResource(true);
      setError(null);
      try {
        const detail = (await fetchJson(resource.detailPath(idValue))) as Record<string, unknown>;
        setEditorValue(JSON.stringify(detail, null, 2));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load record.");
      } finally {
        setLoadingResource(false);
      }
    },
    [fetchJson, resource],
  );

  const handleCreateNew = useCallback(() => {
    if (!resource) return;
    setSelectedId(null);
    setEditorValue(JSON.stringify(resource.defaultPayload, null, 2));
  }, [resource]);

  const handleSave = useCallback(async () => {
    if (!resource) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const parsed = JSON.parse(editorValue || "{}");
      if (selectedId && !resource.single) {
        const method = resource.updateMethod ?? "PATCH";
        await fetchJson(resource.detailPath(selectedId), {
          method,
          body: JSON.stringify(parsed),
        });
        setNotice("Saved changes.");
      } else {
        const targetPath = resource.single ? resource.listPath : resource.listPath;
        const method = resource.single ? "PATCH" : "POST";
        await fetchJson(targetPath, {
          method,
          body: JSON.stringify(parsed),
        });
        setNotice(resource.single ? "Settings updated." : "Created new record.");
      }
      await loadResource();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save record.");
    } finally {
      setSaving(false);
    }
  }, [editorValue, fetchJson, loadResource, resource, selectedId]);

  const handleDelete = useCallback(async () => {
    if (!resource || !selectedId || resource.single) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await fetchJson(resource.detailPath(selectedId), { method: "DELETE" });
      setNotice("Record deleted.");
      await loadResource();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete record.");
    } finally {
      setSaving(false);
    }
  }, [fetchJson, loadResource, resource, selectedId]);

  const handleSubmissionStatusUpdate = useCallback(
    async (nextStatus: "approved" | "rejected") => {
      if (!resource || resource.id !== "submissions" || !selectedId) return;
      setSaving(true);
      setError(null);
      setNotice(null);
      try {
        await fetchJson(resource.detailPath(selectedId), {
          method: "PATCH",
          body: JSON.stringify({ status: nextStatus }),
        });
        setNotice(nextStatus === "approved" ? "Submission approved." : "Submission declined.");
        await loadResource();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to update submission status.");
      } finally {
        setSaving(false);
      }
    },
    [fetchJson, loadResource, resource, selectedId]
  );
  const handleUserRoleUpdate = useCallback(
    async (target: "admin" | "moderator" | "user") => {
      if (!resource || resource.id !== "users" || !selectedId) return;
      setSaving(true);
      setError(null);
      setNotice(null);
      try {
        const adminRoleId = roleMap.admin;
        const moderatorRoleId = roleMap.moderator ?? roleMap.mod;
        const payload: Record<string, unknown> = {};

        if (target === "admin") {
          payload.is_staff = true;
          payload.is_superuser = true;
          if (adminRoleId !== undefined) payload.role_id = adminRoleId;
        } else if (target === "moderator") {
          payload.is_staff = true;
          payload.is_superuser = false;
          if (moderatorRoleId !== undefined) payload.role_id = moderatorRoleId;
        } else {
          payload.is_staff = false;
          payload.is_superuser = false;
          payload.role_id = null;
        }

        await fetchJson(resource.detailPath(selectedId), {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setNotice("User role updated.");
        await loadResource();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to update user role.");
      } finally {
        setSaving(false);
      }
    },
    [fetchJson, loadResource, resource, roleMap, selectedId],
  );

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-4xl rounded-3xl border border-rose-100 bg-white/90 p-8 shadow-lg">
        <div className="space-y-4">
          <div className="h-6 w-1/3 rounded-full bg-rose-100" />
          <div className="h-4 w-2/3 rounded-full bg-rose-50" />
          <div className="h-4 w-1/2 rounded-full bg-rose-50" />
        </div>
      </div>
    );
  }

  if (!user) {
    router.replace(`/login?next=${encodeURIComponent("/admin")}`);
    return (
      <div className="mx-auto w-full max-w-sm rounded-3xl border border-rose-100 bg-white/90 p-8 text-center shadow-lg">
        <p className="text-sm font-medium text-rose-600">Redirecting to login…</p>
      </div>
    );
  }

  if (!isModerator) {
    return (
      <div className="mx-auto w-full max-w-3xl rounded-3xl border border-rose-100 bg-white/90 p-8 text-center shadow-lg">
        <p className="text-sm font-medium text-rose-600">Checking admin access…</p>
      </div>
    );
  }

  return (
    <div className="relative left-1/2 right-1/2 -mx-[50vw] w-screen px-2 sm:px-3">
      <div className="flex w-full flex-col gap-6 px-0 lg:flex-row">
      <aside className="w-full rounded-2xl border border-rose-100 bg-white/90 p-4 shadow-lg lg:w-60">
        <div className="space-y-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-rose-400">Admin console</p>
            <h1 className="mt-2 text-2xl font-semibold text-rose-900">Jiraibrary control</h1>
            <p className="mt-2 text-xs text-rose-500">Signed in as {user.display_name || user.username}</p>
          </div>
          {availableResources.map((group) => (
            <div key={group.title}>
              <p className="text-xs font-semibold uppercase tracking-wide text-rose-300">{group.title}</p>
              <div className="mt-3 flex flex-col gap-2">
                {group.resources.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => setActiveResourceId(entry.id)}
                    className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${
                      entry.id === resource?.id
                        ? "border-rose-300 bg-rose-50 text-rose-900"
                        : "border-transparent text-rose-500 hover:border-rose-100 hover:bg-rose-50"
                    }`}
                  >
                    <span className="font-semibold">{entry.label}</span>
                    <span className="mt-1 block text-xs text-rose-400">{entry.description}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </aside>
      <main className="flex-1 space-y-6">
        <section className="rounded-3xl border border-rose-100 bg-white/95 p-6 shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-rose-400">{resource?.label ?? "Admin"}</p>
              <p className="text-sm text-rose-500">{resource?.description}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              {resource?.id === "users" && selectedId ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleUserRoleUpdate("admin")}
                    disabled={saving}
                    className="rounded-full border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 disabled:opacity-60"
                  >
                    Make admin
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUserRoleUpdate("moderator")}
                    disabled={saving}
                    className="rounded-full border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 disabled:opacity-60"
                  >
                    Make mod
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUserRoleUpdate("user")}
                    disabled={saving}
                    className="rounded-full border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 disabled:opacity-60"
                  >
                    Make user
                  </button>
                </div>
              ) : null}
              {!resource?.single ? (
                <button
                  type="button"
                  onClick={handleCreateNew}
                  className="rounded-full border border-rose-200 px-4 py-2 text-xs font-semibold text-rose-700"
                >
                  New record
                </button>
              ) : null}
                {resource?.id === "submissions" && selectedId ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleSubmissionStatusUpdate("approved")}
                      disabled={saving}
                      className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSubmissionStatusUpdate("rejected")}
                      disabled={saving}
                      className="rounded-full border border-rose-200 px-4 py-2 text-xs font-semibold text-rose-600 disabled:opacity-60"
                    >
                      Decline
                    </button>
                  </>
                ) : null}
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-full bg-rose-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save"}
              </button>
              {selectedId && !resource?.single ? (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={saving}
                  className="rounded-full border border-rose-200 px-4 py-2 text-xs font-semibold text-rose-600 disabled:opacity-60"
                >
                  Delete
                </button>
              ) : null}
            </div>
          </div>
          {error ? (
            <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-600">{error}</p>
          ) : null}
          {notice ? (
            <p className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs text-emerald-600">{notice}</p>
          ) : null}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_1.9fr]">
          <div className="rounded-3xl border border-rose-100 bg-white/95 p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-rose-900">Records</p>
              <span className="text-xs text-rose-400">{loadingResource ? "Loading…" : `${items.length} found`}</span>
            </div>
            <div className="mt-4 max-h-[460px] space-y-2 overflow-auto">
              {items.map((item, index) => {
                const idValue = item[resource?.idField ?? "id"] ? String(item[resource?.idField ?? "id"]) : "";
                const display = item[resource?.displayField ?? "id"] ? String(item[resource?.displayField ?? "id"]) : idValue;
                const key = idValue ? `${idValue}-${index}` : `row-${index}`;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => idValue && handleSelect(idValue)}
                    className={`w-full rounded-2xl border px-4 py-3 text-left text-sm transition ${
                      idValue === selectedId
                        ? "border-rose-300 bg-rose-50 text-rose-900"
                        : "border-transparent text-rose-600 hover:border-rose-100 hover:bg-rose-50"
                    }`}
                  >
                    <span className="font-semibold">{display}</span>
                    <span className="mt-1 block text-xs text-rose-400">{idValue}</span>
                  </button>
                );
              })}
              {!items.length ? (
                <p className="text-xs text-rose-400">No records found for this resource.</p>
              ) : null}
            </div>
          </div>
          <div className="rounded-3xl border border-rose-100 bg-white/95 p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-rose-900">Editor</p>
              <span className="text-xs text-rose-400">JSON payload</span>
            </div>
            <p className="mt-2 text-xs text-rose-500">
              Edit the raw JSON payload to update every field. For new records, use the template below and hit Save.
            </p>
            <textarea
              value={editorValue}
              onChange={(event) => setEditorValue(event.target.value)}
              className="mt-4 h-[460px] w-full rounded-2xl border border-rose-100 bg-rose-50/50 px-4 py-3 text-xs text-rose-900 outline-none focus:border-rose-300"
              spellCheck={false}
            />
          </div>
        </section>
      </main>
    </div>
    </div>
  );
}
