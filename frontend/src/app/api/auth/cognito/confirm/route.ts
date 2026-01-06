import { NextResponse } from "next/server";

import {
  CognitoIdentityProviderClient,
  ConfirmSignUpCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import crypto from "node:crypto";

type ConfirmPayload = {
  username?: string;
  code?: string;
};

function getEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

function requireEnv(name: string): string {
  const value = getEnv(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function computeSecretHash(username: string, clientId: string, clientSecret: string): string {
  return crypto
    .createHmac("sha256", clientSecret)
    .update(`${username}${clientId}`)
    .digest("base64");
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as ConfirmPayload;
    const username = (payload.username ?? "").trim();
    const code = (payload.code ?? "").trim();

    if (!username || !code) {
      return NextResponse.json({ error: "Missing username or code" }, { status: 400 });
    }

    const region = requireEnv("COGNITO_REGION");
    const clientId = requireEnv("COGNITO_USER_POOL_CLIENT_ID");
    const clientSecret = getEnv("COGNITO_USER_POOL_CLIENT_SECRET");

    const secretHash = clientSecret ? computeSecretHash(username, clientId, clientSecret) : undefined;

    const client = new CognitoIdentityProviderClient({ region });
    const command = new ConfirmSignUpCommand({
      ClientId: clientId,
      Username: username,
      ConfirmationCode: code,
      SecretHash: secretHash,
    });

    await client.send(command);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Confirmation failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
