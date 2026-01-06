import { NextResponse } from "next/server";

import {
  CognitoIdentityProviderClient,
  SignUpCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import crypto from "node:crypto";

import { getEnv, requireEnvAny } from "@/lib/server/env";

export const runtime = "nodejs";

type SignupPayload = {
  username?: string;
  email?: string;
  password?: string;
  display_name?: string;
};

function computeSecretHash(username: string, clientId: string, clientSecret: string): string {
  return crypto
    .createHmac("sha256", clientSecret)
    .update(`${username}${clientId}`)
    .digest("base64");
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as SignupPayload;
    const username = (payload.username ?? "").trim();
    const email = (payload.email ?? "").trim();
    const password = payload.password ?? "";
    const displayName = (payload.display_name ?? "").trim();

    if (!username || !email || !password) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const region = requireEnvAny(["COGNITO_REGION", "AWS_REGION"], "COGNITO_REGION");
    const clientId = requireEnvAny(
      ["COGNITO_USER_POOL_CLIENT_ID", "COGNITO_APP_CLIENT_ID", "COGNITO_CLIENT_ID"],
      "COGNITO_USER_POOL_CLIENT_ID"
    );
    const clientSecret = getEnv("COGNITO_USER_POOL_CLIENT_SECRET");

    const client = new CognitoIdentityProviderClient({ region });

    const secretHash = clientSecret ? computeSecretHash(username, clientId, clientSecret) : undefined;

    const command = new SignUpCommand({
      ClientId: clientId,
      Username: username,
      Password: password,
      SecretHash: secretHash,
      UserAttributes: [
        { Name: "email", Value: email },
        { Name: "preferred_username", Value: username },
        ...(displayName ? [{ Name: "name", Value: displayName }] : []),
      ],
    });

    const result = await client.send(command);

    return NextResponse.json({
      userConfirmed: Boolean(result.UserConfirmed),
      userSub: result.UserSub,
      nextStep: result.UserConfirmed ? "DONE" : "CONFIRM_SIGN_UP",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Signup failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
