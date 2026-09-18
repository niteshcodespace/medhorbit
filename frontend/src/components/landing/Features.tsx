import FeatureCard from "./FeatureCard";
import Container from "@/components/common/Container";
import Section from "@/components/common/Section";
import { TYPOGRAPHY } from "@/constants";

export default function Features() {
  return (
    <Section id="features" tabIndex={-1} aria-labelledby="features-title">
      <Container>
        <h2 id="features-title" className={`mb-10 text-center ${TYPOGRAPHY.sectionTitle}`}>
          Learning with MedhOrbit
        </h2>
        <div className="grid gap-6 md:grid-cols-3">

        <FeatureCard
          emoji="📚"
          title="CBSE Ready"
          description="Worksheets aligned with the latest CBSE curriculum."
        />

        <FeatureCard
          emoji="🤖"
          title="AI Powered"
          description="Generate unique worksheets in seconds."
        />

        <FeatureCard
          id="for-everyone"
          emoji="👨‍👩‍👧"
          title="For Everyone"
          description="Built for students, parents and teachers."
        />

        </div>
      </Container>
    </Section>
  );
}
