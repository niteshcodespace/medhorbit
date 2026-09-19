"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { COLORS, TYPOGRAPHY } from "@/constants";
import { curriculum, difficulties, mockQuestions } from "@/lib/worksheets/mock-data";
import type { WorksheetConfig } from "@/lib/worksheets/types";

type WorksheetFormValues = Omit<WorksheetConfig, "difficulty" | "questionCount"> & {
  difficulty: WorksheetConfig["difficulty"] | "";
  questionCount: number | "";
};

const selectClassName =
  "mt-2 min-h-11 w-full rounded-lg border border-slate-500 bg-slate-900 px-3 py-2 text-white disabled:cursor-not-allowed disabled:opacity-60";
const helpClassName = `mt-2 ${TYPOGRAPHY.small} ${COLORS.text.secondary}`;

export default function WorksheetGenerator() {
  const [values, setValues] = useState<WorksheetFormValues>({
    classId: "",
    subjectId: "",
    topicId: "",
    difficulty: "",
    questionCount: "",
  });

  const selectedClass = curriculum.find((item) => item.id === values.classId);
  const selectedSubject = selectedClass?.subjects.find(
    (item) => item.id === values.subjectId,
  );
  const selectedTopic = selectedSubject?.topics.find(
    (item) => item.id === values.topicId,
  );
  // The current mock bank contains unique questions for each configuration.
  const availableCount = selectedTopic && values.difficulty
    ? mockQuestions.filter(
        (question) =>
          question.classId === values.classId &&
          question.subjectId === values.subjectId &&
          question.topicId === values.topicId &&
          question.difficulty === values.difficulty,
      ).length
    : 0;
  const isComplete = Boolean(
    selectedTopic && values.difficulty && values.questionCount !== "" &&
    values.questionCount > 0 && values.questionCount <= availableCount,
  );

  return (
    <Card>
      <form aria-label="Worksheet configuration" onSubmit={(event) => event.preventDefault()}>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label htmlFor="worksheet-class" className="font-semibold">Class</label>
            <select
              id="worksheet-class"
              name="classId"
              required
              value={values.classId}
              className={selectClassName}
              onChange={(event) => setValues({
                ...values, classId: event.target.value, subjectId: "", topicId: "", questionCount: "",
              })}
            >
              <option value="">Select a class</option>
              {curriculum.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </div>

          <div>
            <label htmlFor="worksheet-subject" className="font-semibold">Subject</label>
            <select
              id="worksheet-subject"
              name="subjectId"
              required
              disabled={!selectedClass}
              aria-describedby="worksheet-subject-help"
              value={values.subjectId}
              className={selectClassName}
              onChange={(event) => setValues({
                ...values, subjectId: event.target.value, topicId: "", questionCount: "",
              })}
            >
              <option value="">Select a subject</option>
              {selectedClass?.subjects.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
            <p id="worksheet-subject-help" className={helpClassName}>
              {selectedClass ? "Subjects available for your selected class." : "Choose a class to enable Subject."}
            </p>
          </div>

          <div>
            <label htmlFor="worksheet-topic" className="font-semibold">Topic</label>
            <select
              id="worksheet-topic"
              name="topicId"
              required
              disabled={!selectedSubject}
              aria-describedby="worksheet-topic-help"
              value={values.topicId}
              className={selectClassName}
              onChange={(event) => setValues({ ...values, topicId: event.target.value, questionCount: "" })}
            >
              <option value="">Select a topic</option>
              {selectedSubject?.topics.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
            <p id="worksheet-topic-help" className={helpClassName}>
              {selectedSubject ? "Topics available for your selected subject." : "Choose a subject to enable Topic."}
            </p>
          </div>

          <div>
            <label htmlFor="worksheet-difficulty" className="font-semibold">Difficulty</label>
            <select
              id="worksheet-difficulty"
              name="difficulty"
              required
              value={values.difficulty}
              className={selectClassName}
              onChange={(event) => {
                const difficulty = difficulties.find((item) => item === event.target.value) ?? "";
                setValues({ ...values, difficulty, questionCount: "" });
              }}
            >
              <option value="">Select a difficulty</option>
              {difficulties.map((difficulty) => (
                <option key={difficulty} value={difficulty}>
                  {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="worksheet-count" className="font-semibold">Question Count</label>
            <select
              id="worksheet-count"
              name="questionCount"
              required
              disabled={availableCount === 0}
              aria-describedby="worksheet-count-help"
              value={values.questionCount}
              className={selectClassName}
              onChange={(event) => setValues({
                ...values, questionCount: event.target.value === "" ? "" : Number(event.target.value),
              })}
            >
              <option value="">Select a question count</option>
              {Array.from({ length: availableCount }, (_, index) => index + 1).map((count) => (
                <option key={count} value={count}>{count}</option>
              ))}
            </select>
            <p id="worksheet-count-help" className={helpClassName} aria-live="polite">
              {!selectedTopic || !values.difficulty
                ? "Choose a class, subject, topic, and difficulty to enable Question Count."
                : availableCount > 0
                  ? `Choose up to ${availableCount} questions for this selection.`
                  : "No sample questions are available for this selection."}
            </p>
          </div>
        </div>

        <div className="mt-8 border-t border-white/10 pt-6">
          <p id="worksheet-generation-note" className={`mb-4 ${COLORS.text.secondary}`}>
            You can configure your worksheet here. Generation and preview are not available yet.
          </p>
          <Button disabled aria-describedby="worksheet-generation-note" className="w-full sm:w-auto">
            Generate Worksheet
          </Button>
          <p role="status" className={helpClassName}>
            {isComplete ? "Configuration complete. Generation is coming soon." : "Complete all five fields to configure your worksheet."}
          </p>
        </div>
      </form>
    </Card>
  );
}
