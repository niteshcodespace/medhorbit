import type { Metadata } from "next";
import Container from "@/components/common/Container";
import Section from "@/components/common/Section";
import Footer from "@/components/layout/Footer";
import Navbar from "@/components/layout/Navbar";
import WorksheetGenerator from "@/components/worksheets/WorksheetGenerator";
import { COLORS, TYPOGRAPHY } from "@/constants";

export const metadata: Metadata = {
  title: "Worksheet Generator | MedhOrbit",
  description:
    "Choose a class, subject, topic, difficulty, and question count for your MedhOrbit worksheet.",
};

export default function WorksheetsPage() {
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
        <Section aria-labelledby="worksheets-title">
          <Container>
            <div className="mx-auto max-w-3xl">
              <h1 id="worksheets-title" className={TYPOGRAPHY.sectionTitle}>
                Worksheet Generator
              </h1>
              <p className={`mt-4 mb-8 ${TYPOGRAPHY.body} ${COLORS.text.secondary}`}>
                Choose your worksheet settings from our small sample curriculum.
                All fields are required.
              </p>
              <WorksheetGenerator />
            </div>
          </Container>
        </Section>
      </main>
      <Footer />
    </>
  );
}
