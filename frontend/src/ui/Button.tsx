import type { ButtonHTMLAttributes } from "react";
import { cn } from "./cn";

export type ButtonVariant = "primary" | "secondary" | "ghost";
export type ButtonSize = "sm" | "md";

const VARIANT_CLASSES: Readonly<Record<ButtonVariant, string>> = {
  primary: "bg-accent text-accent-contrast hover:bg-accent-hover font-medium",
  secondary:
    "bg-surface-raised text-content border border-line-strong hover:bg-surface-overlay",
  ghost: "text-content-muted hover:text-content hover:bg-surface-overlay",
};

const SIZE_CLASSES: Readonly<Record<ButtonSize, string>> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
}

/** Shared button primitive. Defaults to `type="button"` to avoid form submits. */
export function Button({
  variant = "secondary",
  size = "md",
  type = "button",
  className,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md transition-colors duration-(--duration-fast)",
        "disabled:cursor-not-allowed disabled:opacity-50",
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      )}
      {...rest}
    />
  );
}
