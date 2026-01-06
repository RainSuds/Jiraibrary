"use client";

import { CredentialResponse, GoogleLogin } from "@react-oauth/google";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { ApiError } from "@/lib/api";
import { API_BASE } from "@/lib/api";

const PKCE_VERIFIER_KEY_PREFIX = "jiraibrary.pkce.verifier.";
const OAUTH_NEXT_KEY_PREFIX = "jiraibrary.oauth.next.";

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function sha256Base64Url(value: string): Promise<string> {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return base64UrlEncode(new Uint8Array(digest));
}

async function sha256Hex(value: string): Promise<string> {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  const bytes = new Uint8Array(digest);
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function randomStringBase64Url(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

function randomAlphanumeric(length = 8): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const byte of bytes) {
    out += alphabet[byte % alphabet.length];
  }
  return out;
}

function safeNextRoute(raw: string): string {
  if (!raw.startsWith("/") || raw.startsWith("//")) {
    return "/profile";
  }
  return raw;
}

function writeSessionStorage(key: string, value: string): void {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

function usernameFromEmail(email: string): string {
  const localPart = email.split("@", 1)[0] ?? "";
  const normalized = localPart
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return (normalized || "user").slice(0, 150);
}

async function cognitoUsernameFromEmail(email: string): Promise<string> {
  // Cognito pools configured with email aliases typically disallow email-formatted usernames.
  // Use a deterministic suffix so confirm/resend works across retries.
  const base = usernameFromEmail(email);
  const suffix = (await sha256Hex(email)).slice(0, 10);
  const combined = `${base}-${suffix}`;
  return combined.slice(0, 150);
}

export default function LoginPage() {
  const router = useRouter();
  const nextRoute = useMemo(() => {
    try {
      if (typeof window === "undefined") return "/profile";
      const params = new URLSearchParams(window.location.search);
      const raw = params.get("next") ?? "/profile";
      return safeNextRoute(raw);
    } catch {
      return "/profile";
    }
  }, []);

  const { login, loginWithGoogle, register, loading, user } = useAuth();
  const authProvider = (process.env.NEXT_PUBLIC_AUTH_PROVIDER ?? "").toLowerCase();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [googlePending, setGooglePending] = useState(false);
  const [cognitoConfirmationRequired, setCognitoConfirmationRequired] = useState(false);
  const [cognitoConfirmationCode, setCognitoConfirmationCode] = useState("");
  const [cognitoSignupUsername, setCognitoSignupUsername] = useState("");

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
        const normalizedEmail = identifier.trim().toLowerCase();
        if (authProvider === "cognito" && (!normalizedEmail || !normalizedEmail.includes("@"))) {
          throw new Error("Please enter the email you used to sign up.");
        }

        if (authProvider === "cognito") {
          if (cognitoConfirmationRequired) {
            const loginEmail = normalizedEmail;
            const signupUsername = cognitoSignupUsername || (await cognitoUsernameFromEmail(loginEmail));
            if (!cognitoSignupUsername) {
              setCognitoSignupUsername(signupUsername);
            }
            const confirmResponse = await fetch("/api/auth/cognito/confirm", {
              method: "POST",
              headers: { "Content-Type": "application/json", Accept: "application/json" },
              body: JSON.stringify({ username: signupUsername, code: cognitoConfirmationCode }),
            });
            const confirmPayload = (await confirmResponse.json()) as { success?: boolean; error?: string };
            if (!confirmResponse.ok) {
              throw new Error(confirmPayload.error || "Unable to confirm your account. Please try again.");
            }
            setCognitoConfirmationRequired(false);
            setCognitoConfirmationCode("");
          }

          try {
            await login(normalizedEmail || identifier, password);
            router.push(nextRoute);
            return;
          } catch (err) {
            if (err instanceof ApiError) {
              const payload = err.payload;
              if (
                payload &&
                typeof payload === "object" &&
                "code" in payload &&
                (payload as { code?: unknown }).code === "USER_NOT_CONFIRMED"
              ) {
                setCognitoConfirmationRequired(true);
                setCognitoConfirmationCode("");
                setCognitoSignupUsername("");
                throw new Error(
                  "Your account isn't verified yet. Enter the confirmation code from your email, or resend it."
                );
              }
            }

            const message = err instanceof Error ? err.message : String(err);
            // If this Cognito app client doesn't allow USER_PASSWORD_AUTH, fall back to Hosted UI.
            if (message.toLowerCase().includes("user_password_auth") || message.toLowerCase().includes("flow not enabled")) {
              await startCognitoHostedLogin(normalizedEmail || identifier);
              return;
            }
            throw err;
          }
        }
        await login(normalizedEmail || identifier, password);
      } else {
        if (registerPassword !== registerConfirmPassword) {
          throw new Error("Passwords do not match.");
        }

        const normalizedEmail = registerEmail.trim().toLowerCase();
        if (!normalizedEmail) {
          throw new Error("Email is required.");
        }

        if (authProvider === "cognito") {
          if (!cognitoConfirmationRequired) {
            const signupUsername = await cognitoUsernameFromEmail(normalizedEmail);
            setCognitoSignupUsername(signupUsername);
            const signupResponse = await fetch("/api/auth/cognito/signup", {
              method: "POST",
              headers: { "Content-Type": "application/json", Accept: "application/json" },
              body: JSON.stringify({
                username: signupUsername,
                email: normalizedEmail,
                password: registerPassword,
              }),
            });
            const signupPayload = (await signupResponse.json()) as { nextStep?: string; error?: string };
            if (!signupResponse.ok) {
              const message = signupPayload.error || "Unable to register. Please try again.";
              if (message.toLowerCase().includes("already exists")) {
                setCognitoConfirmationRequired(true);
                setCognitoConfirmationCode("");
                throw new Error("An account with the email already exists. Enter the confirmation code or resend it.");
              }
              throw new Error(message);
            }
            if (signupPayload.nextStep === "CONFIRM_SIGN_UP") {
              setCognitoConfirmationRequired(true);
              setCognitoConfirmationCode("");
              throw new Error("Enter the confirmation code sent to your email to finish creating your account.");
            }
          } else {
            const signupUsername = cognitoSignupUsername || (await cognitoUsernameFromEmail(normalizedEmail));
            if (!cognitoSignupUsername) {
              setCognitoSignupUsername(signupUsername);
            }
            const confirmResponse = await fetch("/api/auth/cognito/confirm", {
              method: "POST",
              headers: { "Content-Type": "application/json", Accept: "application/json" },
              body: JSON.stringify({ username: signupUsername, code: cognitoConfirmationCode }),
            });
            const confirmPayload = (await confirmResponse.json()) as { success?: boolean; error?: string };
            if (!confirmResponse.ok) {
              throw new Error(confirmPayload.error || "Unable to confirm your account. Please try again.");
            }
            try {
              await login(normalizedEmail, registerPassword);
              router.push(nextRoute);
              return;
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err);
              if (message.toLowerCase().includes("user_password_auth") || message.toLowerCase().includes("flow not enabled")) {
                await startCognitoHostedLogin(normalizedEmail);
                return;
              }
              throw err;
            }
          }
        } else {
          await register({
            username: usernameFromEmail(normalizedEmail),
            email: normalizedEmail,
            password: registerPassword,
          });
        }
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

  const startCognitoHostedLogin = async (loginHint?: string) => {
    setError(null);
    setPending(true);
    try {
      const verifier = randomStringBase64Url(64);
      const challenge = await sha256Base64Url(verifier);
      const stateValue = randomStringBase64Url(32);

      writeSessionStorage(`${PKCE_VERIFIER_KEY_PREFIX}${stateValue}`, verifier);
      writeSessionStorage(`${OAUTH_NEXT_KEY_PREFIX}${stateValue}`, nextRoute);

      const redirect = new URL("/api/auth/cognito/hosted/login", window.location.origin);
      redirect.searchParams.set("challenge", challenge);
      redirect.searchParams.set("state", stateValue);
      if (loginHint && loginHint.trim()) {
        redirect.searchParams.set("login_hint", loginHint.trim());
      }

      window.location.assign(redirect.toString());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start sign-in.");
      setPending(false);
    }
  };

  const startCognitoGoogleLogin = async () => {
    setError(null);
    setGooglePending(true);
    try {
      const verifier = randomStringBase64Url(64);
      const challenge = await sha256Base64Url(verifier);
      const stateValue = randomStringBase64Url(32);

      writeSessionStorage(`${PKCE_VERIFIER_KEY_PREFIX}${stateValue}`, verifier);
      writeSessionStorage(`${OAUTH_NEXT_KEY_PREFIX}${stateValue}`, nextRoute);

      const redirect = new URL("/api/auth/cognito/hosted/google", window.location.origin);
      redirect.searchParams.set("challenge", challenge);
      redirect.searchParams.set("state", stateValue);

      window.location.assign(redirect.toString());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start Google sign-in.");
      setGooglePending(false);
    }
  };

  const resendCognitoConfirmationCode = async () => {
    setError(null);
    setPending(true);
    try {
      const normalizedEmail = (mode === "login" ? identifier : registerEmail).trim().toLowerCase();
      if (!normalizedEmail) {
        throw new Error("Email is required.");
      }
      const signupUsername = cognitoSignupUsername || (await cognitoUsernameFromEmail(normalizedEmail));
      if (!cognitoSignupUsername) {
        setCognitoSignupUsername(signupUsername);
      }

      const attempt = async (username: string) => {
        const response = await fetch("/api/auth/cognito/resend", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ username }),
        });
        const payload = (await response.json()) as { success?: boolean; error?: string };
        return { response, payload };
      };

      let { response, payload } = await attempt(signupUsername);
      if (!response.ok) {
        // Some Cognito setups allow using the email alias directly.
        ({ response, payload } = await attempt(normalizedEmail));
      }
      if (!response.ok) {
        throw new Error(payload.error || "Unable to resend confirmation code.");
      }

      setError("Confirmation code resent. Check your email.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to resend confirmation code.");
    } finally {
      setPending(false);
    }
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
            setCognitoConfirmationRequired(false);
            setCognitoConfirmationCode("");
            setCognitoSignupUsername("");
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
              Email
              <input
                type="email"
                className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-slate-700 shadow-sm focus:border-rose-400 focus:outline-none"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                required
                autoComplete="email"
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

            {authProvider === "cognito" && cognitoConfirmationRequired ? (
              <div className="flex flex-col gap-2">
                <label className="flex flex-col gap-2 text-sm font-medium text-rose-600">
                  Confirmation code
                  <input
                    className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-slate-700 shadow-sm focus:border-rose-400 focus:outline-none"
                    value={cognitoConfirmationCode}
                    onChange={(event) => setCognitoConfirmationCode(event.target.value)}
                    placeholder="Check your email"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    required
                  />
                </label>
                <button
                  type="button"
                  disabled={pending || loading}
                  onClick={() => void resendCognitoConfirmationCode()}
                  className="self-start text-xs font-semibold text-rose-500 underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Resend code
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <>
            <label className="flex flex-col gap-2 text-sm font-medium text-rose-600">
              Email
              <input
                type="email"
                className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-slate-700 shadow-sm focus:border-rose-400 focus:outline-none"
                value={registerEmail}
                onChange={(event) => {
                  setRegisterEmail(event.target.value);
                  if (cognitoConfirmationRequired) {
                    setCognitoConfirmationRequired(false);
                    setCognitoConfirmationCode("");
                    setCognitoSignupUsername("");
                  }
                }}
                required
                autoComplete="email"
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
            {authProvider === "cognito" && cognitoConfirmationRequired ? (
              <div className="flex flex-col gap-2">
                <label className="flex flex-col gap-2 text-sm font-medium text-rose-600">
                  Confirmation code
                  <input
                    className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-slate-700 shadow-sm focus:border-rose-400 focus:outline-none"
                    value={cognitoConfirmationCode}
                    onChange={(event) => setCognitoConfirmationCode(event.target.value)}
                    placeholder="Check your email"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    required
                  />
                </label>
                <button
                  type="button"
                  disabled={pending || loading}
                  onClick={() => void resendCognitoConfirmationCode()}
                  className="self-start text-xs font-semibold text-rose-500 underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Resend code
                </button>
              </div>
            ) : null}
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
      {mode === "login" ? (
        authProvider === "cognito" ? (
          <div className="mt-6 flex flex-col items-center gap-4">
            <div className="flex w-full items-center gap-3 text-xs text-rose-400">
              <span className="h-px flex-1 bg-rose-100" aria-hidden="true" />
              or
              <span className="h-px flex-1 bg-rose-100" aria-hidden="true" />
            </div>
            <button
              type="button"
              disabled={googlePending || pending || loading}
              onClick={() => void startCognitoGoogleLogin()}
              className="w-full rounded-full border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-700 shadow-sm transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Continue with Google
            </button>
          </div>
        ) : process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ? (
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
        ) : null
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
