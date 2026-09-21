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
  /** Worksheets owned by the anonymous id, newest saved first. */
  listByAnonymousId(anonymousId: string): Promise<SavedWorksheet[]>;
  /** Returns null when the id is unknown or owned by someone else. */
  getByIdForAnonymousOwner(
    id: string,
    anonymousId: string,
  ): Promise<SavedWorksheet | null>;
}
