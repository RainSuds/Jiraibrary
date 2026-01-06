import { NextResponse } from "next/server";

import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import crypto from "node:crypto";

import { getEnv } from "@/lib/server/env";
import { getCognitoClientId, getCognitoClientSecret, getCognitoRegion } from "@/lib/server/cognito-env";

export const runtime = "nodejs";

type LoginPayload = {
  identifier?: string;
  email?: string;
  username?: string;
  password?: string;
};

function computeSecretHash(username: string, clientId: string, clientSecret: string): string {
  return crypto
    .createHmac("sha256", clientSecret)
    .update(`${username}${clientId}`)
    .digest("base64");
}

function backendBaseUrl(): string {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
  return base.endsWith("/") ? base : `${base}/`;
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as LoginPayload;
    const rawIdentifier = (payload.email ?? payload.identifier ?? payload.username ?? "").trim();
    const identifier = rawIdentifier.includes("@") ? rawIdentifier.toLowerCase() : rawIdentifier;
    const password = payload.password ?? "";

    if (!identifier || !password) {
      return NextResponse.json({ error: "Missing identifier or password" }, { status: 400 });
    }

    const region = getCognitoRegion();
    const clientId = getCognitoClientId();
    const clientSecret = getCognitoClientSecret();

    const secretHash = clientSecret ? computeSecretHash(identifier, clientId, clientSecret) : undefined;

    const client = new CognitoIdentityProviderClient({ region });
    const command = new InitiateAuthCommand({
      AuthFlow: "USER_PASSWORD_AUTH",
      ClientId: clientId,
      AuthParameters: {
        USERNAME: identifier,
        PASSWORD: password,
        ...(secretHash ? { SECRET_HASH: secretHash } : {}),
      },
    });

    const result = await client.send(command);
    const idToken = result.AuthenticationResult?.IdToken;

    if (!idToken) {
      return NextResponse.json({ error: "Cognito did not return an ID token" }, { status: 400 });
    }

    const backendUrl = new URL("api/auth/cognito/", backendBaseUrl());

    const exchangeResponse = await fetch(backendUrl.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ id_token: idToken }),
      cache: "no-store",
    });

    const text = await exchangeResponse.text();
    if (!exchangeResponse.ok) {
      return NextResponse.json(
        { error: text || `Auth exchange failed (${exchangeResponse.status})` },
        { status: exchangeResponse.status }
      );
    }

    return new NextResponse(text, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const name =
      error && typeof error === "object" && "name" in error ? String((error as { name?: unknown }).name) : "";
    const message = error instanceof Error ? error.message : "Login failed";

    if (name === "UserNotConfirmedException") {
      return NextResponse.json(
        {
          error: "Account not verified. Please check your email for the confirmation code.",
          code: "USER_NOT_CONFIRMED",
          nextStep: "CONFIRM_SIGN_UP",
        },
        { status: 409 }
      );
    }

    if (name === "NotAuthorizedException" || name === "UserNotFoundException") {
      return NextResponse.json(
        { error: "Invalid email or password.", code: "INVALID_CREDENTIALS" },
        { status: 401 }
      );
    }

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
