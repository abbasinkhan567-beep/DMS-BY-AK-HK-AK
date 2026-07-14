import {
  SESSION_COOKIE,
  SESSION_DAYS,
  authSecret,
  createSessionTokenEdge,
  verifySessionTokenEdge,
  sessionCookieOptions,
} from "@/lib/auth-edge";

export {
  SESSION_COOKIE,
  SESSION_DAYS,
  authSecret,
  sessionCookieOptions,
  createSessionTokenEdge as createSessionToken,
  verifySessionTokenEdge as verifySessionToken,
};

/** Sync helpers kept for Node routes that prefer await-free usage. */
export async function createSessionTokenAsync() {
  return createSessionTokenEdge();
}

export async function verifySessionTokenAsync(token: string | undefined | null) {
  return verifySessionTokenEdge(token);
}
