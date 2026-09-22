"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import PrintButton from "./PrintButton";
import WorksheetPreview from "./WorksheetPreview";
import { COLORS, TYPOGRAPHY } from "@/constants";
import { getSavedWorksheet, toWorksheetDomain } from "@/lib/worksheets/saved-client";
import type { Worksheet } from "@/lib/worksheets/types";

type DetailState =
  | { status: "loading" }
  | { status: "found"; worksheet: Worksheet; savedAt: string }
  | { status: "not_found" }
  | { status: "error"; message: string };

const helpClassName = `mt-2 ${TYPOGRAPHY.small} ${COLORS.text.secondary}`;

function formatSavedAt(savedAt: string): string {
  const date = new Date(savedAt);
  return Number.isNaN(date.getTime()) ? savedAt : date.toLocaleString();
}

const BackLink = () => (
  <Link href="/worksheets/saved" className="mt-4 inline-block">
    <Button type="button" className="mt-4">Back to My Worksheets</Button>
  </Link>
);

export default function SavedWorksheetDetail({ id }: { id: string }) {
  const [state, setState] = useState<DetailState>({ status: "loading" });
  const previewHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    let cancelled = false;

    getSavedWorksheet(id).then((result) => {
      if (cancelled) return;
      if (result.status === "found") {
        setState({
          status: "found",
          worksheet: toWorksheetDomain(result.detail),
          savedAt: result.detail.savedAt,
        });
      } else if (result.status === "not_found") {
        setState({ status: "not_found" });
      } else {
        setState({ status: "error", message: result.message });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (state.status === "found") previewHeading.current?.focus();
  }, [state]);

  if (state.status === "loading") {
    return (
      <p role="status" className={helpClassName}>
        Loading your worksheet...
      </p>
    );
  }

  if (state.status === "not_found") {
    return (
      <div>
        <p role="alert" className="text-red-300">
          Worksheet not found.
        </p>
        <BackLink />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div>
        <p role="alert" className="text-red-300">
          {state.message}
        </p>
        <BackLink />
      </div>
    );
  }

  return (
    <div className="worksheet-print-layout space-y-8">
      <div className="worksheet-screen-only flex flex-wrap items-center gap-4">
        <BackLink />
        <p className={helpClassName}>Saved {formatSavedAt(state.savedAt)}</p>
      </div>
      <PrintButton />
      <WorksheetPreview worksheet={state.worksheet} headingRef={previewHeading} />
    </div>
  );
}
