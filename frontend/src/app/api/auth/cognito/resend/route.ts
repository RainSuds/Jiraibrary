import { NextResponse } from "next/server";

import {
  CognitoIdentityProviderClient,
  ResendConfirmationCodeCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import crypto from "node:crypto";

import { getCognitoClientId, getCognitoClientSecret, getCognitoRegion } from "@/lib/server/cognito-env";

export const runtime = "nodejs";

type ResendPayload = {
  username?: string;
};

function computeSecretHash(username: string, clientId: string, clientSecret: string): string {
  return crypto
    .createHmac("sha256", clientSecret)
    .update(`${username}${clientId}`)
    .digest("base64");
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as ResendPayload;
    const username = (payload.username ?? "").trim();

    if (!username) {
      return NextResponse.json({ error: "Missing username" }, { status: 400 });
    }

    const region = getCognitoRegion();
    const clientId = getCognitoClientId();
    const clientSecret = getCognitoClientSecret();

    const client = new CognitoIdentityProviderClient({ region });
    const secretHash = clientSecret ? computeSecretHash(username, clientId, clientSecret) : undefined;

    const command = new ResendConfirmationCodeCommand({
      ClientId: clientId,
      Username: username,
      ...(secretHash ? { SecretHash: secretHash } : {}),
    });

    await client.send(command);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to resend confirmation code";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
