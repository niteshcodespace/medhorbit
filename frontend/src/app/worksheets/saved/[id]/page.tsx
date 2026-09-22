import type { Metadata } from "next";
import Container from "@/components/common/Container";
import Section from "@/components/common/Section";
import Footer from "@/components/layout/Footer";
import Navbar from "@/components/layout/Navbar";
import SavedWorksheetDetail from "@/components/worksheets/SavedWorksheetDetail";
import { COLORS, TYPOGRAPHY } from "@/constants";

export const metadata: Metadata = {
  title: "Saved Worksheet | MedhOrbit",
  description: "View a worksheet you previously saved from the MedhOrbit worksheet generator.",
};

export default async function SavedWorksheetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

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
        <Section aria-labelledby="saved-worksheet-title" className="worksheet-print-layout">
          <Container className="worksheet-print-layout">
            <div className="worksheet-print-layout mx-auto max-w-3xl">
              <h1
                id="saved-worksheet-title"
                className={`worksheet-screen-only ${TYPOGRAPHY.sectionTitle}`}
              >
                Saved Worksheet
              </h1>
              <p className={`worksheet-screen-only mt-4 mb-8 ${TYPOGRAPHY.body} ${COLORS.text.secondary}`}>
                The exact worksheet you saved, including its answer key.
              </p>
              <SavedWorksheetDetail id={id} />
            </div>
          </Container>
        </Section>
      </main>
      <Footer />
    </>
  );
}
