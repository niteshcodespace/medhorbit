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
  // Class 5 (Math Mela) chapters. The catalog has no chapter level yet,
  // so each topic label carries its chapter number and name.
  {
    id: "class-5",
    label: "Class 5",
    subjects: [
      {
        id: "mathematics",
        label: "Mathematics",
        topics: [
          { id: "story-comprehension", label: "Chapter 1: We the Travellers—I: Story Comprehension" },
          { id: "mental-math-strategies", label: "Chapter 1: We the Travellers—I: Mental Math Strategies" },
          { id: "number-patterns", label: "Chapter 1: We the Travellers—I: Number Patterns" },
          { id: "fractions-introduction", label: "Chapter 2: Fractions: Introduction to Fractions" },
          { id: "fractions-adding", label: "Chapter 2: Fractions: Adding Fractions" },
          { id: "fractions-subtracting", label: "Chapter 2: Fractions: Subtracting Fractions" },
          { id: "fractions-multiplying", label: "Chapter 2: Fractions: Multiplying Fractions" },
          { id: "fractions-dividing", label: "Chapter 2: Fractions: Dividing Fractions" },
          { id: "fractions-comparing", label: "Chapter 2: Fractions: Comparing Fractions" },
          { id: "angles-introduction", label: "Chapter 3: Angles as Turns: Introduction to Angles" },
          { id: "angles-turns-rotations", label: "Chapter 3: Angles as Turns: Turns and Rotations" },
          { id: "angles-measurement", label: "Chapter 3: Angles as Turns: Measuring Angles" },
          { id: "story-problems", label: "Chapter 4: We the Travellers—II: Story Problems" },
          { id: "word-problems", label: "Chapter 4: We the Travellers—II: Word Problems" },
          { id: "estimation", label: "Chapter 4: We the Travellers—II: Estimation" },
          { id: "measurement-distance", label: "Chapter 5: Far and Near: Measuring Distance" },
          { id: "measurement-length", label: "Chapter 5: Far and Near: Length Measurement" },
          { id: "measurement-units", label: "Chapter 5: Far and Near: Units of Measurement" },
          { id: "real-world-math", label: "Chapter 6: The Dairy Farm: Real-World Math Applications" },
          { id: "multiplication-application", label: "Chapter 6: The Dairy Farm: Multiplication in Practice" },
          { id: "data-collection", label: "Chapter 6: The Dairy Farm: Data Collection" },
          { id: "shapes-2d", label: "Chapter 7: Shapes and Patterns: 2D Shapes" },
          { id: "shapes-3d", label: "Chapter 7: Shapes and Patterns: 3D Shapes" },
          { id: "patterns-sequences", label: "Chapter 7: Shapes and Patterns: Number Sequences" },
          { id: "patterns-symmetry", label: "Chapter 7: Shapes and Patterns: Symmetry Patterns" },
          { id: "weight-measurement", label: "Chapter 8: Weight and Capacity: Measuring Weight" },
          { id: "capacity-measurement", label: "Chapter 8: Weight and Capacity: Measuring Capacity" },
          { id: "units-conversion", label: "Chapter 8: Weight and Capacity: Unit Conversions" },
          { id: "real-world-problems", label: "Chapter 9: Coconut Farm: Real-World Problem Solving" },
          { id: "area-perimeter", label: "Chapter 9: Coconut Farm: Area and Perimeter" },
          { id: "practical-applications", label: "Chapter 9: Coconut Farm: Practical Applications" },
          { id: "symmetry-lines", label: "Chapter 10: Symmetrical Designs: Lines of Symmetry" },
          { id: "symmetry-patterns", label: "Chapter 10: Symmetrical Designs: Symmetry in Patterns" },
          { id: "symmetry-designs", label: "Chapter 10: Symmetrical Designs: Creating Symmetrical Designs" },
          { id: "pattern-recognition", label: "Chapter 11: Grandmother's Quilt: Pattern Recognition" },
          { id: "geometric-designs", label: "Chapter 11: Grandmother's Quilt: Geometric Designs" },
          { id: "shape-combination", label: "Chapter 11: Grandmother's Quilt: Combining Shapes" },
          { id: "time-measurement", label: "Chapter 12: Racing Seconds: Measuring Time" },
          { id: "time-conversion", label: "Chapter 12: Racing Seconds: Time Conversions" },
          { id: "time-word-problems", label: "Chapter 12: Racing Seconds: Time-Based Word Problems" },
          { id: "distance-measurement", label: "Chapter 13: Animal Jumps: Measuring Distance" },
          { id: "speed-distance", label: "Chapter 13: Animal Jumps: Speed and Distance" },
          { id: "comparison", label: "Chapter 13: Animal Jumps: Comparing Distances" },
          { id: "spatial-reasoning", label: "Chapter 14: Maps and Locations: Spatial Reasoning" },
          { id: "coordinates", label: "Chapter 14: Maps and Locations: Coordinates and Grids" },
          { id: "map-interpretation", label: "Chapter 14: Maps and Locations: Reading Maps" },
          { id: "graphs-reading", label: "Chapter 15: Data Through Pictures: Reading Graphs" },
          { id: "data-interpretation", label: "Chapter 15: Data Through Pictures: Interpreting Data" },
          { id: "pictographs", label: "Chapter 15: Data Through Pictures: Pictographs" },
        ],
      },
    ],
  },
];

export const difficulties: readonly Difficulty[] = ["easy", "medium", "hard"];

// Question counts offered for AI-generated (Class 5) worksheets.
export const supportedQuestionCounts: readonly number[] = [5, 10, 15];

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
