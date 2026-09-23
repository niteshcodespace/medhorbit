import { betterAuth } from "better-auth";
import { getPool } from "@/lib/db/pool";

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
 * Google sign-in is intentionally NOT wired yet (Phase 9D-1B). Better
 * Auth's core schema (user/session/account/verification) does not depend
 * on which social providers are configured, so leaving `socialProviders`
 * empty here does not change the schema this module generates - it only
 * means no one can actually sign in yet. This avoids needing any Google
 * client id/secret (real or placeholder) in this step at all.
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
});
