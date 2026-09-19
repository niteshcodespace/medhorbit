/** Body accepted by POST /api/worksheets/generate. */
export type GenerateWorksheetRequest = {
  classId: string;
  topicId: string;
  questionCount: number;
};

/** A question in an API response. Distinct from the domain `Question` in ./types. */
export type Question = {
  id: string;
  prompt: string;
  type: string;
  answer?: string;
};

/** Body returned by POST /api/worksheets/generate on success. */
export type GenerateWorksheetResponse = {
  questions: Question[];
  metadata: {
    topicId: string;
    classId: string;
    questionCount: number;
    /** ISO 8601 timestamp of generation. */
    generated: string;
  };
};
