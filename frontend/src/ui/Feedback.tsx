import type { ReactNode } from "react";
import { cn } from "./cn";

export interface EmptyStateProps {
  readonly title: string;
  readonly description?: string;
  readonly icon?: ReactNode;
  readonly action?: ReactNode;
}

/** Neutral placeholder for empty collections or "not yet implemented" panels. */
export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line px-6 py-10 text-center">
      {icon ? <div className="text-content-subtle">{icon}</div> : null}
      <p className="text-sm font-medium text-content">{title}</p>
      {description ? (
        <p className="max-w-sm text-sm text-content-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export interface SkeletonProps {
  readonly className?: string;
}

/** Low-level shimmering placeholder block for loading states. */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-md bg-surface-overlay", className)}
    />
  );
}
