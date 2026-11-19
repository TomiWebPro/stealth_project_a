import { useLineageStats } from "../../hooks/useQueries";
import { errorMessage } from "../../lib/errors";
import type { LineageStats } from "../../lib/types";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card, SectionHeader } from "../../ui/Card";
import { EmptyState, Skeleton } from "../../ui/Feedback";
import { ProgressBar } from "../../ui/ProgressBar";
import {
  hasLineageStatsData,
  lineageProjectRows,
  lineageStatsCards,
  lineageStatsGeneratedAtLabel,
  lineageTypeRows,
  newestRelationshipLabel,
  type LineageProjectRow,
  type LineageTypeRow,
} from "./lineageStatsHelpers";

function StatGrid({ stats }: { readonly stats: LineageStats }) {
  const cards = lineageStatsCards(stats);
  return (
    <section aria-label="Asset lineage totals" className="grid grid-cols-3 gap-3">
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

function TypeRows({ rows }: { readonly rows: readonly LineageTypeRow[] }) {
  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.type} className="space-y-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Badge tone={row.tone}>{row.label}</Badge>
            <span className="text-2xs tabular-nums text-content-subtle">
              {row.count} · {row.percent}%
            </span>
          </div>
          <ProgressBar value={row.fraction} label={`${row.label} relationship share`} />
        </li>
      ))}
    </ul>
  );
}

function ProjectRows({ rows }: { readonly rows: readonly LineageProjectRow[] }) {
  if (rows.length === 0) {
    return <p className="text-xs text-content-muted">No projects have asset relationships yet.</p>;
  }
  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.projectId} className="flex items-center gap-3">
          <span className="w-20 shrink-0 truncate text-xs text-content" title={row.projectId}>
            {row.label}
          </span>
          <ProgressBar
            value={row.fraction}
            label={`Project ${row.label} relationship share`}
            className="flex-1"
          />
          <span className="w-8 shrink-0 text-right text-xs tabular-nums text-content">
            {row.relationships}
          </span>
          <span className="w-9 shrink-0 text-right text-2xs tabular-nums text-content-subtle">
            {row.percent}%
          </span>
        </li>
      ))}
    </ul>
  );
}

function LineageStatsContent({ stats }: { readonly stats: LineageStats }) {
  const generatedAt = lineageStatsGeneratedAtLabel(stats);
  const newestRelationship = newestRelationshipLabel(stats);
  return (
    <div className="space-y-6">
      <StatGrid stats={stats} />
      {!hasLineageStatsData(stats) ? (
        <EmptyState
          title="No asset relationships yet"
          description="Derived, variant, input and related asset links will populate these metrics as the pipeline runs."
        />
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <section aria-label="Relationships by type" className="rounded-md border border-line p-4">
              <h3 className="mb-3 text-sm font-medium text-content">Relationships by type</h3>
              <TypeRows rows={lineageTypeRows(stats)} />
            </section>
            <section aria-label="Relationships by project" className="rounded-md border border-line p-4">
              <h3 className="mb-3 text-sm font-medium text-content">Relationships by project</h3>
              <ProjectRows rows={lineageProjectRows(stats)} />
            </section>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-2xs text-content-subtle">
            {newestRelationship ? <span>Newest link {newestRelationship}.</span> : null}
            {generatedAt ? <span>Metrics generated {generatedAt}.</span> : null}
          </div>
        </>
      )}
    </div>
  );
}

export interface LineageStatsPanelProps {
  /** Optional project scope; omitted renders the workspace-wide snapshot. */
  readonly projectId?: string;
  readonly title?: string;
  readonly description?: string;
}

/**
 * Authoritative asset-lineage metrics from the `useLineageStats` query hook.
 * Renders explicit loading, error, missing-data, empty and populated states;
 * every display value comes from `lineageStatsHelpers` so JSX stays free of
 * inline derivation and mock/live transports render identically. See C77/C79/
 * C80.
 */
export function LineageStatsPanel({
  projectId,
  title = "Asset lineage stats",
  description = "Authoritative asset relationship metrics derived from the lineage store.",
}: LineageStatsPanelProps) {
  const { data, isPending, isError, error, refetch } = useLineageStats(
    projectId ? { projectId } : undefined,
  );

  return (
    <Card>
      <div className="p-4">
        <SectionHeader title={title} description={description} />
      </div>
      <div className="border-t border-line p-4">
        {isPending ? (
          <div className="space-y-6" aria-busy="true" aria-label="Loading asset lineage statistics">
            <div className="grid grid-cols-3 gap-3">
              {Array.from({ length: 3 }, (_, index) => (
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
            title="Could not load asset lineage statistics"
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
            description="Asset lineage metrics are not available right now."
          />
        ) : (
          <LineageStatsContent stats={data} />
        )}
      </div>
    </Card>
  );
}
