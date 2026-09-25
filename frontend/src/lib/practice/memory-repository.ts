import { randomUUID } from "node:crypto";
import type { PracticeRepository } from "./repository";
import type {
  CreatePracticeAttemptInput,
  PracticeAnswer,
  PracticeAttempt,
  UpsertPracticeAnswerInput,
} from "./types";
import type { QuestionGrade } from "./grading";

function snapshotAttempt(attempt: PracticeAttempt): PracticeAttempt {
  return {
    ...attempt,
    startedAt: new Date(attempt.startedAt),
    updatedAt: new Date(attempt.updatedAt),
    submittedAt: attempt.submittedAt ? new Date(attempt.submittedAt) : null,
  };
}

function snapshotAnswer(answer: PracticeAnswer): PracticeAnswer {
  return { ...answer, answeredAt: new Date(answer.answeredAt) };
}

/** Zero-dependency repository for tests. Stores and returns independent copies. */
export class InMemoryPracticeRepository implements PracticeRepository {
  private readonly attempts: PracticeAttempt[] = [];
  private readonly answers: PracticeAnswer[] = [];

  constructor(private readonly now: () => Date = () => new Date()) {}

  async createAttempt(
    input: CreatePracticeAttemptInput,
    ownerId: string,
  ): Promise<PracticeAttempt> {
    const timestamp = this.now();
    const attempt: PracticeAttempt = {
      id: randomUUID(),
      worksheetId: input.worksheetId,
      ownerId,
      status: "in_progress",
      questionCount: input.questionCount,
      correctCount: null,
      scorePercent: null,
      startedAt: timestamp,
      updatedAt: timestamp,
      submittedAt: null,
    };
    this.attempts.push(snapshotAttempt(attempt));
    return snapshotAttempt(attempt);
  }

  async getAttemptByIdForOwner(
    attemptId: string,
    ownerId: string,
  ): Promise<PracticeAttempt | null> {
    const found = this.attempts.find((a) => a.id === attemptId && a.ownerId === ownerId);
    return found ? snapshotAttempt(found) : null;
  }

  async listAttemptsByOwnerId(ownerId: string): Promise<PracticeAttempt[]> {
    return this.attempts
      .map((attempt, order) => ({ attempt, order }))
      .filter(({ attempt }) => attempt.ownerId === ownerId)
      .sort(
        (a, b) =>
          b.attempt.startedAt.getTime() - a.attempt.startedAt.getTime() || b.order - a.order,
      )
      .map(({ attempt }) => snapshotAttempt(attempt));
  }

  async listAttemptsByWorksheetForOwner(
    worksheetId: string,
    ownerId: string,
  ): Promise<PracticeAttempt[]> {
    return this.attempts
      .map((attempt, order) => ({ attempt, order }))
      .filter(
        ({ attempt }) => attempt.worksheetId === worksheetId && attempt.ownerId === ownerId,
      )
      .sort(
        (a, b) =>
          b.attempt.startedAt.getTime() - a.attempt.startedAt.getTime() || b.order - a.order,
      )
      .map(({ attempt }) => snapshotAttempt(attempt));
  }

  async upsertAnswer(
    attemptId: string,
    ownerId: string,
    input: UpsertPracticeAnswerInput,
  ): Promise<PracticeAnswer | null> {
    // Mirrors the Postgres implementation's atomicity contract as closely
    // as a single-threaded in-memory store can: the ownership check and
    // the write happen with no intervening await, so there is no window
    // for another call to interleave.
    const attempt = this.attempts.find((a) => a.id === attemptId && a.ownerId === ownerId);
    if (!attempt) return null;

    const existingIndex = this.answers.findIndex(
      (a) => a.attemptId === attemptId && a.questionId === input.questionId,
    );
    const timestamp = this.now();

    const updated: PracticeAnswer = {
      id: existingIndex === -1 ? randomUUID() : this.answers[existingIndex].id,
      attemptId,
      questionId: input.questionId,
      answer: input.answer,
      isCorrect: null,
      answeredAt: timestamp,
    };

    if (existingIndex === -1) {
      this.answers.push(snapshotAnswer(updated));
    } else {
      this.answers[existingIndex] = snapshotAnswer(updated);
    }
    return snapshotAnswer(updated);
  }

  async listAnswersForAttempt(
    attemptId: string,
    ownerId: string,
  ): Promise<PracticeAnswer[]> {
    const attempt = this.attempts.find((a) => a.id === attemptId && a.ownerId === ownerId);
    if (!attempt) return [];

    return this.answers
      .filter((a) => a.attemptId === attemptId)
      .sort((a, b) => a.answeredAt.getTime() - b.answeredAt.getTime())
      .map(snapshotAnswer);
  }

  /**
   * Test-only helper: flips an attempt to `submitted` without going
   * through a real submission flow. Not part of PracticeRepository -
   * exists only so tests can exercise "submitted attempts reject
   * further writes" independently of the real submitAttempt() path.
   */
  markSubmittedForTest(attemptId: string): void {
    const index = this.attempts.findIndex((a) => a.id === attemptId);
    if (index !== -1) {
      this.attempts[index] = { ...this.attempts[index], status: "submitted" };
    }
  }

  async submitAttempt(
    attemptId: string,
    ownerId: string,
    grades: readonly QuestionGrade[],
    correctCount: number,
    scorePercent: number,
  ): Promise<PracticeAttempt | null> {
    // Single-threaded JS: finding the eligible attempt and replacing it
    // happen with no intervening await, so this is atomic in the same
    // sense the Postgres implementation's transaction is - a second
    // call for the same attemptId sees status !== "in_progress" and
    // returns null, exactly like a concurrent submit losing the race.
    const index = this.attempts.findIndex(
      (a) => a.id === attemptId && a.ownerId === ownerId && a.status === "in_progress",
    );
    if (index === -1) return null;

    const timestamp = this.now();
    const updated: PracticeAttempt = {
      ...this.attempts[index],
      status: "submitted",
      correctCount,
      scorePercent,
      updatedAt: timestamp,
      submittedAt: timestamp,
    };
    this.attempts[index] = snapshotAttempt(updated);

    for (const grade of grades) {
      const answerIndex = this.answers.findIndex(
        (a) => a.attemptId === attemptId && a.questionId === grade.questionId,
      );
      if (answerIndex !== -1) {
        this.answers[answerIndex] = { ...this.answers[answerIndex], isCorrect: grade.isCorrect };
      }
    }

    return snapshotAttempt(updated);
  }
}
