import { auth } from "./auth";

/**
 * Resolves the authenticated user id from Better Auth's own server-side
 * session verification (auth.api.getSession) - never from any
 * client-supplied field (body, query, or header value the client
 * controls). Returns null when there is no valid session, which callers
 * must treat as an anonymous request.
 */
export async function getAuthenticatedUserId(headers: Headers): Promise<string | null> {
  const session = await auth.api.getSession({ headers });
  return session?.user.id ?? null;
}
