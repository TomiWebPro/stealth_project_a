import { useOrchestrationStats, useProjects } from "../../hooks/useQueries";
import { errorMessage } from "../../lib/errors";
import type { OrchestrationStats } from "../../lib/types";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card, SectionHeader } from "../../ui/Card";
import { EmptyState, Skeleton } from "../../ui/Feedback";
import { ProgressBar } from "../../ui/ProgressBar";
import {
  hasOrchestrationStatsData,
  newestOrchestrationSignalLabel,
  orchestrationProjectRows,
  orchestrationStageRows,
  orchestrationStatsCards,
  orchestrationStatsGeneratedAtLabel,
  type OrchestrationProjectRow,
  type OrchestrationStageRow,
} from "./orchestrationStatsHelpers";

function StatGrid({ stats }: { readonly stats: OrchestrationStats }) {
  const cards = orchestrationStatsCards(stats);
  return (
    <section
      aria-label="Orchestration totals"
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

function StageRows({ rows }: { readonly rows: readonly OrchestrationStageRow[] }) {
  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.stage} className="flex items-center gap-3">
          <span className="w-16 shrink-0">
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

function ProjectRows({ rows }: { readonly rows: readonly OrchestrationProjectRow[] }) {
  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.projectId} className="flex items-center gap-3">
          <span className="w-28 shrink-0 truncate text-xs text-content-muted" title={row.projectId}>
            {row.label}
          </span>
          <span className="flex shrink-0 gap-1">
            <Badge tone="info">{`${row.plans} plans`}</Badge>
            <Badge tone="success">{`${row.runs} runs`}</Badge>
          </span>
          <span className="ml-auto text-2xs tabular-nums text-content-subtle">
            {row.activity} signals
          </span>
        </li>
      ))}
    </ul>
  );
}

function OrchestrationStatsContent({
  stats,
  projectNames,
}: {
  readonly stats: OrchestrationStats;
  readonly projectNames: Readonly<Record<string, string>>;
}) {
  const stages = orchestrationStageRows(stats);
  const projects = orchestrationProjectRows(stats, projectNames);
  const generatedAt = orchestrationStatsGeneratedAtLabel(stats);
  const newestSignal = newestOrchestrationSignalLabel(stats);

  return (
    <div className="space-y-6">
      <StatGrid stats={stats} />
      {!hasOrchestrationStatsData(stats) ? (
        <EmptyState
          title="No orchestration activity in this scope"
          description="Plans and execution runs will populate these metrics as the orchestrator resolves and submits work."
        />
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <section aria-label="Runs by lifecycle stage" className="rounded-md border border-line p-4">
              <h3 className="mb-3 text-sm font-medium text-content">Runs by lifecycle stage</h3>
              <StageRows rows={stages} />
            </section>
            <section aria-label="Activity by project" className="rounded-md border border-line p-4">
              <h3 className="mb-3 text-sm font-medium text-content">Activity by project</h3>
              {projects.length === 0 ? (
                <p className="text-xs text-content-muted">No projects in this scope.</p>
              ) : (
                <ProjectRows rows={projects} />
              )}
            </section>
          </div>
          {newestSignal ? (
            <p className="text-2xs text-content-subtle">Newest plan or run {newestSignal}.</p>
          ) : null}
          {generatedAt ? (
            <p className="text-2xs text-content-subtle">Metrics generated {generatedAt}.</p>
          ) : null}
        </>
      )}
    </div>
  );
}

export interface OrchestrationStatsPanelProps {
  /** Optional project scope; omitted renders the workspace-wide snapshot. */
  readonly projectId?: string;
  readonly title?: string;
  readonly description?: string;
}

/**
 * Authoritative orchestration metrics from the `useOrchestrationStats` query
 * hook. Renders explicit loading, error, missing-data, empty and populated
 * states; every display value comes from `orchestrationStatsHelpers` so JSX stays
 * free of inline derivation and mock/live transports render identically. See
 * C85/C87/C88.
 */
export function OrchestrationStatsPanel({
  projectId,
  title = "Orchestration stats",
  description = "Authoritative plan, run, step and job-link metrics derived from the orchestration stores.",
}: OrchestrationStatsPanelProps) {
  const { data, isPending, isError, error, refetch } = useOrchestrationStats(
    projectId ? { projectId } : undefined,
  );
  const projectNames: Record<string, string> = {};
  for (const project of useProjects().data ?? []) projectNames[project.id] = project.name;

  return (
    <Card>
      <div className="p-4">
        <SectionHeader title={title} description={description} />
      </div>
      <div className="border-t border-line p-4">
        {isPending ? (
          <div className="space-y-6" aria-busy="true" aria-label="Loading orchestration statistics">
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
            title="Could not load orchestration statistics"
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
            description="Orchestration metrics are not available right now."
          />
        ) : (
          <OrchestrationStatsContent stats={data} projectNames={projectNames} />
        )}
      </div>
    </Card>
  );
}
