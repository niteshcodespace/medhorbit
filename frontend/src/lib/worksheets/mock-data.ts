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
  prompts: string[];
}[] = [
  {
    topicId: "addition",
    difficulty: "easy",
    prompts: ["Add 12 + 6.", "Add 23 + 15.", "Add 41 + 8."],
  },
  {
    topicId: "addition",
    difficulty: "medium",
    prompts: ["Add 47 + 38.", "Add 126 + 157.", "Add 268 + 145."],
  },
  {
    topicId: "addition",
    difficulty: "hard",
    prompts: [
      "A library has 248 storybooks and receives 175 more. How many storybooks does it have now?",
      "A school collects 156 bottles on Monday, 238 on Tuesday, and 127 on Wednesday. How many bottles are collected altogether?",
      "A shop sells 285 pencils in the morning and 167 in the afternoon. How many more must it sell to reach 500 pencils?",
    ],
  },
  {
    topicId: "multiplication",
    difficulty: "easy",
    prompts: ["Multiply 2 x 4.", "Multiply 5 x 3.", "Multiply 10 x 6."],
  },
  {
    topicId: "multiplication",
    difficulty: "medium",
    prompts: ["Multiply 7 x 8.", "Multiply 12 x 4.", "Multiply 23 x 3."],
  },
  {
    topicId: "multiplication",
    difficulty: "hard",
    prompts: [
      "There are 6 boxes with 24 crayons in each box. How many crayons are there altogether?",
      "A hall has 8 rows of 15 chairs. How many chairs are in the hall?",
      "A notebook costs 18 rupees. What is the total cost of 7 notebooks?",
    ],
  },
];

export const mockQuestions: readonly Question[] = questionGroups.flatMap(
  ({ topicId, difficulty, prompts }) =>
    prompts.map((prompt, index) => ({
      id: `class-3-mathematics-${topicId}-${difficulty}-${index + 1}`,
      classId: "class-3",
      subjectId: "mathematics",
      topicId,
      difficulty,
      prompt,
    })),
);
