import type { Metadata } from "next";
import Link from "next/link";
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
      <main id="main-content" tabIndex={-1} className="worksheet-page worksheet-print-layout flex-1">
        <Section aria-labelledby="worksheets-title" className="worksheet-print-layout">
          <Container className="worksheet-print-layout">
            <div className="worksheet-print-layout mx-auto max-w-3xl">
              <h1 id="worksheets-title" className={`worksheet-screen-only ${TYPOGRAPHY.sectionTitle}`}>
                Worksheet Generator
              </h1>
              <p className={`worksheet-screen-only mt-4 mb-4 ${TYPOGRAPHY.body} ${COLORS.text.secondary}`}>
                Choose your worksheet settings from our small sample curriculum.
                All fields are required.
              </p>
              <Link href="/worksheets/saved" className="worksheet-screen-only mb-8 inline-block">
                <span className={`${TYPOGRAPHY.small} underline ${COLORS.text.secondary} hover:text-white`}>
                  My Worksheets
                </span>
              </Link>
              <WorksheetGenerator />
            </div>
          </Container>
        </Section>
      </main>
      <Footer />
    </>
  );
}
