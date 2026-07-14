/** Edge-safe session helpers (middleware + shared cookie name). */

export const SESSION_COOKIE = "pepsi_session";
export const SESSION_DAYS = 14;

export function authSecret() {
  return process.env.PEPSI_AUTH_SECRET || "pepsi-distribution-office-session-v1";
}

function base64UrlEncode(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function hmacSign(payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(authSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return base64UrlEncode(sig);
}

export async function createSessionTokenEdge(ttlDays = SESSION_DAYS): Promise<string> {
  const exp = Date.now() + ttlDays * 24 * 60 * 60 * 1000;
  const payload = base64UrlEncode(new TextEncoder().encode(JSON.stringify({ exp })));
  const sig = await hmacSign(payload);
  return `${payload}.${sig}`;
}

export async function verifySessionTokenEdge(token: string | undefined | null): Promise<boolean> {
  if (!token || !token.includes(".")) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  const expected = await hmacSign(payload);
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  }
  if (diff !== 0) return false;
  try {
    const json = new TextDecoder().decode(base64UrlDecode(payload));
    const data = JSON.parse(json) as { exp?: number };
    if (!data.exp || Date.now() > data.exp) return false;
    return true;
  } catch {
    return false;
  }
}

export function sessionCookieOptions(
  maxAgeSeconds = SESSION_DAYS * 24 * 60 * 60,
  opts?: { secure?: boolean }
) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    // Localhost HTTP must not use Secure; Tunnel HTTPS can
    secure: Boolean(opts?.secure),
    path: "/",
    maxAge: maxAgeSeconds,
  };
}
