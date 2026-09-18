import { buttonClassName } from "@/components/ui/Button";
import Container from "@/components/common/Container";
import Section from "@/components/common/Section";
import { COLORS, TYPOGRAPHY } from "@/constants";

export default function Hero() {
  return (
    <Section aria-labelledby="hero-title" className="flex items-center">
      <Container>

        <div className="flex flex-col items-center text-center">

          <span className="mb-4 rounded-full border border-blue-400/30 bg-blue-500/10 px-4 py-2 text-sm text-blue-300">
            <span aria-hidden="true">🚀</span> Welcome to MedhOrbit
          </span>

          <h1 id="hero-title" className={`mb-6 ${TYPOGRAPHY.heroTitle}`}>
            Learn Smarter.
            <br />
            Grow Brighter.
          </h1>

          <p className={`mb-10 max-w-2xl ${TYPOGRAPHY.body} ${COLORS.text.secondary}`}>
            AI-powered worksheets, quizzes and learning tools designed for
            students, parents and teachers.
          </p>

          <div className="flex w-full flex-col gap-4 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-center">
            <a href="#features" className={buttonClassName({ size: "lg" })}>
              Explore Features
            </a>

            <a href="#for-everyone" className={buttonClassName({ variant: "outline", size: "lg" })}>
              Who It’s For
            </a>
          </div>

        </div>

      </Container>
    </Section>
  );
}
