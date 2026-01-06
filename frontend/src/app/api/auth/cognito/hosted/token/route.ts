import { NextResponse } from "next/server";

import { getEnv, requireEnvAny } from "@/lib/server/env";

export const runtime = "nodejs";

type TokenExchangePayload = {
  code?: string;
  code_verifier?: string;
};

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

function backendBaseUrl(): string {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
  return base.endsWith("/") ? base : `${base}/`;
}

function resolveRedirectUri(origin: string): string {
  const configured = getEnv("COGNITO_REDIRECT_URI") ?? getEnv("NEXT_PUBLIC_COGNITO_REDIRECT_URI");
  if (configured) {
    return configured;
  }
  return new URL("auth/cognito/callback", origin).toString();
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as TokenExchangePayload;
    const code = (payload.code ?? "").trim();
    const codeVerifier = (payload.code_verifier ?? "").trim();

    if (!code || !codeVerifier) {
      return NextResponse.json({ error: "Missing code or code_verifier" }, { status: 400 });
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
    const clientSecret =
      getEnv("COGNITO_USER_POOL_CLIENT_SECRET") ??
      getEnv("COGNITO_CLIENT_SECRET") ??
      getEnv("COGNITO_APP_CLIENT_SECRET");


    const origin = new URL(request.url).origin;
    const redirectUri = resolveRedirectUri(origin);

    const tokenUrl = new URL("/oauth2/token", hostedUiBaseUrl());

    const form = new URLSearchParams();
    form.set("grant_type", "authorization_code");
    form.set("client_id", clientId);
    form.set("code", code);
    form.set("redirect_uri", redirectUri);
    form.set("code_verifier", codeVerifier);

    const headers: Record<string, string> = {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    };

    if (clientSecret) {
      const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
      headers.Authorization = `Basic ${basic}`;
    }

    const tokenResponse = await fetch(tokenUrl.toString(), {
      method: "POST",
      headers,
      body: form.toString(),
      cache: "no-store",
    });

    const tokenText = await tokenResponse.text();
    if (!tokenResponse.ok) {
      return NextResponse.json(
        { error: tokenText || `Token exchange failed (${tokenResponse.status})` },
        { status: tokenResponse.status }
      );
    }

    let tokens: unknown;
    try {
      tokens = JSON.parse(tokenText);
    } catch {
      tokens = undefined;
    }

    const idToken =
      tokens &&
      typeof tokens === "object" &&
      "id_token" in tokens &&
      typeof (tokens as { id_token?: unknown }).id_token === "string"
        ? (tokens as { id_token: string }).id_token
        : undefined;

    if (!idToken) {
      return NextResponse.json({ error: "Cognito did not return an id_token" }, { status: 400 });
    }

    const backendUrl = new URL("api/auth/cognito/", backendBaseUrl());

    const exchangeResponse = await fetch(backendUrl.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ id_token: idToken }),
      cache: "no-store",
    });

    const exchangeText = await exchangeResponse.text();
    if (!exchangeResponse.ok) {
      return NextResponse.json(
        { error: exchangeText || `Auth exchange failed (${exchangeResponse.status})` },
        { status: exchangeResponse.status }
      );
    }

    return new NextResponse(exchangeText, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Hosted UI token exchange failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
