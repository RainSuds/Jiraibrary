import Link from "next/link";

import SearchBar from "@/components/search-bar";
import { getBrandList } from "@/lib/api";

function formatItemCount(count: number): string {
  if (count === 1) {
    return "1 item";
  }
  return `${count.toLocaleString()} items`;
}

export default async function Home() {
  const { results: brands } = await getBrandList();

  return (
    <div className="flex flex-col gap-12">
      <section className="flex flex-col gap-6 text-center sm:text-left">
        <span className="text-sm font-semibold uppercase tracking-[0.3em] text-rose-500">
          Jirai Kei archive
        </span>
        <h1 className="text-4xl font-semibold tracking-tight text-rose-900 sm:text-5xl">
          Explore the Jiraibrary catalog
        </h1>
        <p className="mx-auto max-w-2xl text-lg leading-relaxed text-slate-600 sm:mx-0">
          Browse curated Jirai Kei fashion references, search by brand, tag, or collection,
          and deep dive into detailed item metadata compiled for researchers and fans.
        </p>
        <div className="mx-auto w-full max-w-2xl sm:mx-0">
          <SearchBar />
        </div>
      </section>

      <section className="flex flex-col gap-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-rose-900">Featured brands</h2>
            <p className="text-sm text-rose-500">
              Click a brand to jump directly into filtered search results.
            </p>
          </div>
          <Link
            href="/search"
            className="text-sm font-medium text-rose-600 transition hover:text-rose-800"
          >
            Explore the catalog →
          </Link>
        </div>

        {brands.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {brands.map((brand) => (
              <Link
                key={brand.slug}
                href={`/search?brand=${encodeURIComponent(brand.slug)}`}
                className="group flex items-center gap-4 rounded-2xl border border-rose-100 bg-white/90 p-5 shadow-sm transition hover:-translate-y-1 hover:border-rose-200 hover:shadow-lg"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-lg font-semibold text-rose-600">
                  {brand.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-lg font-semibold text-rose-900 group-hover:text-rose-700">
                    {brand.name}
                  </span>
                  <span className="text-sm text-slate-500">
                    {formatItemCount(brand.item_count)}
                    {brand.country ? ` • ${brand.country}` : ""}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-rose-100 bg-white/90 p-6 text-sm text-rose-600">
            Seed data has not been loaded yet. Run <code>python manage.py seed_catalog</code> to populate the catalog.
          </p>
        )}
      </section>
    </div>
  );
}
