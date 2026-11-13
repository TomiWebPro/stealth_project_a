import { cn } from "./cn";

export type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger" | "info";

const TONE_CLASSES: Readonly<Record<BadgeTone, string>> = {
  neutral: "bg-surface-overlay text-content-muted border-line",
  accent: "bg-accent-muted text-accent border-accent/40",
  success: "bg-success/15 text-success border-success/35",
  warning: "bg-warning/15 text-warning border-warning/35",
  danger: "bg-danger/15 text-danger border-danger/35",
  info: "bg-info/15 text-info border-info/35",
};

export interface BadgeProps {
  readonly tone?: BadgeTone;
  readonly children: string;
  readonly className?: string;
}

/** Compact status/label pill, used for tags, job states, provider health. */
export function Badge({ tone = "neutral", children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-2xs font-medium uppercase tracking-wide",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
