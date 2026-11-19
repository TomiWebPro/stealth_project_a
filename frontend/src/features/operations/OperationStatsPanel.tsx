import { useOperationStats } from "../../hooks/useQueries";
import { errorMessage } from "../../lib/errors";
import type { OperationStats } from "../../lib/types";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card, SectionHeader } from "../../ui/Card";
import { EmptyState, Skeleton } from "../../ui/Feedback";
import { ProgressBar } from "../../ui/ProgressBar";
import {
  hasOperationStatsData,
  operationProviderCoverage,
  operationStatsCards,
  operationStatsGeneratedAtLabel,
  operationTypeRows,
  type OperationTypeRow,
} from "./operationStatsHelpers";

function StatGrid({ stats }: { readonly stats: OperationStats }) {
  const cards = operationStatsCards(stats);
  return (
    <section
      aria-label="Operation catalog totals"
      className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5"
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

function ProviderCoverage({ stats }: { readonly stats: OperationStats }) {
  const coverage = operationProviderCoverage(stats);
  return (
    <section aria-label="Provider binding coverage" className="rounded-md border border-line p-4">
      <h3 className="mb-3 text-sm font-medium text-content">Provider binding</h3>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={coverage.tone}>{`${coverage.withProvider} with provider`}</Badge>
        <Badge tone="neutral">{`${coverage.withoutProvider} unbound`}</Badge>
        <span className="text-2xs tabular-nums text-content-subtle">
          {coverage.coveredPercent}% bound
        </span>
      </div>
      <ProgressBar value={coverage.coveredFraction} label="Provider-bound operation share" className="mt-3" />
    </section>
  );
}

function TypeRows({ rows }: { readonly rows: readonly OperationTypeRow[] }) {
  if (rows.length === 0) {
    return <p className="text-xs text-content-muted">No asset types recorded yet.</p>;
  }
  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.assetType} className="flex items-center gap-3">
          <span className="w-20 shrink-0">
            <Badge tone="info">{row.label}</Badge>
          </span>
          <ProgressBar value={row.fraction} label={`${row.label} share`} className="flex-1" />
          <span className="w-8 shrink-0 text-right text-xs tabular-nums text-content">
            {row.operations}
          </span>
          <span className="w-9 shrink-0 text-right text-2xs tabular-nums text-content-subtle">
            {row.percent}%
          </span>
        </li>
      ))}
    </ul>
  );
}

function OperationStatsContent({ stats }: { readonly stats: OperationStats }) {
  const generatedAt = operationStatsGeneratedAtLabel(stats);
  return (
    <div className="space-y-6">
      <StatGrid stats={stats} />
      {!hasOperationStatsData(stats) ? (
        <EmptyState
          title="No operations in the catalog"
          description="Registered operations will populate these metrics as the catalog grows."
        />
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <section aria-label="Outputs by asset type" className="rounded-md border border-line p-4">
              <h3 className="mb-3 text-sm font-medium text-content">Outputs by asset type</h3>
              <TypeRows rows={operationTypeRows(stats, "output")} />
            </section>
            <section aria-label="Inputs by asset type" className="rounded-md border border-line p-4">
              <h3 className="mb-3 text-sm font-medium text-content">Inputs by asset type</h3>
              <TypeRows rows={operationTypeRows(stats, "input")} />
            </section>
          </div>
          <ProviderCoverage stats={stats} />
          {generatedAt ? (
            <p className="text-2xs text-content-subtle">Metrics generated {generatedAt}.</p>
          ) : null}
        </>
      )}
    </div>
  );
}

export interface OperationStatsPanelProps {
  readonly title?: string;
  readonly description?: string;
}

/**
 * Authoritative operation catalog metrics from the `useOperationStats` query
 * hook. Renders explicit loading, error, missing-data, empty and populated
 * states; every display value comes from `operationStatsHelpers` so JSX stays
 * free of inline derivation and mock/live transports render identically.
 * See C65/C67/C68.
 */
export function OperationStatsPanel({
  title = "Operation catalog stats",
  description = "Authoritative catalog coverage derived from the operation registry.",
}: OperationStatsPanelProps) {
  const { data, isPending, isError, error, refetch } = useOperationStats();

  return (
    <Card>
      <div className="p-4">
        <SectionHeader title={title} description={description} />
      </div>
      <div className="border-t border-line p-4">
        {isPending ? (
          <div className="space-y-6" aria-busy="true" aria-label="Loading operation statistics">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
              {Array.from({ length: 5 }, (_, index) => (
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
            title="Could not load operation statistics"
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
            description="Operation catalog metrics are not available right now."
          />
        ) : (
          <OperationStatsContent stats={data} />
        )}
      </div>
    </Card>
  );
}
