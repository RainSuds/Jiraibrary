type SearchBarProps = {
  initialQuery?: string;
  className?: string;
};

export default function SearchBar({
  initialQuery = "",
  className = "",
}: SearchBarProps) {
  return (
    <form
      action="/search"
      method="get"
      role="search"
      className={`flex w-full items-stretch gap-3 rounded-full border border-rose-200 bg-white/90 p-2 shadow-sm transition hover:shadow-lg ${className}`.trim()}
    >
      <label className="sr-only" htmlFor="catalog-search">
        Search catalog
      </label>
      <input
        id="catalog-search"
        type="search"
        name="q"
        defaultValue={initialQuery}
        placeholder="Search items, brands, tags..."
        className="flex-1 rounded-full border-none bg-transparent px-4 py-2 text-base text-rose-900 outline-none placeholder:text-rose-300"
      />
      <button
        type="submit"
        className="rounded-full bg-rose-600 px-6 py-2 text-sm font-medium text-white transition hover:bg-rose-500"
      >
        Search
      </button>
    </form>
  );
}
