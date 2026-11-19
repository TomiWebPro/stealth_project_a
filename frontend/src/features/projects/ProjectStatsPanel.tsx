import { useProjectStats } from "../../hooks/useQueries";
import { errorMessage } from "../../lib/errors";
import type { ProjectStats } from "../../lib/types";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card, SectionHeader } from "../../ui/Card";
import { EmptyState, Skeleton } from "../../ui/Feedback";
import { ProgressBar } from "../../ui/ProgressBar";
import {
  hasProjectStatsData,
  projectAverageRows,
  projectDomainRows,
  projectLifecycleRows,
  projectStatsCards,
  projectStatsGeneratedAtLabel,
  type ProjectLifecycleRow,
} from "./projectStatsHelpers";

function StatGrid({ stats }: { readonly stats: ProjectStats }) {
  const cards = projectStatsCards(stats);
  return (
    <section
      aria-label="Project portfolio totals"
      className="grid grid-cols-2 gap-3 md:grid-cols-4"
    >
      {cards.map((card) => (
        <div key={card.key} className="rounded-md border border-line bg-surface-raised p-3">
          <p className="text-2xs font-semibold uppercase tracking-wider text-content-subtle">
            {card.label}
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-content">{card.value}</p>
          <p className="mt-0.5 text-2xs text-content-muted">{card.hint}</p>
        </div>
      ))}
    </section>
  );
}

function LifecycleRows({ rows }: { readonly rows: readonly ProjectLifecycleRow[] }) {
  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.lifecycle} className="flex items-center gap-3">
          <span className="w-20 shrink-0">
            <Badge tone={row.tone}>{row.label}</Badge>
          </span>
          <ProgressBar value={row.fraction} label={`${row.label} share`} className="flex-1" />
          <span className="w-8 shrink-0 text-right text-xs tabular-nums text-content">
            {row.count}
          </span>
          <span className="w-9 shrink-0 text-right text-2xs tabular-nums text-content-subtle">
            {row.percent}%
          </span>
        </li>
      ))}
    </ul>
  );
}

function ProjectStatsContent({ stats }: { readonly stats: ProjectStats }) {
  const generatedAt = projectStatsGeneratedAtLabel(stats);
  const domains = projectDomainRows(stats);
  const averages = projectAverageRows(stats);

  return (
    <div className="space-y-6">
      <StatGrid stats={stats} />
      {!hasProjectStatsData(stats) ? (
        <EmptyState
          title="No projects in this scope"
          description="Projects will populate these metrics as they are created."
        />
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <section aria-label="Projects by lifecycle" className="rounded-md border border-line p-4">
              <h3 className="mb-3 text-sm font-medium text-content">Projects by lifecycle</h3>
              <LifecycleRows rows={projectLifecycleRows(stats)} />
            </section>
            <section aria-label="Domains across projects" className="rounded-md border border-line p-4">
              <h3 className="mb-3 text-sm font-medium text-content">Across projects</h3>
              <ul className="space-y-2">
                {domains.map((row) => (
                  <li key={row.key} className="flex items-center justify-between gap-3">
                    <span className="text-xs text-content-muted">
                      {row.label}
                      <span className="ml-1 text-2xs text-content-subtle">· {row.hint}</span>
                    </span>
                    <span className="text-sm font-medium tabular-nums text-content">{row.value}</span>
                  </li>
                ))}
              </ul>
              <ul className="mt-4 flex flex-wrap gap-2 border-t border-line pt-3">
                {averages.map((row) => (
                  <li key={row.key}>
                    <Badge tone="info">{`${row.label}: ${row.value}`}</Badge>
                  </li>
                ))}
              </ul>
            </section>
          </div>
          {generatedAt ? (
            <p className="text-2xs text-content-subtle">Metrics generated {generatedAt}.</p>
          ) : null}
        </>
      )}
    </div>
  );
}

export interface ProjectStatsPanelProps {
  /** Optional organization scope; omitted renders the workspace-wide snapshot. */
  readonly orgId?: string;
  readonly title?: string;
  readonly description?: string;
}

/**
 * Authoritative project portfolio metrics from the `useProjectStats` query hook.
 * Renders explicit loading, error, missing-data, empty and populated states;
 * every display value comes from `projectStatsHelpers` so JSX stays free of
 * inline derivation and mock/live transports render identically. See C53/C55/C56.
 */
export function ProjectStatsPanel({
  orgId,
  title = "Project stats",
  description = "Authoritative portfolio metrics derived from the project, asset, conversation and job stores.",
}: ProjectStatsPanelProps) {
  const { data, isPending, isError, error, refetch } = useProjectStats(
    orgId ? { orgId } : undefined,
  );

  return (
    <Card>
      <div className="p-4">
        <SectionHeader title={title} description={description} />
      </div>
      <div className="border-t border-line p-4">
        {isPending ? (
          <div className="space-y-6" aria-busy="true" aria-label="Loading project statistics">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} className="h-20" />
              ))}
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <Skeleton className="h-40" />
              <Skeleton className="h-40" />
            </div>
          </div>
        ) : isError ? (
          <EmptyState
            title="Could not load project statistics"
            description={errorMessage(error)}
            action={
              <Button variant="primary" size="sm" onClick={() => void refetch()}>
                Try again
              </Button>
            }
          />
        ) : !data ? (
          <EmptyState
            title="Statistics unavailable"
            description="Project portfolio metrics are not available right now."
          />
        ) : (
          <ProjectStatsContent stats={data} />
        )}
      </div>
    </Card>
  );
}
