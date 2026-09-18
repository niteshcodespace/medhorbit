import Card from "@/components/ui/Card";
import { COLORS, TYPOGRAPHY } from "@/constants";

type FeatureCardProps = {
  id?: string;
  emoji: string;
  title: string;
  description: string;
};

export default function FeatureCard({
  id,
  emoji,
  title,
  description,
}: FeatureCardProps) {
  return (
    <Card>
      <h3 id={id} tabIndex={id ? -1 : undefined} className="mb-2 scroll-mt-6 text-xl font-bold">
        <span aria-hidden="true">{emoji}</span> {title}
      </h3>

      <p className={`${TYPOGRAPHY.body} ${COLORS.text.secondary}`}>{description}</p>
    </Card>
  );
}
