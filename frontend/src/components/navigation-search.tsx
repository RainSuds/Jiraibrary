type NavigationSearchProps = {
  initialQuery?: string;
  className?: string;
};

export default function NavigationSearch({
  initialQuery = "",
  className = "",
}: NavigationSearchProps) {
  return (
    <form
      action="/search"
      method="get"
      role="search"
      className={`flex w-full items-center gap-2 rounded-full border border-rose-200 bg-white/85 px-3 py-1 text-sm text-rose-700 shadow-sm transition focus-within:border-rose-300 focus-within:ring-2 focus-within:ring-rose-100 ${className}`.trim()}
    >
      <label className="sr-only" htmlFor="nav-catalog-search">
        Search catalog
      </label>
      <svg
        aria-hidden="true"
        className="h-4 w-4 text-rose-400"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="2" />
        <path d="m16.5 16.5 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <input
        id="nav-catalog-search"
        type="search"
        name="q"
        defaultValue={initialQuery}
        placeholder="Search catalog"
        className="flex-1 bg-transparent text-sm text-rose-900 placeholder:text-rose-300 focus:outline-none"
      />
      <button
        type="submit"
        className="rounded-full bg-rose-600 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-rose-500"
      >
        Go
      </button>
    </form>
  );
}
