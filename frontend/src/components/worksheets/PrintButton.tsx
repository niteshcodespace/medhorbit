"use client";

import Button from "@/components/ui/Button";

/**
 * The single "Print / Save as PDF" action, shared by the generator and the
 * saved-worksheet detail page. Relies on the existing print CSS (see
 * globals.css), which prints whatever `.worksheet-print` content is mounted
 * under `.worksheet-page` - this button only triggers it.
 */
export default function PrintButton() {
  return (
    <div className="worksheet-screen-only">
      <Button type="button" onClick={() => window.print()} className="w-full sm:w-auto">
        Print / Save as PDF
      </Button>
    </div>
  );
}
