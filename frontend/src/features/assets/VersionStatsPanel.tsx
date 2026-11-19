import { useVersionStats } from "../../hooks/useQueries";
import { errorMessage } from "../../lib/errors";
import type { VersionStats } from "../../lib/types";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card, SectionHeader } from "../../ui/Card";
import { EmptyState, Skeleton } from "../../ui/Feedback";
import { ProgressBar } from "../../ui/ProgressBar";
import {
  hasVersionStatsData,
  versionNumberRows,
  versionProjectRows,
  versionStatsCards,
  versionStatsGeneratedAtLabel,
  type VersionNumberRow,
  type VersionProjectRow,
} from "./versionStatsHelpers";

function StatGrid({ stats }: { readonly stats: VersionStats }) {
  const cards = versionStatsCards(stats);
  return (
    <section
      aria-label="Asset version totals"
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

function VersionRows({ rows }: { readonly rows: readonly VersionNumberRow[] }) {
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

function ProjectRows({ rows }: { readonly rows: readonly VersionProjectRow[] }) {
  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.projectId} className="flex items-center gap-3">
          <span className="w-24 shrink-0 truncate text-xs text-content" title={row.projectId}>
            {row.label}
          </span>
          <ProgressBar
            value={row.fraction}
            label={`${row.label} version share`}
            className="flex-1"
          />
          <span className="w-10 shrink-0 text-right text-xs tabular-nums text-content">
            {row.versions}
          </span>
          <span className="w-14 shrink-0 text-right text-2xs tabular-nums text-content-subtle">
            {row.assets} assets
          </span>
        </li>
      ))}
    </ul>
  );
}

function VersionStatsContent({ stats }: { readonly stats: VersionStats }) {
  const generatedAt = versionStatsGeneratedAtLabel(stats);
  const versions = versionNumberRows(stats);
  const projects = versionProjectRows(stats);

  return (
    <div className="space-y-6">
      <StatGrid stats={stats} />
      {!hasVersionStatsData(stats) ? (
        <EmptyState
          title="No versioned assets in this scope"
          description="Version records will appear here as assets are registered and revisions are published."
        />
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            {versions.length > 0 ? (
              <section aria-label="Versions by number" className="rounded-md border border-line p-4">
                <h3 className="mb-3 text-sm font-medium text-content">Versions by number</h3>
                <VersionRows rows={versions} />
              </section>
            ) : null}
            {projects.length > 0 ? (
              <section aria-label="Versions by project" className="rounded-md border border-line p-4">
                <h3 className="mb-3 text-sm font-medium text-content">Versions by project</h3>
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

export interface VersionStatsPanelProps {
  /** Optional project scope; omitted renders the workspace-wide snapshot. */
  readonly projectId?: string;
  readonly title?: string;
  readonly description?: string;
}

/**
 * Authoritative asset version metrics from the `useVersionStats` query hook.
 * Renders explicit loading, error, missing-data, empty and populated states;
 * every display value comes from `versionStatsHelpers` so JSX stays free of
 * inline derivation and mock/live transports render identically. See C109/C111/C112.
 */
export function VersionStatsPanel({
  projectId,
  title = "Version stats",
  description = "Authoritative asset version metrics derived from the version store.",
}: VersionStatsPanelProps) {
  const { data, isPending, isError, error, refetch } = useVersionStats(
    projectId ? { projectId } : undefined,
  );

  return (
    <Card>
      <div className="p-4">
        <SectionHeader title={title} description={description} />
      </div>
      <div className="border-t border-line p-4">
        {isPending ? (
          <div className="space-y-6" aria-busy="true" aria-label="Loading version statistics">
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
            title="Could not load version statistics"
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
            description="Asset version metrics are not available right now."
          />
        ) : (
          <VersionStatsContent stats={data} />
        )}
      </div>
    </Card>
  );
}
