import type { Metadata } from "next";
import Link from "next/link";
import Container from "@/components/common/Container";
import Section from "@/components/common/Section";
import Footer from "@/components/layout/Footer";
import Navbar from "@/components/layout/Navbar";
import SavedWorksheetsList from "@/components/worksheets/SavedWorksheetsList";
import { COLORS, TYPOGRAPHY } from "@/constants";

export const metadata: Metadata = {
  title: "My Worksheets | MedhOrbit",
  description: "Worksheets you have saved from the MedhOrbit worksheet generator.",
};

export default function SavedWorksheetsPage() {
  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-lg focus:bg-slate-900 focus:p-4"
      >
        Skip to main content
      </a>
      <Navbar />
      <main id="main-content" tabIndex={-1} className="flex-1">
        <Section aria-labelledby="saved-worksheets-title">
          <Container>
            <div className="mx-auto max-w-3xl">
              <h1 id="saved-worksheets-title" className={TYPOGRAPHY.sectionTitle}>
                My Worksheets
              </h1>
              <p className={`mt-4 mb-4 ${TYPOGRAPHY.body} ${COLORS.text.secondary}`}>
                Your saved worksheets.
              </p>
              <Link href="/worksheets" className="mb-8 inline-block">
                <span className={`${TYPOGRAPHY.small} underline ${COLORS.text.secondary} hover:text-white`}>
                  &larr; Back to Worksheet Generator
                </span>
              </Link>
              <div className="mt-6">
                <SavedWorksheetsList />
              </div>
            </div>
          </Container>
        </Section>
      </main>
      <Footer />
    </>
  );
}
