import { randomUUID } from "node:crypto";
import type { PracticeRepository } from "./repository";
import type {
  CreatePracticeAttemptInput,
  PracticeAnswer,
  PracticeAttempt,
  UpsertPracticeAnswerInput,
} from "./types";

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
}
