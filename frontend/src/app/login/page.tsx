"use client";

import { CredentialResponse, GoogleLogin } from "@react-oauth/google";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { useAuth } from "@/components/auth-provider";

export default function LoginPage() {
  const router = useRouter();
  const { login, loginWithGoogle, loading, user } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [googlePending, setGooglePending] = useState(false);

  useEffect(() => {
    if (user) {
      router.replace("/add-entry");
    }
  }, [router, user]);

  if (user) {
    return (
      <div className="mx-auto w-full max-w-md rounded-3xl border border-rose-100 bg-white/90 p-8 text-center shadow-lg">
        <p className="text-sm font-medium text-rose-600">Redirecting to Add Entry…</p>
      </div>
    );
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      await login(identifier, password);
      router.push("/add-entry");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to login. Please try again.");
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
      router.push("/add-entry");
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
      <h1 className="text-2xl font-semibold text-rose-900">Login</h1>
      <p className="mt-2 text-sm text-rose-500">
        Use your Jiraibrary credentials to access favorites and submit new entries.
      </p>
      <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit}>
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
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        <button
          type="submit"
          disabled={pending || loading || googlePending}
          className="mt-2 rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending || loading ? "Signing in…" : "Login"}
        </button>
      </form>
      {process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ? (
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
              width="100%"
            />
          </div>
        </div>
      ) : null}
      <div className="mt-6 text-xs text-rose-500">
        <p>
          Need an account? Ask an administrator to invite you. Admin panel is available at
          {" "}
          <Link href="/admin/" className="font-semibold text-rose-700 hover:text-rose-900">
            /admin
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
