import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center rounded-3xl border border-rose-100 bg-white/90 px-8 py-16 text-center shadow-lg">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-400">403</p>
      <h1 className="mt-3 text-3xl font-semibold text-rose-900">Access denied</h1>
      <p className="mt-4 text-sm text-rose-500">
        You need elevated permissions to view that page. Ask an administrator to grant you access or head back to the catalog.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href="/" className="rounded-full border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:text-rose-900">
          Go home
        </Link>
        <Link href="/profile" className="rounded-full border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:text-rose-900">
          Profile
        </Link>
      </div>
    </div>
  );
}
