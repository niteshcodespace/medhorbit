"use client";

import { createAuthClient } from "better-auth/react";

/**
 * Client-side Better Auth handle. No baseURL is set - every call is
 * same-origin against this app's own /api/auth/* routes, matching the
 * server config in auth.ts. This never carries or sends a user id itself;
 * `useSession()` reads whatever the server's session cookie already
 * proves, and signIn/signOut only ever POST to Better Auth's own routes.
 */
export const authClient = createAuthClient();
