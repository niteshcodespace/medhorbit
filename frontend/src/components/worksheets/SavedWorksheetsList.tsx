"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { COLORS, TYPOGRAPHY } from "@/constants";
import { curriculum } from "@/lib/worksheets/mock-data";
import { listSavedWorksheets, type SavedWorksheetSummary } from "@/lib/worksheets/saved-client";

type ListState =
  | { status: "loading" }
  | { status: "success"; worksheets: SavedWorksheetSummary[] }
  | { status: "error"; message: string };

const helpClassName = `mt-2 ${TYPOGRAPHY.small} ${COLORS.text.secondary}`;

function labelsFor(worksheet: SavedWorksheetSummary) {
  const selectedClass = curriculum.find((item) => item.id === worksheet.classId);
  const subject = selectedClass?.subjects.find((item) => item.id === worksheet.subjectId);
  const topic = subject?.topics.find((item) => item.id === worksheet.topicId);
  return {
    classLabel: selectedClass?.label ?? worksheet.classId,
    subjectLabel: subject?.label ?? worksheet.subjectId,
    topicLabel: topic?.label ?? worksheet.topicId,
  };
}

function formatSavedAt(savedAt: string): string {
  const date = new Date(savedAt);
  return Number.isNaN(date.getTime()) ? savedAt : date.toLocaleString();
}

export default function SavedWorksheetsList() {
  const [state, setState] = useState<ListState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    listSavedWorksheets()
      .then((worksheets) => {
        if (!cancelled) setState({ status: "success", worksheets });
      })
      .catch((error) => {
        if (!cancelled) {
          setState({
            status: "error",
            message: error instanceof Error && error.message
              ? error.message
              : "Unable to load saved worksheets. Please try again.",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === "loading") {
    return (
      <p role="status" className={helpClassName}>
        Loading your saved worksheets...
      </p>
    );
  }

  if (state.status === "error") {
    return (
      <div>
        <p role="alert" className="text-red-300">
          {state.message}
        </p>
        <Link href="/worksheets" className="mt-4 inline-block">
          <Button type="button" className="mt-4">Back to Worksheet Generator</Button>
        </Link>
      </div>
    );
  }

  if (state.worksheets.length === 0) {
    return (
      <div>
        <p className={COLORS.text.secondary}>You haven&apos;t saved any worksheets yet.</p>
        <Link href="/worksheets" className="mt-4 inline-block">
          <Button type="button" className="mt-4">Back to Worksheet Generator</Button>
        </Link>
      </div>
    );
  }

  return (
    <ul className="space-y-4">
      {state.worksheets.map((worksheet) => {
        const { classLabel, subjectLabel, topicLabel } = labelsFor(worksheet);
        return (
          <li key={worksheet.id}>
            <Card>
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <dt className={COLORS.text.secondary}>Class</dt>
                  <dd className="font-semibold">{classLabel}</dd>
                </div>
                <div>
                  <dt className={COLORS.text.secondary}>Subject</dt>
                  <dd className="font-semibold">{subjectLabel}</dd>
                </div>
                <div>
                  <dt className={COLORS.text.secondary}>Topic</dt>
                  <dd className="font-semibold">{topicLabel}</dd>
                </div>
                <div>
                  <dt className={COLORS.text.secondary}>Difficulty</dt>
                  <dd className="font-semibold capitalize">{worksheet.difficulty}</dd>
                </div>
                <div>
                  <dt className={COLORS.text.secondary}>Question Count</dt>
                  <dd className="font-semibold">{worksheet.questionCount}</dd>
                </div>
                <div>
                  <dt className={COLORS.text.secondary}>Saved</dt>
                  <dd className="font-semibold">{formatSavedAt(worksheet.savedAt)}</dd>
                </div>
              </dl>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
