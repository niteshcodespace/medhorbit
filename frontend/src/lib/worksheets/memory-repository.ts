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

/** Zero-dependency repository for tests. Stores and returns independent copies. */
export class InMemoryWorksheetRepository implements WorksheetRepository {
  private readonly rows: SavedWorksheet[] = [];

  constructor(private readonly now: () => Date = () => new Date()) {}

  async save(input: SaveWorksheetInput): Promise<SavedWorksheet> {
    const saved: SavedWorksheet = { ...input, id: randomUUID(), savedAt: this.now() };
    this.rows.push(snapshot(saved));
    return snapshot(saved);
  }

  async listByAnonymousId(anonymousId: string): Promise<SavedWorksheet[]> {
    return this.rows
      .map((row, order) => ({ row, order }))
      .filter(({ row }) => row.anonymousId === anonymousId)
      .sort(
        (a, b) =>
          b.row.savedAt.getTime() - a.row.savedAt.getTime() || b.order - a.order,
      )
      .map(({ row }) => snapshot(row));
  }

  async getByIdForAnonymousOwner(
    id: string,
    anonymousId: string,
  ): Promise<SavedWorksheet | null> {
    const row = this.rows.find((r) => r.id === id && r.anonymousId === anonymousId);
    return row ? snapshot(row) : null;
  }
}
