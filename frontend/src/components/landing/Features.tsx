import FeatureCard from "./FeatureCard";

export default function Features() {
  return (
    <section className="pb-20">
      <div className="mx-auto grid max-w-6xl gap-6 px-6 md:grid-cols-3">

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
          emoji="👨‍👩‍👧"
          title="For Everyone"
          description="Built for students, parents and teachers."
        />

      </div>
    </section>
  );
}