import Card from "@/components/ui/Card";

type FeatureCardProps = {
  emoji: string;
  title: string;
  description: string;
};

export default function FeatureCard({
  emoji,
  title,
  description,
}: FeatureCardProps) {
  return (
    <Card>
      <h3 className="mb-2 text-xl font-bold">
        {emoji} {title}
      </h3>

      <p className="text-slate-400">{description}</p>
    </Card>
  );
}