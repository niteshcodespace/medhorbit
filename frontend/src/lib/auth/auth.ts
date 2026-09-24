import { betterAuth } from "better-auth";
import { getPool } from "@/lib/db/pool";
import { getWorksheetRepository } from "@/lib/worksheets/repository-instance";
import { claimWorksheetsOnSessionCreated } from "./worksheet-claim-hook";

/**
 * Phase 9D-1A: Better Auth foundation only.
 *
 * - Reuses the existing pooled PostgreSQL connection (same database as the
 *   worksheets tables); no separate auth database.
 * - Database-backed sessions: this is Better Auth's default whenever no
 *   secondary storage (e.g. Redis) is configured, so no explicit session
 *   strategy flag is needed here.
 * - UUID ids everywhere, matching the shape of every other id already in
 *   this schema (worksheets.id, anonymous_id) - see
 *   advanced.database.generateId below.
 * - IP address capture disabled and OAuth tokens encrypted at rest -
 *   deliberate data-minimization choices for Phase 9D, not defaults.
 *
 * Phase 9D-1C: Google is now wired as the first (and only) social
 * provider, using Better Auth's default OAuth callback route
 * (/api/auth/callback/google) - no custom redirectURI is set, since
 * nothing about this architecture requires deviating from the default.
 * Sign-in/sign-out UI is still not implemented - this only makes the
 * provider available to Better Auth's own routes.
 *
 * Phase 9D-3B: after a session is actually created (post-authentication),
 * databaseHooks.session.create.after claims any unclaimed worksheets
 * belonging to the browser's existing anonymous worksheet-session cookie
 * into the new session's user. See worksheet-claim-hook.ts for the full
 * security rationale (trusted ownerId/anonymousId sourcing) and failure
 * policy (never fails authentication). This does not add a public claim
 * endpoint, change worksheet API auth behavior, or touch save().
 *
 * Server-only module: never import this from client code.
 */
export const auth = betterAuth({
  database: getPool(),

  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,

  advanced: {
    database: {
      // Internal MedhOrbit user/session/account ids are UUIDs, consistent
      // with worksheets.id and anonymous_id.
      generateId: "uuid",
    },
    ipAddress: {
      // Data minimization: do not record who signed in from where.
      disableIpTracking: true,
    },
  },

  account: {
    // Encrypt accessToken/refreshToken/idToken at rest in the account
    // table using Better Auth's built-in symmetric encryption (derived
    // from `secret`), rather than storing OAuth tokens in plaintext.
    encryptOAuthTokens: true,
  },

  databaseHooks: {
    session: {
      create: {
        after: (session, context) =>
          claimWorksheetsOnSessionCreated(session, context, getWorksheetRepository()),
      },
    },
  },

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
});
