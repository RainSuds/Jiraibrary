import { NextResponse } from "next/server";

import { getEnv, requireEnvAny } from "@/lib/server/env";

export const runtime = "nodejs";

function hostedUiBaseUrl(): string {
  const raw = requireEnvAny(
    [
      "COGNITO_HOSTED_UI_DOMAIN",
      "COGNITO_DOMAIN",
      "NEXT_PUBLIC_COGNITO_HOSTED_UI_DOMAIN",
      "NEXT_PUBLIC_COGNITO_DOMAIN",
    ],
    "COGNITO_HOSTED_UI_DOMAIN"
  );
  const withScheme = raw.startsWith("http://") || raw.startsWith("https://") ? raw : `https://${raw}`;
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
  return getEnv("COGNITO_REDIRECT_URI") ?? getEnv("NEXT_PUBLIC_COGNITO_REDIRECT_URI") ?? "";
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const challenge = (url.searchParams.get("challenge") ?? "").trim();
    const state = (url.searchParams.get("state") ?? "").trim();
    const loginHint = (url.searchParams.get("login_hint") ?? "").trim();

    if (!challenge || !state) {
      return NextResponse.json({ error: "Missing PKCE challenge or state" }, { status: 400 });
    }

    const clientId = requireEnvAny(
      [
        "COGNITO_USER_POOL_CLIENT_ID",
        "COGNITO_APP_CLIENT_ID",
        "COGNITO_CLIENT_ID",
        "NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID",
        "NEXT_PUBLIC_COGNITO_APP_CLIENT_ID",
        "NEXT_PUBLIC_COGNITO_CLIENT_ID",
      ],
      "COGNITO_USER_POOL_CLIENT_ID"
    );

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

    if (loginHint) {
      authorize.searchParams.set("login_hint", loginHint);
    }

    return NextResponse.redirect(authorize.toString(), { status: 302 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to start Hosted UI login";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
