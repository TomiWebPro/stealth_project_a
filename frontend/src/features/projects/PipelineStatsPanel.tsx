import { usePipelineStats } from "../../hooks/useQueries";
import { errorMessage } from "../../lib/errors";
import type { PipelineStats } from "../../lib/types";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card, SectionHeader } from "../../ui/Card";
import { EmptyState, Skeleton } from "../../ui/Feedback";
import { ProgressBar } from "../../ui/ProgressBar";
import {
  hasPipelineStatsData,
  newestChainLabel,
  pipelineKindRows,
  pipelineProjectRows,
  pipelineStatsCards,
  pipelineStatsGeneratedAtLabel,
  type PipelineKindRow,
  type PipelineProjectRow,
} from "./pipelineStatsHelpers";

function StatGrid({ stats }: { readonly stats: PipelineStats }) {
  const cards = pipelineStatsCards(stats);
  return (
    <section aria-label="Production pipeline totals" className="grid grid-cols-3 gap-3">
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

function KindRows({ rows }: { readonly rows: readonly PipelineKindRow[] }) {
  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.kind} className="space-y-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <Badge tone={row.tone}>{row.label}</Badge>
              <span className="text-2xs tabular-nums text-content-subtle">
                {row.chains} chains
              </span>
            </span>
            <span className="flex items-center gap-2 text-2xs tabular-nums text-content-subtle">
              <span>{row.jobs} jobs</span>
              <span aria-hidden="true">·</span>
              <span>{row.assets} assets</span>
            </span>
          </div>
          <ProgressBar value={row.fraction} label={`${row.label} chain share`} />
          <p className="text-2xs text-content-subtle">{row.percent}% of chains</p>
        </li>
      ))}
    </ul>
  );
}

function ProjectRows({ rows }: { readonly rows: readonly PipelineProjectRow[] }) {
  if (rows.length === 0) {
    return <p className="text-xs text-content-muted">No projects have pipeline chains yet.</p>;
  }
  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.projectId} className="flex items-center gap-3">
          <span className="w-20 shrink-0 truncate text-xs text-content" title={row.projectId}>
            {row.label}
          </span>
          <ProgressBar value={row.fraction} label={`Project ${row.label} chain share`} className="flex-1" />
          <span className="w-8 shrink-0 text-right text-xs tabular-nums text-content">
            {row.chains}
          </span>
          <span className="w-9 shrink-0 text-right text-2xs tabular-nums text-content-subtle">
            {row.percent}%
          </span>
        </li>
      ))}
    </ul>
  );
}

function PipelineStatsContent({ stats }: { readonly stats: PipelineStats }) {
  const generatedAt = pipelineStatsGeneratedAtLabel(stats);
  const newestChain = newestChainLabel(stats);
  return (
    <div className="space-y-6">
      <StatGrid stats={stats} />
      {!hasPipelineStatsData(stats) ? (
        <EmptyState
          title="No production chains yet"
          description="Training, shot and splat chains will populate these metrics as they run."
        />
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <section aria-label="Chains by pipeline kind" className="rounded-md border border-line p-4">
              <h3 className="mb-3 text-sm font-medium text-content">Chains by kind</h3>
              <KindRows rows={pipelineKindRows(stats)} />
            </section>
            <section aria-label="Chains by project" className="rounded-md border border-line p-4">
              <h3 className="mb-3 text-sm font-medium text-content">Chains by project</h3>
              <ProjectRows rows={pipelineProjectRows(stats)} />
            </section>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-2xs text-content-subtle">
            {newestChain ? <span>Newest chain {newestChain}.</span> : null}
            {generatedAt ? <span>Metrics generated {generatedAt}.</span> : null}
          </div>
        </>
      )}
    </div>
  );
}

export interface PipelineStatsPanelProps {
  /** Optional project scope; omitted renders the workspace-wide snapshot. */
  readonly projectId?: string;
  readonly title?: string;
  readonly description?: string;
}

/**
 * Authoritative production-pipeline metrics from the `usePipelineStats` query
 * hook. Renders explicit loading, error, missing-data, empty and populated
 * states; every display value comes from `pipelineStatsHelpers` so JSX stays
 * free of inline derivation and mock/live transports render identically.
 * See C73/C75/C76.
 */
export function PipelineStatsPanel({
  projectId,
  title = "Production pipeline stats",
  description = "Authoritative training, shot and splat chain metrics derived from the pipeline stores.",
}: PipelineStatsPanelProps) {
  const { data, isPending, isError, error, refetch } = usePipelineStats(
    projectId ? { projectId } : undefined,
  );

  return (
    <Card>
      <div className="p-4">
        <SectionHeader title={title} description={description} />
      </div>
      <div className="border-t border-line p-4">
        {isPending ? (
          <div className="space-y-6" aria-busy="true" aria-label="Loading production pipeline statistics">
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
            title="Could not load production pipeline statistics"
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
            description="Production pipeline metrics are not available right now."
          />
        ) : (
          <PipelineStatsContent stats={data} />
        )}
      </div>
    </Card>
  );
}
