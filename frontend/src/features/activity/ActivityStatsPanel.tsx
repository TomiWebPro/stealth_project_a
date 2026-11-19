import { useActivityStats, useProjects } from "../../hooks/useQueries";
import { errorMessage } from "../../lib/errors";
import type { ActivityStats } from "../../lib/types";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card, SectionHeader } from "../../ui/Card";
import { EmptyState, Skeleton } from "../../ui/Feedback";
import { ProgressBar } from "../../ui/ProgressBar";
import {
  activityKindRows,
  activityProjectRows,
  activityStatsCards,
  activityStatsGeneratedAtLabel,
  hasActivityStatsData,
  type ActivityKindRow,
  type ActivityProjectRow,
} from "./activityStatsHelpers";

function StatGrid({ stats }: { readonly stats: ActivityStats }) {
  const cards = activityStatsCards(stats);
  return (
    <section
      aria-label="Activity totals"
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

function KindRows({ rows }: { readonly rows: readonly ActivityKindRow[] }) {
  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.kind} className="flex items-center gap-3">
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

function ProjectRows({ rows }: { readonly rows: readonly ActivityProjectRow[] }) {
  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.projectId} className="flex items-center gap-3">
          <span className="w-28 shrink-0 truncate text-xs text-content-muted" title={row.projectId}>
            {row.label}
          </span>
          <span className="flex shrink-0 gap-1">
            <Badge tone="info">{`${row.events} events`}</Badge>
            <Badge tone="success">{`${row.participants} actors`}</Badge>
          </span>
          <span className="ml-auto text-2xs tabular-nums text-content-subtle">
            {row.events} signals
          </span>
        </li>
      ))}
    </ul>
  );
}

function ActivityStatsContent({
  stats,
  projectNames,
}: {
  readonly stats: ActivityStats;
  readonly projectNames: Readonly<Record<string, string>>;
}) {
  const generatedAt = activityStatsGeneratedAtLabel(stats);
  const kinds = activityKindRows(stats);
  const projects = activityProjectRows(stats, projectNames);

  return (
    <div className="space-y-6">
      <StatGrid stats={stats} />
      {!hasActivityStatsData(stats) ? (
        <EmptyState
          title="No activity in this scope"
          description="Asset, publish, job and comment events will populate these metrics as the studio works."
        />
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <section aria-label="Events by kind" className="rounded-md border border-line p-4">
              <h3 className="mb-3 text-sm font-medium text-content">Events by kind</h3>
              <KindRows rows={kinds} />
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
          {generatedAt ? (
            <p className="text-2xs text-content-subtle">Metrics generated {generatedAt}.</p>
          ) : null}
        </>
      )}
    </div>
  );
}

export interface ActivityStatsPanelProps {
  /** Optional project scope; omitted renders the workspace-wide snapshot. */
  readonly projectId?: string;
  readonly title?: string;
  readonly description?: string;
}

/**
 * Authoritative activity metrics from the `useActivityStats` query hook. Renders
 * explicit loading, error, missing-data, empty and populated states; every display
 * value comes from `activityStatsHelpers` so JSX stays free of inline derivation
 * and mock/live transports render identically. See C89/C91/C92.
 */
export function ActivityStatsPanel({
  projectId,
  title = "Activity stats",
  description = "Authoritative event metrics derived from the workspace activity stream.",
}: ActivityStatsPanelProps) {
  const { data, isPending, isError, error, refetch } = useActivityStats(
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
          <div className="space-y-6" aria-busy="true" aria-label="Loading activity statistics">
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
            title="Could not load activity statistics"
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
            description="Activity metrics are not available right now."
          />
        ) : (
          <ActivityStatsContent stats={data} projectNames={projectNames} />
        )}
      </div>
    </Card>
  );
}
