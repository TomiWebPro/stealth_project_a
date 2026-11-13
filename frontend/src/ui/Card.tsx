import type { ReactNode } from "react";
import { cn } from "./cn";

export interface CardProps {
  readonly children: ReactNode;
  readonly className?: string;
}

/** Base surface panel used for grouping related content. */
export function Card({ children, className }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-line bg-surface shadow-panel",
        className,
      )}
    >
      {children}
    </div>
  );
}

export interface SectionHeaderProps {
  readonly title: string;
  readonly description?: string;
  readonly action?: ReactNode;
}

/** Heading row for a {@link Card} or page section. */
export function SectionHeader({ title, description, action }: SectionHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-content">{title}</h2>
        {description ? (
          <p className="mt-0.5 text-sm text-content-muted">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
