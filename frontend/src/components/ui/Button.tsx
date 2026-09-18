import type { ComponentPropsWithRef } from "react";
import { COLORS } from "@/constants";

type ButtonStyleProps = {
  variant?: "primary" | "secondary" | "outline";
  size?: "sm" | "md" | "lg";
  className?: string;
};

type ButtonProps = ComponentPropsWithRef<"button"> & ButtonStyleProps;

const variants = {
  primary: `${COLORS.primary} ${COLORS.primaryHover} disabled:hover:bg-blue-600 text-white`,
  secondary: `${COLORS.secondary} ${COLORS.secondaryHover} disabled:hover:bg-slate-800 text-white`,
  outline: "border border-slate-500 hover:bg-slate-800 disabled:hover:bg-transparent text-white",
};

const sizes = {
  sm: "px-4 py-2 text-sm",
  md: "px-6 py-3 text-base",
  lg: "px-8 py-4 text-lg",
};

// Share presentation while keeping navigation as links and actions as buttons.
export function buttonClassName({
  variant = "primary",
  size = "md",
  className = "",
}: ButtonStyleProps = {}) {
  return `inline-flex min-h-11 items-center justify-center rounded-xl font-semibold text-center transition-colors motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`;
}

export default function Button({
  children,
  variant,
  size,
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={buttonClassName({ variant, size, className })}
    >
      {children}
    </button>
  );
}
