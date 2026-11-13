import { cn } from "./cn";

export interface ProgressBarProps {
  /** Normalized progress in the 0..1 range. */
  readonly value: number;
  readonly label: string;
  readonly className?: string;
}

/** Accessible determinate progress bar; clamps and formats internally. */
export function ProgressBar({ value, label, className }: ProgressBarProps) {
  const clamped = Math.min(1, Math.max(0, value));
  const percent = Math.round(clamped * 100);

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-surface-overlay", className)}
    >
      <div
        className="h-full rounded-full bg-accent transition-[width] duration-(--duration-base)"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
