import { usePublishStats } from "../../hooks/useQueries";
import { errorMessage } from "../../lib/errors";
import type { PublishStats } from "../../lib/types";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card, SectionHeader } from "../../ui/Card";
import { EmptyState, Skeleton } from "../../ui/Feedback";
import { ProgressBar } from "../../ui/ProgressBar";
import {
  hasPublishStatsData,
  publishProjectRows,
  publishStatsCards,
  publishStatsGeneratedAtLabel,
  publishVersionRows,
  type PublishProjectRow,
  type PublishVersionRow,
} from "./publishStatsHelpers";

function StatGrid({ stats }: { readonly stats: PublishStats }) {
  const cards = publishStatsCards(stats);
  return (
    <section
      aria-label="Publish totals"
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

function VersionRows({ rows }: { readonly rows: readonly PublishVersionRow[] }) {
  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.version} className="flex items-center gap-3">
          <span className="w-12 shrink-0">
            <Badge tone="info">{row.label}</Badge>
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

function ProjectRows({ rows }: { readonly rows: readonly PublishProjectRow[] }) {
  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.projectId} className="flex items-center gap-3">
          <span className="w-24 shrink-0 truncate text-xs text-content" title={row.projectId}>
            {row.label}
          </span>
          <ProgressBar
            value={row.fraction}
            label={`${row.label} publish share`}
            className="flex-1"
          />
          <span className="w-8 shrink-0 text-right text-xs tabular-nums text-content">
            {row.published}
          </span>
          <span className="w-16 shrink-0 text-right text-2xs tabular-nums text-content-subtle">
            {row.bytesLabel}
          </span>
        </li>
      ))}
    </ul>
  );
}

function PublishStatsContent({ stats }: { readonly stats: PublishStats }) {
  const generatedAt = publishStatsGeneratedAtLabel(stats);
  const versions = publishVersionRows(stats);
  const projects = publishProjectRows(stats);

  return (
    <div className="space-y-6">
      <StatGrid stats={stats} />
      {!hasPublishStatsData(stats) ? (
        <EmptyState
          title="No published assets in this scope"
          description="Publish receipts will appear here as assets are published to the Publish folder."
        />
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            {versions.length > 0 ? (
              <section aria-label="Published assets by version" className="rounded-md border border-line p-4">
                <h3 className="mb-3 text-sm font-medium text-content">Published by version</h3>
                <VersionRows rows={versions} />
              </section>
            ) : null}
            {projects.length > 0 ? (
              <section aria-label="Published assets by project" className="rounded-md border border-line p-4">
                <h3 className="mb-3 text-sm font-medium text-content">Published by project</h3>
                <ProjectRows rows={projects} />
              </section>
            ) : null}
          </div>
          {generatedAt ? (
            <p className="text-2xs text-content-subtle">Statistics generated {generatedAt}.</p>
          ) : null}
        </>
      )}
    </div>
  );
}

export interface PublishStatsPanelProps {
  /** Optional project scope; omitted renders the workspace-wide snapshot. */
  readonly projectId?: string;
  readonly title?: string;
  readonly description?: string;
}

/**
 * Authoritative publish metrics from the `usePublishStats` query hook.
 * Renders explicit loading, error, missing-data, empty and populated states;
 * every display value comes from `publishStatsHelpers` so JSX stays free of
 * inline derivation and mock/live transports render identically. See C113/C115/C116.
 */
export function PublishStatsPanel({
  projectId,
  title = "Publish stats",
  description = "Authoritative asset publish metrics derived from publish receipts.",
}: PublishStatsPanelProps) {
  const { data, isPending, isError, error, refetch } = usePublishStats(
    projectId ? { projectId } : undefined,
  );

  return (
    <Card>
      <div className="p-4">
        <SectionHeader title={title} description={description} />
      </div>
      <div className="border-t border-line p-4">
        {isPending ? (
          <div className="space-y-6" aria-busy="true" aria-label="Loading publish statistics">
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
            title="Could not load publish statistics"
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
            description="Asset publish metrics are not available right now."
          />
        ) : (
          <PublishStatsContent stats={data} />
        )}
      </div>
    </Card>
  );
}
