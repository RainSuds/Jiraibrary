export function getEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

export function getEnvAny(names: string[]): string | undefined {
  for (const name of names) {
    const value = getEnv(name);
    if (value) {
      return value;
    }
  }
  return undefined;
}

export function requireEnvAny(names: string[], primaryName: string = names[0] ?? ""): string {
  const value = getEnvAny(names);
  if (!value) {
    throw new Error(`Missing required environment variable: ${primaryName}`);
  }
  return value;
}
