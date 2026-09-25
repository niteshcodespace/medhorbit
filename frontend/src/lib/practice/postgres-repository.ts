import type { Pool } from "pg";
import type { PracticeRepository } from "./repository";
import type {
  CreatePracticeAttemptInput,
  PracticeAnswer,
  PracticeAttempt,
  PracticeAttemptStatus,
  UpsertPracticeAnswerInput,
} from "./types";
import type { QuestionGrade } from "./grading";

type AttemptRow = {
  id: string;
  worksheet_id: string;
  owner_id: string;
  status: string;
  question_count: number;
  correct_count: number | null;
  score_percent: string | null;
  started_at: Date;
  updated_at: Date;
  submitted_at: Date | null;
};

type AnswerRow = {
  id: string;
  attempt_id: string;
  question_id: string;
  answer: string;
  is_correct: boolean | null;
  answered_at: Date;
};

const ATTEMPT_COLUMNS = `id, worksheet_id, owner_id, status, question_count,
  correct_count, score_percent, started_at, updated_at, submitted_at`;

const ANSWER_COLUMNS = `id, attempt_id, question_id, answer, is_correct, answered_at`;

function toPracticeAttempt(row: AttemptRow): PracticeAttempt {
  return {
    id: row.id,
    worksheetId: row.worksheet_id,
    ownerId: row.owner_id,
    status: row.status as PracticeAttemptStatus,
    questionCount: row.question_count,
    correctCount: row.correct_count,
    // NUMERIC comes back from `pg` as a string to avoid float precision
    // loss; Phase 10B never writes this column, but must still round-trip
    // it as a number for anything a later story reads.
    scorePercent: row.score_percent === null ? null : Number(row.score_percent),
    startedAt: row.started_at,
    updatedAt: row.updated_at,
    submittedAt: row.submitted_at,
  };
}

function toPracticeAnswer(row: AnswerRow): PracticeAnswer {
  return {
    id: row.id,
    attemptId: row.attempt_id,
    questionId: row.question_id,
    answer: row.answer,
    isCorrect: row.is_correct,
    answeredAt: row.answered_at,
  };
}

export class PostgresPracticeRepository implements PracticeRepository {
  constructor(private readonly pool: Pool) {}

  async createAttempt(
    input: CreatePracticeAttemptInput,
    ownerId: string,
  ): Promise<PracticeAttempt> {
    const { rows } = await this.pool.query<AttemptRow>(
      `INSERT INTO practice_attempts (worksheet_id, owner_id, question_count)
       VALUES ($1, $2, $3)
       RETURNING ${ATTEMPT_COLUMNS}`,
      [input.worksheetId, ownerId, input.questionCount],
    );
    return toPracticeAttempt(rows[0]);
  }

  async getAttemptByIdForOwner(
    attemptId: string,
    ownerId: string,
  ): Promise<PracticeAttempt | null> {
    // Ownership is enforced in the query itself, never checked after fetching.
    const { rows } = await this.pool.query<AttemptRow>(
      `SELECT ${ATTEMPT_COLUMNS} FROM practice_attempts
       WHERE id = $1 AND owner_id = $2`,
      [attemptId, ownerId],
    );
    return rows.length === 0 ? null : toPracticeAttempt(rows[0]);
  }

  async listAttemptsByOwnerId(ownerId: string): Promise<PracticeAttempt[]> {
    const { rows } = await this.pool.query<AttemptRow>(
      `SELECT ${ATTEMPT_COLUMNS} FROM practice_attempts
       WHERE owner_id = $1
       ORDER BY started_at DESC`,
      [ownerId],
    );
    return rows.map(toPracticeAttempt);
  }

  async listAttemptsByWorksheetForOwner(
    worksheetId: string,
    ownerId: string,
  ): Promise<PracticeAttempt[]> {
    const { rows } = await this.pool.query<AttemptRow>(
      `SELECT ${ATTEMPT_COLUMNS} FROM practice_attempts
       WHERE worksheet_id = $1 AND owner_id = $2
       ORDER BY started_at DESC`,
      [worksheetId, ownerId],
    );
    return rows.map(toPracticeAttempt);
  }

  async upsertAnswer(
    attemptId: string,
    ownerId: string,
    input: UpsertPracticeAnswerInput,
  ): Promise<PracticeAnswer | null> {
    // Ownership is enforced by the WHERE clause on the SELECT source of
    // this INSERT, in the same statement as the write itself - not a
    // separate ownership check followed by a write, which would leave a
    // race window. When the attempt id is unknown or owned by someone
    // else, the SELECT produces no source row, so nothing is inserted or
    // updated and ON CONFLICT never fires; RETURNING then yields zero
    // rows and this method returns null, exactly like a not-found read.
    const { rows } = await this.pool.query<AnswerRow>(
      `INSERT INTO practice_answers (attempt_id, question_id, answer, answered_at)
       SELECT id, $2, $3, now()
       FROM practice_attempts
       WHERE id = $1 AND owner_id = $4
       ON CONFLICT (attempt_id, question_id)
       DO UPDATE SET answer = EXCLUDED.answer, answered_at = EXCLUDED.answered_at
       RETURNING ${ANSWER_COLUMNS}`,
      [attemptId, input.questionId, input.answer, ownerId],
    );
    return rows.length === 0 ? null : toPracticeAnswer(rows[0]);
  }

  async listAnswersForAttempt(
    attemptId: string,
    ownerId: string,
  ): Promise<PracticeAnswer[]> {
    // Ownership is enforced by joining through the parent attempt row,
    // not by trusting attemptId alone - an attempt owned by someone else
    // yields an empty list here, the same non-distinguishing shape a
    // not-found result would have.
    const { rows } = await this.pool.query<AnswerRow>(
      `SELECT pa.id, pa.attempt_id, pa.question_id, pa.answer, pa.is_correct, pa.answered_at
       FROM practice_answers pa
       JOIN practice_attempts att ON att.id = pa.attempt_id
       WHERE pa.attempt_id = $1 AND att.owner_id = $2
       ORDER BY pa.answered_at ASC`,
      [attemptId, ownerId],
    );
    return rows.map(toPracticeAnswer);
  }

  async submitAttempt(
    attemptId: string,
    ownerId: string,
    grades: readonly QuestionGrade[],
    correctCount: number,
    scorePercent: number,
  ): Promise<PracticeAttempt | null> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      // The status = 'in_progress' predicate is what makes this
      // race-safe: Postgres row-level locking means a concurrent submit
      // for the same attempt blocks here until this transaction commits
      // or rolls back, then re-evaluates the predicate against the
      // now-committed row - so at most one submit can ever match and
      // update 0 rows for every submit after the first.
      const attemptResult = await client.query<AttemptRow>(
        `UPDATE practice_attempts
         SET status = 'submitted',
             correct_count = $3,
             score_percent = $4,
             submitted_at = now(),
             updated_at = now()
         WHERE id = $1 AND owner_id = $2 AND status = 'in_progress'
         RETURNING ${ATTEMPT_COLUMNS}`,
        [attemptId, ownerId, correctCount, scorePercent.toFixed(2)],
      );

      if (attemptResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return null;
      }

      // Only questions with a recorded answer have a row to grade -
      // unanswered questions have no practice_answers row and are not
      // touched here (they were already counted as incorrect by the
      // caller's correctCount).
      for (const grade of grades) {
        await client.query(
          `UPDATE practice_answers
           SET is_correct = $3
           WHERE attempt_id = $1 AND question_id = $2`,
          [attemptId, grade.questionId, grade.isCorrect],
        );
      }

      await client.query("COMMIT");
      return toPracticeAttempt(attemptResult.rows[0]);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
