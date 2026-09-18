import { SPACING } from "@/constants";
import type { ComponentPropsWithRef } from "react";

type SectionProps = ComponentPropsWithRef<"section">;

export default function Section({
  children,
  className = "",
  ...props
}: SectionProps) {
  return (
    <section {...props} className={`${SPACING.section} ${className}`}>
      {children}
    </section>
  );
}
