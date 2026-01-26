import Link from "next/link";

const DISCORD_INVITE_URL = "https://discord.gg/dKgrxsMZKK";

export default function SupportPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10">
      <header className="rounded-3xl border border-rose-100 bg-white/90 p-8 shadow-lg">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-rose-500">Support</p>
        <h1 className="mt-3 text-3xl font-semibold text-rose-900">Need a hand?</h1>
        <p className="mt-3 text-sm text-rose-500">
          We&apos;re here to help with catalog submissions, account access, and general Jiraibrary questions.
        </p>
      </header>

      <section className="rounded-3xl border border-rose-100 bg-white/95 p-8 shadow-lg">
        <h2 className="text-xl font-semibold text-rose-900">Community support</h2>
        <p className="mt-2 text-sm text-rose-500">
          Join the Discord to get quick answers, share feedback, or report issues with the catalog.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <a
            href={DISCORD_INVITE_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 127.14 96.36"
              className="h-4 w-4"
              fill="currentColor"
            >
              <path d="M107.7 8.07A105.15 105.15 0 0 0 81.47 0a72.06 72.06 0 0 0-3.36 6.83A97.68 97.68 0 0 0 49 6.83 72.37 72.37 0 0 0 45.64 0 105.89 105.89 0 0 0 19.39 8.09C2.79 32.65-1.71 56.6.54 80.23a105.73 105.73 0 0 0 32.22 16.13 77.7 77.7 0 0 0 6.89-11.2 68.42 68.42 0 0 1-10.87-5.18c.91-.66 1.8-1.36 2.65-2.07a75.57 75.57 0 0 0 64.32 0c.86.71 1.74 1.41 2.65 2.07a68.68 68.68 0 0 1-10.87 5.19 77 77 0 0 0 6.89 11.2 105.25 105.25 0 0 0 32.22-16.13c2.64-27.4-4.55-51.2-18.74-72.16ZM42.45 65.69C36.18 65.69 31 60 31 52.93s5-12.74 11.45-12.74S54 45.86 54 52.93s-5 12.76-11.55 12.76Zm42.24 0C78.41 65.69 73 60 73 52.93s5-12.74 11.45-12.74S96 45.86 96 52.93s-5 12.76-11.31 12.76Z" />
            </svg>
            Join Discord
          </a>
          <Link
            href="/"
            className="rounded-full border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:text-rose-900"
          >
            Back to home
          </Link>
        </div>
      </section>
    </main>
  );
}
