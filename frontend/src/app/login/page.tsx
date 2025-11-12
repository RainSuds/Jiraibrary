"use client";

import { CredentialResponse, GoogleLogin } from "@react-oauth/google";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { API_BASE } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const nextRoute = useMemo(() => {
    try {
      if (typeof window === "undefined") return "/profile";
      const params = new URLSearchParams(window.location.search);
      const raw = params.get("next") ?? "/profile";
      if (!raw.startsWith("/") || raw.startsWith("//")) {
        return "/profile";
      }
      return raw;
    } catch {
      return "/profile";
    }
  }, []);

  const { login, loginWithGoogle, register, loading, user } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [registerUsername, setRegisterUsername] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerDisplayName, setRegisterDisplayName] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [googlePending, setGooglePending] = useState(false);

  useEffect(() => {
    if (user) {
      router.replace(nextRoute);
    }
  }, [router, user, nextRoute]);

  if (user) {
    return (
      <div className="mx-auto w-full max-w-md rounded-3xl border border-rose-100 bg-white/90 p-8 text-center shadow-lg">
        <p className="text-sm font-medium text-rose-600">Redirecting to your profile…</p>
      </div>
    );
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      if (mode === "login") {
        await login(identifier, password);
      } else {
        if (registerPassword !== registerConfirmPassword) {
          throw new Error("Passwords do not match.");
        }
        await register({
          username: registerUsername,
          email: registerEmail,
          password: registerPassword,
          displayName: registerDisplayName.trim() || undefined,
        });
      }
      router.push(nextRoute);
    } catch (err) {
      const fallback = mode === "login" ? "Unable to login. Please try again." : "Unable to register. Please try again.";
      setError(err instanceof Error ? err.message : fallback);
    } finally {
      setPending(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    if (!credentialResponse.credential) {
      setError("Google login failed. Please try again.");
      return;
    }
    setError(null);
    setGooglePending(true);
    try {
      await loginWithGoogle(credentialResponse.credential);
      router.push(nextRoute);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to login with Google. Please try again.");
    } finally {
      setGooglePending(false);
    }
  };

  const handleGoogleError = () => {
    setError("Google sign-in was unsuccessful. Please try again.");
  };

  return (
    <div className="mx-auto w-full max-w-md rounded-3xl border border-rose-100 bg-white/90 p-8 shadow-lg">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-rose-900">
          {mode === "login" ? "Login" : "Create an account"}
        </h1>
        <button
          type="button"
          className="text-xs font-semibold text-rose-500 underline-offset-2 hover:underline"
          onClick={() => {
            setMode((current) => (current === "login" ? "register" : "login"));
            setError(null);
          }}
        >
          {mode === "login" ? "Need an account? Register" : "Already registered? Login"}
        </button>
      </div>
      <p className="mt-2 text-sm text-rose-500">
        {mode === "login"
          ? "Use your Jiraibrary credentials to access favorites and submit new entries."
          : "Sign up to save favorites, submit new entries, and personalize your profile."}
      </p>
      <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit}>
        {mode === "login" ? (
          <>
            <label className="flex flex-col gap-2 text-sm font-medium text-rose-600">
              Username or email
              <input
                className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-slate-700 shadow-sm focus:border-rose-400 focus:outline-none"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                required
                autoComplete="username"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-rose-600">
              Password
              <input
                type="password"
                className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-slate-700 shadow-sm focus:border-rose-400 focus:outline-none"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                autoComplete="current-password"
              />
            </label>
          </>
        ) : (
          <>
            <label className="flex flex-col gap-2 text-sm font-medium text-rose-600">
              Username
              <input
                className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-slate-700 shadow-sm focus:border-rose-400 focus:outline-none"
                value={registerUsername}
                onChange={(event) => setRegisterUsername(event.target.value)}
                required
                autoComplete="username"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-rose-600">
              Email
              <input
                type="email"
                className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-slate-700 shadow-sm focus:border-rose-400 focus:outline-none"
                value={registerEmail}
                onChange={(event) => setRegisterEmail(event.target.value)}
                required
                autoComplete="email"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-rose-600">
              Display name (optional)
              <input
                className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-slate-700 shadow-sm focus:border-rose-400 focus:outline-none"
                value={registerDisplayName}
                onChange={(event) => setRegisterDisplayName(event.target.value)}
                placeholder="How other users will see you"
                autoComplete="nickname"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-rose-600">
              Password
              <input
                type="password"
                className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-slate-700 shadow-sm focus:border-rose-400 focus:outline-none"
                value={registerPassword}
                onChange={(event) => setRegisterPassword(event.target.value)}
                required
                autoComplete="new-password"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-rose-600">
              Confirm password
              <input
                type="password"
                className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-slate-700 shadow-sm focus:border-rose-400 focus:outline-none"
                value={registerConfirmPassword}
                onChange={(event) => setRegisterConfirmPassword(event.target.value)}
                required
                autoComplete="new-password"
              />
            </label>
          </>
        )}
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        <button
          type="submit"
          disabled={pending || loading || (mode === "login" && googlePending)}
          className="mt-2 rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending || loading
            ? mode === "login" ? "Signing in…" : "Creating account…"
            : mode === "login" ? "Login" : "Register"}
        </button>
      </form>
      {process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && mode === "login" ? (
        <div className="mt-6 flex flex-col items-center gap-4">
          <div className="flex w-full items-center gap-3 text-xs text-rose-400">
            <span className="h-px flex-1 bg-rose-100" aria-hidden="true" />
            or
            <span className="h-px flex-1 bg-rose-100" aria-hidden="true" />
          </div>
          <div className={`w-full ${googlePending ? "pointer-events-none opacity-70" : ""}`}>
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={handleGoogleError}
              useOneTap={false}
              theme="outline"
            />
          </div>
        </div>
      ) : null}
      <div className="mt-6 text-xs text-rose-500">
        {mode === "login" ? (
          <p>
            Need an account? Switch to the registration form above to get started. Admin panel remains available at
            {" "}
            <Link
              href={`${API_BASE}admin/`}
              className="font-semibold text-rose-700 hover:text-rose-900"
              prefetch={false}
              rel="noreferrer"
              target="_blank"
            >
              Jiraibrary Admin
            </Link>
            .
          </p>
        ) : (
          <p>
            Already have access? Toggle back to the login form to sign in with your credentials or Google account.
          </p>
        )}
      </div>
    </div>
  );
}
