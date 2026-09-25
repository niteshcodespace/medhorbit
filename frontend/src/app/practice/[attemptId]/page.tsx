import type { Metadata } from "next";
import Container from "@/components/common/Container";
import Section from "@/components/common/Section";
import Footer from "@/components/layout/Footer";
import Navbar from "@/components/layout/Navbar";
import PracticeSession from "@/components/practice/PracticeSession";
import { TYPOGRAPHY } from "@/constants";

export const metadata: Metadata = {
  title: "Practice | MedhOrbit",
  description: "Practice a saved worksheet online, one question at a time.",
};

export default async function PracticeAttemptPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const { attemptId } = await params;

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
        <Section aria-labelledby="practice-title">
          <Container>
            <div className="mx-auto max-w-2xl">
              <h1 id="practice-title" className={TYPOGRAPHY.sectionTitle}>
                Practice
              </h1>
              <PracticeSession attemptId={attemptId} />
            </div>
          </Container>
        </Section>
      </main>
      <Footer />
    </>
  );
}
