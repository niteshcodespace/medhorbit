import { SPACING } from "@/constants";
import type { ComponentPropsWithRef } from "react";

type ContainerProps = ComponentPropsWithRef<"div">;

export default function Container({ children, className = "", ...props }: ContainerProps) {
  return (
    <div {...props} className={`${SPACING.container} ${className}`}>
      {children}
    </div>
  );
}
