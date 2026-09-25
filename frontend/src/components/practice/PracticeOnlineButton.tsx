"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import { authClient } from "@/lib/auth/client";
import { startPracticeAttempt } from "@/lib/practice/client";

type ButtonState =
  | { status: "idle" }
  | { status: "starting" }
  | { status: "error"; message: string };

const UNAUTHORIZED_MESSAGE = "Sign in to practice this worksheet online.";
const NOT_FOUND_MESSAGE = "This worksheet is no longer available.";
const UNSUPPORTED_MESSAGE = "This worksheet can't be practiced online yet.";
const GENERIC_MESSAGE = "Could not start practice. Please try again.";

/**
 * "Practice Online" entry point for the saved-worksheet detail page.
 * Practice is authenticated-only (Phase 10 product decision): this
 * renders nothing for a signed-out viewer or while the session is still
 * resolving, rather than showing an action that would only fail. If a
 * signed-in viewer can see this worksheet's detail page at all, the
 * worksheet is guaranteed to be theirs - getByIdForOwner never falls
 * back to anonymous access for an authenticated request (Phase 9D-4B),
 * so an authenticated viewer could not be looking at somebody else's
 * worksheet here in the first place.
 *
 * Starting practice sends no request body - worksheetId is the only
 * input, taken from the trusted route param already used to load this
 * page; ownerId/userId/questionCount are never sent, matching the
 * Phase 10C API's contract of deriving them all server-side.
 */
export default function PracticeOnlineButton({ worksheetId }: { worksheetId: string }) {
  const { data, isPending } = authClient.useSession();
  const router = useRouter();
  const [state, setState] = useState<ButtonState>({ status: "idle" });

  if (isPending || !data) return null;

  async function handleClick() {
    if (state.status === "starting") return;
    setState({ status: "starting" });

    const result = await startPracticeAttempt(worksheetId);
    switch (result.status) {
      case "created":
        // Stay disabled through navigation - this also prevents a second
        // click from starting a duplicate attempt while the page transitions.
        router.push(`/practice/${result.attemptId}`);
        return;
      case "unauthorized":
        setState({ status: "error", message: UNAUTHORIZED_MESSAGE });
        return;
      case "not_found":
        setState({ status: "error", message: NOT_FOUND_MESSAGE });
        return;
      case "unsupported_question_type":
        setState({ status: "error", message: UNSUPPORTED_MESSAGE });
        return;
      case "error":
        setState({ status: "error", message: result.message || GENERIC_MESSAGE });
    }
  }

  return (
    <div className="worksheet-screen-only">
      <Button
        type="button"
        onClick={handleClick}
        disabled={state.status === "starting"}
        className="w-full sm:w-auto"
      >
        {state.status === "starting" ? "Starting practice..." : "Practice Online"}
      </Button>
      {state.status === "error" && (
        <p role="alert" className="mt-2 text-sm text-red-300">
          {state.message}
        </p>
      )}
    </div>
  );
}
