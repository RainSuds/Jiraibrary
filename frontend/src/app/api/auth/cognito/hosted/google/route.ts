import { NextResponse } from "next/server";

import { getCognitoClientId, getCognitoHostedUiDomain, getCognitoRedirectUri } from "@/lib/server/cognito-env";

export const runtime = "nodejs";

function backendBaseUrl(): string {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
  return base.endsWith("/") ? base : `${base}/`;
}

function hostedUiBaseUrl(): string {
  const raw = getCognitoHostedUiDomain();
  const withScheme = raw.startsWith("http://") || raw.startsWith("https://")
    ? raw
    : `https://${raw}`;
  const normalized = withScheme.replace(/\/+$/, "");
  try {
    const parsed = new URL(normalized);
    parsed.pathname = "";
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return normalized;
  }
}

function redirectUri(): string {
  return getCognitoRedirectUri() ?? "";
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const challenge = (url.searchParams.get("challenge") ?? "").trim();
    const state = (url.searchParams.get("state") ?? "").trim();

    if (!challenge || !state) {
      return NextResponse.json({ error: "Missing PKCE challenge or state" }, { status: 400 });
    }

    const clientId = getCognitoClientId();

    // Default redirect_uri to <origin>/auth/cognito/callback when not explicitly provided.
    const fallbackRedirect = new URL("auth/cognito/callback", url.origin).toString();
    const cb = redirectUri() || fallbackRedirect;

    const authorize = new URL("/oauth2/authorize", hostedUiBaseUrl());
    authorize.searchParams.set("response_type", "code");
    authorize.searchParams.set("client_id", clientId);
    authorize.searchParams.set("redirect_uri", cb);
    authorize.searchParams.set("scope", "openid email");
    authorize.searchParams.set("state", state);
    authorize.searchParams.set("code_challenge_method", "S256");
    authorize.searchParams.set("code_challenge", challenge);

    // Force Google IdP through Cognito federation.
    authorize.searchParams.set("identity_provider", "Google");

    return NextResponse.redirect(authorize.toString(), { status: 302 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to start Hosted UI login";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
