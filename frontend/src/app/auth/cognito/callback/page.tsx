"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/auth-provider";

type CallbackState =
  | { status: "loading"; message?: string }
  | { status: "error"; message: string };

const PKCE_VERIFIER_KEY_PREFIX = "jiraibrary.pkce.verifier.";
const OAUTH_NEXT_KEY_PREFIX = "jiraibrary.oauth.next.";

function safeNext(value: string | null): string {
  if (!value) return "/profile";
  if (!value.startsWith("/") || value.startsWith("//")) return "/profile";
  return value;
}

function readFromSession(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function removeFromSession(key: string): void {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export default function CognitoCallbackPage() {
  const router = useRouter();
  const { applyAuth } = useAuth();

  const [state, setState] = useState<CallbackState>({ status: "loading" });

  const params = useMemo(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search);
  }, []);

  useEffect(() => {
    if (!params) return;

    const error = params.get("error");
    const errorDescription = params.get("error_description");
    const code = params.get("code");
    const oauthState = params.get("state");

    if (error) {
      setState({
        status: "error",
        message: errorDescription ? `${error}: ${errorDescription}` : error,
      });
      return;
    }

    if (!code || !oauthState) {
      setState({ status: "error", message: "Missing authorization code." });
      return;
    }

    const verifierKey = `${PKCE_VERIFIER_KEY_PREFIX}${oauthState}`;
    const nextKey = `${OAUTH_NEXT_KEY_PREFIX}${oauthState}`;

    const verifier = readFromSession(verifierKey);
    const next = safeNext(readFromSession(nextKey));

    removeFromSession(verifierKey);
    removeFromSession(nextKey);

    if (!verifier) {
      setState({ status: "error", message: "Missing PKCE verifier. Please try signing in again." });
      return;
    }

    const run = async () => {
      try {
        setState({ status: "loading", message: "Finishing sign in…" });

        const response = await fetch("/api/auth/cognito/hosted/token", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ code, code_verifier: verifier }),
          cache: "no-store",
        });

        const text = await response.text();
        if (!response.ok) {
          throw new Error(text || `Sign in failed (${response.status})`);
        }

        const auth = JSON.parse(text) as { token: string; user: unknown };
        applyAuth(auth as any);
        router.replace(next);
      } catch (err) {
        setState({
          status: "error",
          message: err instanceof Error ? err.message : "Unable to finish signing in.",
        });
      }
    };

    void run();
  }, [applyAuth, params, router]);

  if (state.status === "error") {
    return (
      <div className="mx-auto w-full max-w-md rounded-3xl border border-rose-100 bg-white/90 p-8 shadow-lg">
        <h1 className="text-2xl font-semibold text-rose-900">Sign-in failed</h1>
        <p className="mt-3 text-sm text-rose-600">{state.message}</p>
        <button
          type="button"
          className="mt-6 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white"
          onClick={() => router.replace("/login")}
        >
          Back to login
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md rounded-3xl border border-rose-100 bg-white/90 p-8 text-center shadow-lg">
      <p className="text-sm font-medium text-rose-600">{state.message ?? "Completing sign in…"}</p>
    </div>
  );
}
