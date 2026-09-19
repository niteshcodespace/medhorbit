"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import WorksheetPreview from "./WorksheetPreview";
import { COLORS, TYPOGRAPHY } from "@/constants";
import { curriculum, difficulties, mockQuestions } from "@/lib/worksheets/mock-data";
import { generateWorksheet } from "@/lib/worksheets/generateWorksheet";
import type { Worksheet, WorksheetConfig } from "@/lib/worksheets/types";

type WorksheetFormValues = Omit<WorksheetConfig, "difficulty" | "questionCount"> & {
  difficulty: WorksheetConfig["difficulty"] | "";
  questionCount: number | "";
};

type GenerationState =
  | { status: "idle" }
  | { status: "generating" }
  | { status: "success"; worksheet: Worksheet }
  | { status: "error"; message: string };

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
  const [generation, setGeneration] = useState<GenerationState>({ status: "idle" });
  const nextRequest = useRef(0);
  const activeRequest = useRef<number | null>(null);
  const previewHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (generation.status === "success") {
      previewHeading.current?.focus();
    }
  }, [generation]);

  useEffect(() => () => {
    activeRequest.current = null;
  }, []);

  function updateValues(nextValues: WorksheetFormValues) {
    // Discard pending results as well as the visible preview when settings change.
    activeRequest.current = null;
    setValues(nextValues);
    setGeneration({ status: "idle" });
  }

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
    Number.isSafeInteger(values.questionCount) &&
    values.questionCount > 0 && values.questionCount <= availableCount,
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // The ref also blocks repeated submissions before React renders the disabled button.
    if (activeRequest.current !== null) return;
    if (!isComplete || values.difficulty === "" || values.questionCount === "") {
      setGeneration({ status: "error", message: "Choose a valid value for all five fields before generating." });
      return;
    }

    const requestId = ++nextRequest.current;
    activeRequest.current = requestId;
    setGeneration({ status: "generating" });

    try {
      const worksheet = await generateWorksheet({
        ...values,
        difficulty: values.difficulty,
        questionCount: values.questionCount,
      });
      if (activeRequest.current === requestId) {
        setGeneration({ status: "success", worksheet });
      }
    } catch (error) {
      if (activeRequest.current === requestId) {
        setGeneration({
          status: "error",
          message: error instanceof Error && error.message
            ? error.message
            : "We could not generate your worksheet. Please try again.",
        });
      }
    } finally {
      if (activeRequest.current === requestId) activeRequest.current = null;
    }
  }

  return (
    <div className="space-y-8">
    <Card>
      <form
        aria-label="Worksheet configuration"
        aria-busy={generation.status === "generating"}
        onSubmit={handleSubmit}
      >
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label htmlFor="worksheet-class" className="font-semibold">Class</label>
            <select
              id="worksheet-class"
              name="classId"
              required
              value={values.classId}
              className={selectClassName}
              onChange={(event) => updateValues({
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
              onChange={(event) => updateValues({
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
              onChange={(event) => updateValues({ ...values, topicId: event.target.value, questionCount: "" })}
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
                updateValues({ ...values, difficulty, questionCount: "" });
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
              onChange={(event) => updateValues({
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
            Generate a worksheet from our sample questions. Changing any setting clears the preview.
          </p>
          <Button
            type="submit"
            disabled={!isComplete || generation.status === "generating"}
            aria-describedby="worksheet-generation-note"
            className="w-full sm:w-auto"
          >
            {generation.status === "generating" ? "Generating..." : "Generate Worksheet"}
          </Button>
        </div>
      </form>
      <p role="status" className={helpClassName}>
        {generation.status === "generating"
          ? "Generating your worksheet..."
          : generation.status === "success"
            ? "Worksheet generated. Preview is ready below."
            : generation.status === "error"
              ? "Your selections have been kept. You can try again or change your settings."
              : isComplete
                ? "Configuration complete. Ready to generate."
                : "Complete all five fields to configure your worksheet."}
      </p>
      <p role="alert" className="mt-2 text-red-300">
        {generation.status === "error" ? generation.message : ""}
      </p>
    </Card>
    {generation.status === "success" && (
      <WorksheetPreview worksheet={generation.worksheet} headingRef={previewHeading} />
    )}
    </div>
  );
}
