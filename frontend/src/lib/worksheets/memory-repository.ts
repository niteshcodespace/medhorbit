import { randomUUID } from "node:crypto";
import type {
  SavedWorksheet,
  SaveWorksheetInput,
  WorksheetRepository,
} from "./repository";

function snapshot(worksheet: SavedWorksheet): SavedWorksheet {
  return {
    ...worksheet,
    questions: structuredClone(worksheet.questions),
    generatedAt: new Date(worksheet.generatedAt),
    savedAt: new Date(worksheet.savedAt),
  };
}

/**
 * Internal storage row. `ownerId` is not part of the public SavedWorksheet
 * domain type (save() never sets it), so it is tracked alongside the
 * worksheet here rather than added to that type.
 */
type StoredRow = { worksheet: SavedWorksheet; ownerId: string | null };

/** Zero-dependency repository for tests. Stores and returns independent copies. */
export class InMemoryWorksheetRepository implements WorksheetRepository {
  private readonly rows: StoredRow[] = [];

  constructor(private readonly now: () => Date = () => new Date()) {}

  async save(input: SaveWorksheetInput): Promise<SavedWorksheet> {
    const saved: SavedWorksheet = { ...input, id: randomUUID(), savedAt: this.now() };
    this.rows.push({ worksheet: snapshot(saved), ownerId: null });
    return snapshot(saved);
  }

  /**
   * Test-only fixture helper: inserts a worksheet already owned by an
   * account, without going through save() (which never sets an owner).
   * Not part of WorksheetRepository - for repository tests only.
   */
  saveOwnedForTest(input: SaveWorksheetInput, ownerId: string): Promise<SavedWorksheet> {
    const saved: SavedWorksheet = { ...input, id: randomUUID(), savedAt: this.now() };
    this.rows.push({ worksheet: snapshot(saved), ownerId });
    return Promise.resolve(snapshot(saved));
  }

  async listByAnonymousId(anonymousId: string): Promise<SavedWorksheet[]> {
    return this.rows
      .map(({ worksheet, ownerId }, order) => ({ worksheet, ownerId, order }))
      .filter(({ worksheet, ownerId }) => worksheet.anonymousId === anonymousId && ownerId === null)
      .sort(
        (a, b) =>
          b.worksheet.savedAt.getTime() - a.worksheet.savedAt.getTime() || b.order - a.order,
      )
      .map(({ worksheet }) => snapshot(worksheet));
  }

  async getByIdForAnonymousOwner(
    id: string,
    anonymousId: string,
  ): Promise<SavedWorksheet | null> {
    const row = this.rows.find(
      (r) => r.worksheet.id === id && r.worksheet.anonymousId === anonymousId && r.ownerId === null,
    );
    return row ? snapshot(row.worksheet) : null;
  }

  async listByOwnerId(ownerId: string): Promise<SavedWorksheet[]> {
    return this.rows
      .map(({ worksheet, ownerId: owner }, order) => ({ worksheet, owner, order }))
      .filter(({ owner }) => owner === ownerId)
      .sort(
        (a, b) =>
          b.worksheet.savedAt.getTime() - a.worksheet.savedAt.getTime() || b.order - a.order,
      )
      .map(({ worksheet }) => snapshot(worksheet));
  }

  async getByIdForOwner(id: string, ownerId: string): Promise<SavedWorksheet | null> {
    const row = this.rows.find((r) => r.worksheet.id === id && r.ownerId === ownerId);
    return row ? snapshot(row.worksheet) : null;
  }

  async claimAnonymousWorksheets(
    anonymousId: string,
    ownerId: string,
  ): Promise<number> {
    let claimed = 0;
    for (const row of this.rows) {
      if (row.worksheet.anonymousId === anonymousId && row.ownerId === null) {
        row.ownerId = ownerId;
        claimed += 1;
      }
    }
    return claimed;
  }
}
