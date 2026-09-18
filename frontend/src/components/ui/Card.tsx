import { SPACING } from "@/constants";

type CardProps = {
  children: React.ReactNode;
};

export default function Card({ children }: CardProps) {
  return (
    <div
      className={`
      rounded-2xl
      bg-white/5
      ${SPACING.card}
      backdrop-blur
      border
      border-white/10
      `}
    >
      {children}
    </div>
  );
}
