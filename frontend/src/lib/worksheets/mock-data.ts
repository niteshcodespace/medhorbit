import type { CurriculumClass, Difficulty, Question } from "./types";

// A small demonstration catalog, not a complete curriculum.
export const curriculum: readonly CurriculumClass[] = [
  {
    id: "class-3",
    label: "Class 3",
    subjects: [
      {
        id: "mathematics",
        label: "Mathematics",
        topics: [
          { id: "addition", label: "Addition" },
          { id: "multiplication", label: "Multiplication" },
        ],
      },
    ],
  },
];

export const difficulties: readonly Difficulty[] = ["easy", "medium", "hard"];

const questionGroups: {
  topicId: string;
  difficulty: Difficulty;
  questions: { prompt: string; answer: string }[];
}[] = [
  {
    topicId: "addition",
    difficulty: "easy",
    questions: [
      { prompt: "Add 12 + 6.", answer: "18" },
      { prompt: "Add 23 + 15.", answer: "38" },
      { prompt: "Add 41 + 8.", answer: "49" },
    ],
  },
  {
    topicId: "addition",
    difficulty: "medium",
    questions: [
      { prompt: "Add 47 + 38.", answer: "85" },
      { prompt: "Add 126 + 157.", answer: "283" },
      { prompt: "Add 268 + 145.", answer: "413" },
    ],
  },
  {
    topicId: "addition",
    difficulty: "hard",
    questions: [
      {
        prompt: "A library has 248 storybooks and receives 175 more. How many storybooks does it have now?",
        answer: "423 storybooks",
      },
      {
        prompt: "A school collects 156 bottles on Monday, 238 on Tuesday, and 127 on Wednesday. How many bottles are collected altogether?",
        answer: "521 bottles",
      },
      {
        prompt: "A shop sells 285 pencils in the morning and 167 in the afternoon. How many more must it sell to reach 500 pencils?",
        answer: "48 pencils",
      },
    ],
  },
  {
    topicId: "multiplication",
    difficulty: "easy",
    questions: [
      { prompt: "Multiply 2 x 4.", answer: "8" },
      { prompt: "Multiply 5 x 3.", answer: "15" },
      { prompt: "Multiply 10 x 6.", answer: "60" },
    ],
  },
  {
    topicId: "multiplication",
    difficulty: "medium",
    questions: [
      { prompt: "Multiply 7 x 8.", answer: "56" },
      { prompt: "Multiply 12 x 4.", answer: "48" },
      { prompt: "Multiply 23 x 3.", answer: "69" },
    ],
  },
  {
    topicId: "multiplication",
    difficulty: "hard",
    questions: [
      {
        prompt: "There are 6 boxes with 24 crayons in each box. How many crayons are there altogether?",
        answer: "144 crayons",
      },
      {
        prompt: "A hall has 8 rows of 15 chairs. How many chairs are in the hall?",
        answer: "120 chairs",
      },
      {
        prompt: "A notebook costs 18 rupees. What is the total cost of 7 notebooks?",
        answer: "₹126",
      },
    ],
  },
];

export const mockQuestions: readonly Question[] = questionGroups.flatMap(
  ({ topicId, difficulty, questions }) =>
    questions.map(({ prompt, answer }, index) => ({
      id: `class-3-mathematics-${topicId}-${difficulty}-${index + 1}`,
      classId: "class-3",
      subjectId: "mathematics",
      topicId,
      difficulty,
      prompt,
      answer,
    })),
);
