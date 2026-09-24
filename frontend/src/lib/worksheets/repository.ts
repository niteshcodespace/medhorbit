import type { WorksheetConfig } from "./types";
import type { Question } from "./schema";

/** Data needed to persist a worksheet snapshot. */
export type SaveWorksheetInput = WorksheetConfig & {
  anonymousId: string;
  questions: Question[];
  generatedAt: Date;
};

/** A persisted, immutable worksheet snapshot. */
export type SavedWorksheet = SaveWorksheetInput & {
  id: string;
  savedAt: Date;
};

export interface WorksheetRepository {
  /** Persists a snapshot and returns it with its generated id and savedAt. */
  save(input: SaveWorksheetInput): Promise<SavedWorksheet>;
  /**
   * Worksheets owned by the anonymous id, newest saved first. Only
   * unclaimed rows (owner_id IS NULL) are visible here - once a worksheet
   * is claimed by an account, its old anonymous cookie can no longer see
   * it via this method.
   */
  listByAnonymousId(anonymousId: string): Promise<SavedWorksheet[]>;
  /**
   * Returns null when the id is unknown, owned by a different anonymous
   * id, or already claimed by an account (owner_id IS NOT NULL) - claiming
   * a worksheet must revoke anonymous access to it, not just add owner
   * access alongside it.
   */
  getByIdForAnonymousOwner(
    id: string,
    anonymousId: string,
  ): Promise<SavedWorksheet | null>;
  /** Worksheets owned by the given (Better Auth) user id, newest saved first. */
  listByOwnerId(ownerId: string): Promise<SavedWorksheet[]>;
  /** Returns null when the id is unknown or owned by a different user. */
  getByIdForOwner(id: string, ownerId: string): Promise<SavedWorksheet | null>;
}
