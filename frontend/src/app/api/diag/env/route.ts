import { NextResponse } from "next/server";

import { getEnv } from "@/lib/server/env";

export const runtime = "nodejs";

type EnvReport = {
  present: boolean;
  length?: number;
  suffix?: string;
};

function reportValue(value: string | undefined, options?: { includeSuffix?: boolean }): EnvReport {
  if (!value) {
    return { present: false };
  }
  const trimmed = value.trim();
  const base: EnvReport = { present: true, length: trimmed.length };
  if (options?.includeSuffix) {
    base.suffix = trimmed.length >= 6 ? trimmed.slice(-6) : trimmed;
  }
  return base;
}

export async function GET() {
  // Safe diagnostic endpoint: does NOT return secrets, only presence/length/suffix.
  const report: Record<string, EnvReport> = {
    NODE_ENV: reportValue(getEnv("NODE_ENV")),
    AWS_REGION: reportValue(getEnv("AWS_REGION"), { includeSuffix: true }),
    COGNITO_REGION: reportValue(getEnv("COGNITO_REGION"), { includeSuffix: true }),
    COGNITO_USER_POOL_CLIENT_ID: reportValue(getEnv("COGNITO_USER_POOL_CLIENT_ID"), { includeSuffix: true }),
    COGNITO_APP_CLIENT_ID: reportValue(getEnv("COGNITO_APP_CLIENT_ID"), { includeSuffix: true }),
    COGNITO_CLIENT_ID: reportValue(getEnv("COGNITO_CLIENT_ID"), { includeSuffix: true }),
    // For NEXT_PUBLIC_* variables, dynamic lookup (process.env[name]) often fails on Amplify because
    // Next.js only inlines NEXT_PUBLIC_* for static property access. Report both.
    NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID: reportValue(process.env.NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID, {
      includeSuffix: true,
    }),
    NEXT_PUBLIC_COGNITO_REGION: reportValue(process.env.NEXT_PUBLIC_COGNITO_REGION, { includeSuffix: true }),
    NEXT_PUBLIC_COGNITO_HOSTED_UI_DOMAIN: reportValue(process.env.NEXT_PUBLIC_COGNITO_HOSTED_UI_DOMAIN, {
      includeSuffix: true,
    }),
    NEXT_PUBLIC_API_BASE_URL: reportValue(process.env.NEXT_PUBLIC_API_BASE_URL, { includeSuffix: true }),
    COGNITO_HOSTED_UI_DOMAIN: reportValue(getEnv("COGNITO_HOSTED_UI_DOMAIN"), { includeSuffix: true }),
    COGNITO_DOMAIN: reportValue(getEnv("COGNITO_DOMAIN"), { includeSuffix: true }),
    COGNITO_REDIRECT_URI: reportValue(getEnv("COGNITO_REDIRECT_URI"), { includeSuffix: true }),
    NEXT_PUBLIC_COGNITO_REDIRECT_URI: reportValue(process.env.NEXT_PUBLIC_COGNITO_REDIRECT_URI, {
      includeSuffix: true,
    }),

    // Secrets: only presence/length, no suffix.
    COGNITO_USER_POOL_CLIENT_SECRET: reportValue(getEnv("COGNITO_USER_POOL_CLIENT_SECRET")),
    COGNITO_CLIENT_SECRET: reportValue(getEnv("COGNITO_CLIENT_SECRET")),
    COGNITO_APP_CLIENT_SECRET: reportValue(getEnv("COGNITO_APP_CLIENT_SECRET")),
  };

  return NextResponse.json({ ok: true, env: report }, { status: 200 });
}
