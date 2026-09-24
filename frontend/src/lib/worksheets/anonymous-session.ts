import { randomUUID } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";

/**
 * Anonymous worksheet-ownership cookie. Holds one opaque, server-generated
 * UUID only - never JSON, never personal data, never derived from IP,
 * user-agent, or any other fingerprint. Kept out of the repository layer:
 * routes resolve the id here and pass a plain string into the repository.
 */
export const WORKSHEET_SESSION_COOKIE = "medhorbit_worksheet_session";

const MAX_AGE_SECONDS = 60 * 60 * 24 * 90; // ~90 days

/**
 * True only for a value shaped like the UUIDs this module issues. The one
 * validity check for this cookie - shared by every reader so there is a
 * single anonymous-identity system, not a parallel one per caller.
 */
export function isValidAnonymousId(value: string | null | undefined): value is string {
  return !!value && /^[0-9a-f-]{36}$/i.test(value);
}

/** Reads the anonymous owner id from the request cookie, if present and well-formed. */
export function readAnonymousId(request: NextRequest): string | null {
  const value = request.cookies.get(WORKSHEET_SESSION_COOKIE)?.value;
  return isValidAnonymousId(value) ? value : null;
}

/** Sets the anonymous ownership cookie on the response. */
export function setAnonymousIdCookie(response: NextResponse, anonymousId: string): void {
  response.cookies.set({
    name: WORKSHEET_SESSION_COOKIE,
    value: anonymousId,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

/**
 * Returns the request's existing anonymous owner id, or a freshly generated
 * one. Callers must write the returned id onto the response via
 * `setAnonymousIdCookie` whenever `created` is true.
 */
export function getOrCreateAnonymousId(request: NextRequest): { anonymousId: string; created: boolean } {
  const existing = readAnonymousId(request);
  if (existing) return { anonymousId: existing, created: false };
  return { anonymousId: randomUUID(), created: true };
}
