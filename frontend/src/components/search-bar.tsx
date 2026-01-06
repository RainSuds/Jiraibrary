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
      className={`flex w-full items-center gap-3 rounded-full border border-rose-200 bg-white/90 px-4 py-2 shadow-sm transition hover:shadow-lg ${className}`.trim()}
    >
      <label className="sr-only" htmlFor="catalog-search">
        Search catalog
      </label>
      <span aria-hidden="true" className="text-rose-400">
        <svg
          className="h-5 w-5"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="2" />
          <path d="m16.5 16.5 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </span>
      <input
        id="catalog-search"
        type="search"
        name="q"
        defaultValue={initialQuery}
        placeholder="Search items, brands, tags..."
        className="flex-1 border-none bg-transparent text-base text-rose-900 outline-none placeholder:text-rose-300"
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
