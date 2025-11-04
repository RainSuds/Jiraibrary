export function resolveMediaUrl(rawUrl?: string | null): string | null {
  if (!rawUrl) {
    return null;
  }

  if (/^https?:\/\//i.test(rawUrl)) {
    return rawUrl;
  }

  const base = process.env.NEXT_PUBLIC_MEDIA_HOST ?? "";
  const prefix = process.env.NEXT_PUBLIC_MEDIA_PREFIX ?? "";
  const normalizedPrefix = prefix.replace(/^\/+|\/+$/g, "");
  const sanitizedPath = rawUrl.replace(/^\/+/, "");
  const needsPrefix = normalizedPrefix && !sanitizedPath.startsWith(`${normalizedPrefix}/`);
  const combinedPath = needsPrefix ? `${normalizedPrefix}/${sanitizedPath}` : sanitizedPath;
  if (base) {
    const hasProtocol = /^https?:\/\//i.test(base);
    const normalizedBase = (hasProtocol ? base : `https://${base}`).replace(/\/$/, "");
    return `${normalizedBase}/${combinedPath}`;
  }

  if (normalizedPrefix) {
    return `/${combinedPath}`;
  }

  if (rawUrl.startsWith("/")) {
    return rawUrl;
  }

  return `/${rawUrl}`;
}
