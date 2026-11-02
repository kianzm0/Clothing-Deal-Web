const PRIVATE_IPV4 = /^(10\.|127\.|169\.254\.|192\.168\.)/;
const LOOPBACK_IPV4 = /^172\.(1[6-9]|2[0-9]|3[0-1])\./;

export function safeImageUrl(value: string | null | undefined): string | null {
  if (!value || value.length > 2_048) return null;
  if (value.startsWith("/") && !value.startsWith("//")) return value;

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }

  if (!["http:", "https:"].includes(parsed.protocol)) return null;
  if (parsed.username || parsed.password) return null;
  const hostname = parsed.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".local") || hostname === "::1" ||
      PRIVATE_IPV4.test(hostname) || LOOPBACK_IPV4.test(hostname)) return null;
  return parsed.toString();
}

export function hasSafeImageUrl(value: string | null | undefined): boolean {
  return safeImageUrl(value) !== null;
}
