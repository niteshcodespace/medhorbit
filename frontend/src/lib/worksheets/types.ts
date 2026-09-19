export type Difficulty = "easy" | "medium" | "hard";

export type CurriculumTopic = {
  readonly id: string;
  readonly label: string;
};

export type CurriculumSubject = {
  readonly id: string;
  readonly label: string;
  readonly topics: readonly CurriculumTopic[];
};

export type CurriculumClass = {
  readonly id: string;
  readonly label: string;
  readonly subjects: readonly CurriculumSubject[];
};

export type WorksheetConfig = {
  classId: string;
  subjectId: string;
  topicId: string;
  difficulty: Difficulty;
  questionCount: number;
};

export type Question = {
  readonly id: string;
  readonly classId: string;
  readonly subjectId: string;
  readonly topicId: string;
  readonly difficulty: Difficulty;
  readonly prompt: string;
  readonly answer: string;
};

export type Worksheet = {
  config: WorksheetConfig;
  questions: Question[];
};
