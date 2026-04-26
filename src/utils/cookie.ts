type CookieOptions = {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "Strict" | "Lax" | "None";
  path?: string;
  maxAge?: number;
  domain?: string;
};

export function parseCookieHeader(cookieHeader?: string | null) {
  const result: Record<string, string> = {};
  if (!cookieHeader) {
    return result;
  }

  const chunks = cookieHeader.split(";");
  for (const chunk of chunks) {
    const [rawKey, ...rawValueParts] = chunk.trim().split("=");
    if (!rawKey) {
      continue;
    }

    const value = rawValueParts.join("=");
    result[rawKey] = decodeURIComponent(value || "");
  }

  return result;
}

export function serializeCookie(name: string, value: string, options: CookieOptions = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];

  if (options.maxAge !== undefined) {
    parts.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge))}`);
  }

  if (options.domain) {
    parts.push(`Domain=${options.domain}`);
  }

  parts.push(`Path=${options.path ?? "/"}`);

  if (options.httpOnly) {
    parts.push("HttpOnly");
  }

  if (options.secure) {
    parts.push("Secure");
  }

  parts.push(`SameSite=${options.sameSite ?? "Strict"}`);

  return parts.join("; ");
}
