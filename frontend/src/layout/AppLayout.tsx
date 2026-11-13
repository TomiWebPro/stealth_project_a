import type { ReactNode } from "react";

export interface AppLayoutProps {
  readonly header?: ReactNode;
  readonly sidebar: ReactNode;
  readonly children: ReactNode;
}

/**
 * Reusable application shell: fixed header, persistent sidebar, scrollable main.
 * Layout only — it renders slots and owns no domain logic.
 */
export function AppLayout({ header, sidebar, children }: AppLayoutProps) {
  return (
    <div className="flex h-full flex-col bg-canvas text-content">
      {header}
      <div className="flex min-h-0 flex-1">
        {sidebar}
        <main className="min-w-0 flex-1 overflow-y-auto" aria-label="Main content">
          <div className="mx-auto w-full max-w-6xl px-6 py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}

export interface PageHeaderProps {
  readonly title: string;
  readonly description?: string;
  readonly actions?: ReactNode;
}

/** Standard page-level heading used inside {@link AppLayout}. */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-content">{title}</h1>
        {description ? (
          <p className="mt-1 text-sm text-content-muted">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
