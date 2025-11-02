"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import {
  CreateSubmissionPayload,
  ItemSubmissionPayload,
  createSubmission,
  listSubmissions,
} from "@/lib/api";

const initialForm: CreateSubmissionPayload = {
  title: "",
  brand_name: "",
  description: "",
  reference_url: "",
  image_url: "",
  tags: [],
};

export default function AddEntryPage() {
  const { user, token, loading, refresh } = useAuth();
  const [form, setForm] = useState<CreateSubmissionPayload>(initialForm);
  const [pending, setPending] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<ItemSubmissionPayload[]>([]);

  useEffect(() => {
    if (!token) {
      setSubmissions([]);
      return;
    }
    let active = true;
    const load = async () => {
      try {
        const data = await listSubmissions(token);
        if (active) {
          setSubmissions(data);
        }
      } catch (error) {
        console.error("Failed to load submissions", error);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [token]);

  if (!user && !loading) {
    return (
      <div className="mx-auto max-w-2xl rounded-3xl border border-rose-100 bg-white/90 p-8 text-center shadow-lg">
        <h1 className="text-2xl font-semibold text-rose-900">Add Entry</h1>
        <p className="mt-3 text-sm text-rose-500">
          Please
          {" "}
          <Link
            href="/login?next=%2Fadd-entry"
            className="font-semibold text-rose-700 hover:text-rose-900"
          >
            login
          </Link>
          {" "}
          to submit new Jiraibrary catalog entries.
        </p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl rounded-3xl border border-rose-100 bg-white/90 p-8 text-center shadow-lg">
        <p className="text-sm text-rose-500">Loading account details…</p>
      </div>
    );
  }

  const handleChange = (field: keyof CreateSubmissionPayload) => (value: string) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const handleTagsChange = (value: string) => {
    const tags = value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    setForm((previous) => ({
      ...previous,
      tags,
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) {
      setErrorMessage("You must be logged in to submit an entry.");
      return;
    }
    setErrorMessage(null);
    setSuccessMessage(null);
    setPending(true);
    try {
      const payload: CreateSubmissionPayload = {
        ...form,
        description: form.description?.trim() || "",
        reference_url: form.reference_url?.trim() || "",
        image_url: form.image_url?.trim() || "",
      };
      await createSubmission(token, payload);
      setForm(initialForm);
      setSuccessMessage("Submission received! We'll review it shortly.");
      const updated = await listSubmissions(token);
      setSubmissions(updated);
      await refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to submit entry.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <section className="rounded-3xl border border-rose-100 bg-white/95 p-8 shadow-lg">
        <h1 className="text-3xl font-semibold text-rose-900">Add a catalog entry</h1>
        <p className="mt-2 text-sm text-rose-500">
          Provide as much detail as possible so curators can review and publish your entry.
        </p>
        <form className="mt-6 flex flex-col gap-5" onSubmit={handleSubmit}>
          <label className="flex flex-col gap-2 text-sm font-medium text-rose-600">
            Title
            <input
              className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-slate-700 shadow-sm focus:border-rose-400 focus:outline-none"
              value={form.title}
              onChange={(event) => handleChange("title")(event.target.value)}
              required
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium text-rose-600">
            Brand name
            <input
              className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-slate-700 shadow-sm focus:border-rose-400 focus:outline-none"
              value={form.brand_name}
              onChange={(event) => handleChange("brand_name")(event.target.value)}
              required
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium text-rose-600">
            Description
            <textarea
              className="min-h-[140px] rounded-xl border border-rose-200 bg-white px-3 py-2 text-slate-700 shadow-sm focus:border-rose-400 focus:outline-none"
              value={form.description}
              onChange={(event) => handleChange("description")(event.target.value)}
              placeholder="Describe notable details, motifs, fabrics, references..."
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium text-rose-600">
            Reference URL
            <input
              type="url"
              className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-slate-700 shadow-sm focus:border-rose-400 focus:outline-none"
              value={form.reference_url}
              onChange={(event) => handleChange("reference_url")(event.target.value)}
              placeholder="https://"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium text-rose-600">
            Image URL
            <input
              type="url"
              className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-slate-700 shadow-sm focus:border-rose-400 focus:outline-none"
              value={form.image_url}
              onChange={(event) => handleChange("image_url")(event.target.value)}
              placeholder="https://"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium text-rose-600">
            Tags (comma separated)
            <input
              className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-slate-700 shadow-sm focus:border-rose-400 focus:outline-none"
              value={form.tags?.join(", ") ?? ""}
              onChange={(event) => handleTagsChange(event.target.value)}
              placeholder="sweet, hime, bow"
            />
          </label>
          {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}
          {successMessage ? <p className="text-sm text-emerald-600">{successMessage}</p> : null}
          <button
            type="submit"
            disabled={pending}
            className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "Submitting…" : "Submit entry"}
          </button>
        </form>
      </section>
      <aside className="flex flex-col gap-4">
        <div className="rounded-3xl border border-rose-100 bg-white/95 p-6 shadow-lg">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-rose-500">
            Submission history
          </h2>
          {submissions.length === 0 ? (
            <p className="mt-3 text-sm text-rose-500">No submissions yet. Start by completing the form.</p>
          ) : (
            <ul className="mt-4 flex flex-col gap-3">
              {submissions.map((submission) => (
                <li
                  key={submission.id}
                  className="rounded-2xl border border-rose-100 bg-white/90 p-4 shadow-sm"
                >
                  <p className="text-sm font-semibold text-rose-900">{submission.title}</p>
                  <p className="text-xs uppercase tracking-wide text-rose-400">
                    {submission.status.replace(/_/g, " ")}
                  </p>
                  {submission.moderator_notes ? (
                    <p className="mt-2 text-xs text-rose-500">{submission.moderator_notes}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-3xl border border-rose-100 bg-white/95 p-6 text-sm text-rose-500 shadow-lg">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-rose-500">
            Tips
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>Include official sources whenever possible.</li>
            <li>Add reference imagery links for colorways or release announcements.</li>
            <li>Use tags to suggest styles, motifs, or fabrics for reviewers.</li>
          </ul>
        </div>
      </aside>
    </div>
  );
}
