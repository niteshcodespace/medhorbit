import type { WorksheetRepository } from "../worksheets/repository";
import { WORKSHEET_SESSION_COOKIE, isValidAnonymousId } from "../worksheets/anonymous-session";

/** The subset of Better Auth's `Session` this hook actually reads. */
export type ClaimHookSession = { userId: string };

/** The subset of Better Auth's endpoint context this hook actually reads. */
export type ClaimHookContext = { getCookie: (key: string) => string | null } | null | undefined;

/**
 * Claims any unclaimed worksheets belonging to the browser's existing
 * anonymous worksheet-session cookie into the just-authenticated user.
 *
 * Wired as Better Auth's `databaseHooks.session.create.after` (see auth.ts),
 * which only fires once a session row has actually been committed - the
 * session's userId FK guarantees the "user" row already exists, which
 * worksheets.owner_id's own FK depends on.
 *
 * ownerId comes only from `session.userId` (Better Auth's own trusted,
 * server-created session record - never request body/query data).
 * anonymousId comes only from the existing HttpOnly worksheet-session
 * cookie via `context.getCookie` - never request body/query data.
 *
 * Never throws: a worksheet-claim failure must never fail authentication.
 * `claimAnonymousWorksheets` is idempotent, so a failure here (e.g. a
 * transient DB error) is safely retried on the user's next sign-in - no
 * separate retry infrastructure is introduced in this phase.
 */
export async function claimWorksheetsOnSessionCreated(
  session: ClaimHookSession,
  context: ClaimHookContext,
  repository: WorksheetRepository,
): Promise<void> {
  try {
    if (!context) return;
    const anonymousId = context.getCookie(WORKSHEET_SESSION_COOKIE);
    if (!isValidAnonymousId(anonymousId)) return;
    await repository.claimAnonymousWorksheets(anonymousId, session.userId);
  } catch {
    // Intentionally swallowed - see doc comment above. Never log the
    // cookie value, ownerId, or any claim/query detail here.
  }
}
