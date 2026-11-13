import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Accessible name; also used as the tooltip/title. */
  readonly label: string;
  readonly children: ReactNode;
}

/** Square, icon-only button for dense chrome (header, sidebar). */
export function IconButton({
  label,
  type = "button",
  className,
  children,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-md text-content-muted",
        "transition-colors duration-(--duration-fast) hover:bg-surface-overlay hover:text-content",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
