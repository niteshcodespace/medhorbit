import type {
  SavedWorksheet,
  SaveWorksheetInput,
  WorksheetRepository,
} from "./repository";

/**
 * Chooses which repository operation an API route uses, based on
 * server-trusted identity only. `ownerId` must come only from a verified
 * Better Auth session (see auth/session.ts) - null means "no authenticated
 * session", which preserves the existing anonymous behavior unchanged.
 *
 * When ownerId is present, these never call an anonymous-scoped method:
 * a signed-in user cannot fall back to anonymous access by construction,
 * not by a runtime check.
 */
export function saveWorksheetScoped(
  repository: WorksheetRepository,
  input: SaveWorksheetInput,
  ownerId: string | null,
): Promise<SavedWorksheet> {
  return ownerId ? repository.saveForOwner(input, ownerId) : repository.save(input);
}

export function listWorksheetsScoped(
  repository: WorksheetRepository,
  anonymousId: string,
  ownerId: string | null,
): Promise<SavedWorksheet[]> {
  return ownerId ? repository.listByOwnerId(ownerId) : repository.listByAnonymousId(anonymousId);
}

export function getWorksheetScoped(
  repository: WorksheetRepository,
  id: string,
  anonymousId: string,
  ownerId: string | null,
): Promise<SavedWorksheet | null> {
  return ownerId
    ? repository.getByIdForOwner(id, ownerId)
    : repository.getByIdForAnonymousOwner(id, anonymousId);
}
