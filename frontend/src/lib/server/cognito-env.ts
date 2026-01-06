function clean(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function requireValue(value: string | undefined, name: string): string {
  const cleaned = clean(value);
  if (!cleaned) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return cleaned;
}

export function getCognitoRegion(): string {
  return requireValue(
    clean(process.env.COGNITO_REGION) ??
      clean(process.env.NEXT_PUBLIC_COGNITO_REGION) ??
      clean(process.env.AWS_REGION) ??
      clean(process.env.NEXT_PUBLIC_AWS_REGION),
    "COGNITO_REGION"
  );
}

export function getCognitoClientId(): string {
  return requireValue(
    clean(process.env.COGNITO_USER_POOL_CLIENT_ID) ??
      clean(process.env.COGNITO_APP_CLIENT_ID) ??
      clean(process.env.COGNITO_CLIENT_ID) ??
      clean(process.env.NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID) ??
      clean(process.env.NEXT_PUBLIC_COGNITO_APP_CLIENT_ID) ??
      clean(process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID),
    "COGNITO_USER_POOL_CLIENT_ID"
  );
}

export function getCognitoClientSecret(): string | undefined {
  // Never read secrets from NEXT_PUBLIC_ variables.
  return (
    clean(process.env.COGNITO_USER_POOL_CLIENT_SECRET) ??
    clean(process.env.COGNITO_CLIENT_SECRET) ??
    clean(process.env.COGNITO_APP_CLIENT_SECRET)
  );
}

export function getCognitoHostedUiDomain(): string {
  return requireValue(
    clean(process.env.COGNITO_HOSTED_UI_DOMAIN) ??
      clean(process.env.COGNITO_DOMAIN) ??
      clean(process.env.NEXT_PUBLIC_COGNITO_HOSTED_UI_DOMAIN) ??
      clean(process.env.NEXT_PUBLIC_COGNITO_DOMAIN),
    "COGNITO_HOSTED_UI_DOMAIN"
  );
}

export function getCognitoRedirectUri(): string | undefined {
  return (
    clean(process.env.COGNITO_REDIRECT_URI) ?? clean(process.env.NEXT_PUBLIC_COGNITO_REDIRECT_URI)
  );
}
