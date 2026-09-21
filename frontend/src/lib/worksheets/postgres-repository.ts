import type { Pool } from "pg";
import type { Difficulty } from "./types";
import type { Question } from "./schema";
import type {
  SavedWorksheet,
  SaveWorksheetInput,
  WorksheetRepository,
} from "./repository";

type WorksheetRow = {
  id: string;
  anonymous_id: string;
  class_id: string;
  subject_id: string;
  topic_id: string;
  difficulty: string;
  question_count: number;
  questions: Question[];
  generated_at: Date;
  saved_at: Date;
};

const COLUMNS = `id, anonymous_id, class_id, subject_id, topic_id, difficulty,
  question_count, questions, generated_at, saved_at`;

function toSavedWorksheet(row: WorksheetRow): SavedWorksheet {
  return {
    id: row.id,
    anonymousId: row.anonymous_id,
    classId: row.class_id,
    subjectId: row.subject_id,
    topicId: row.topic_id,
    difficulty: row.difficulty as Difficulty,
    questionCount: row.question_count,
    questions: row.questions,
    generatedAt: row.generated_at,
    savedAt: row.saved_at,
  };
}

export class PostgresWorksheetRepository implements WorksheetRepository {
  constructor(private readonly pool: Pool) {}

  async save(input: SaveWorksheetInput): Promise<SavedWorksheet> {
    const { rows } = await this.pool.query<WorksheetRow>(
      `INSERT INTO worksheets (anonymous_id, class_id, subject_id, topic_id,
         difficulty, question_count, questions, generated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
       RETURNING ${COLUMNS}`,
      [
        input.anonymousId,
        input.classId,
        input.subjectId,
        input.topicId,
        input.difficulty,
        input.questionCount,
        JSON.stringify(input.questions),
        input.generatedAt,
      ],
    );
    return toSavedWorksheet(rows[0]);
  }

  async listByAnonymousId(anonymousId: string): Promise<SavedWorksheet[]> {
    const { rows } = await this.pool.query<WorksheetRow>(
      `SELECT ${COLUMNS} FROM worksheets
       WHERE anonymous_id = $1
       ORDER BY saved_at DESC`,
      [anonymousId],
    );
    return rows.map(toSavedWorksheet);
  }

  async getByIdForAnonymousOwner(
    id: string,
    anonymousId: string,
  ): Promise<SavedWorksheet | null> {
    // Ownership is enforced in the query itself, never checked after fetching.
    const { rows } = await this.pool.query<WorksheetRow>(
      `SELECT ${COLUMNS} FROM worksheets
       WHERE id = $1 AND anonymous_id = $2`,
      [id, anonymousId],
    );
    return rows.length === 0 ? null : toSavedWorksheet(rows[0]);
  }
}
