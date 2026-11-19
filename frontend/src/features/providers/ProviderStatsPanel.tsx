import { useProviderStats } from "../../hooks/useQueries";
import { errorMessage } from "../../lib/errors";
import type { ProviderLocation, ProviderStats, ProviderStatus } from "../../lib/types";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card, SectionHeader } from "../../ui/Card";
import { EmptyState, Skeleton } from "../../ui/Feedback";
import { ProgressBar } from "../../ui/ProgressBar";
import {
  hasProviderStatsData,
  providerLocationRows,
  providerOperationRows,
  providerStatsCards,
  providerStatsGeneratedAtLabel,
  providerStatusRows,
  type ProviderLocationStatRow,
  type ProviderOperationStatRow,
  type ProviderStatusStatRow,
} from "./providerStatsHelpers";

function StatGrid({ stats }: { readonly stats: ProviderStats }) {
  const cards = providerStatsCards(stats);
  return (
    <section
      aria-label="Provider fleet totals"
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

type DistributionRow = ProviderStatusStatRow | ProviderLocationStatRow;

/** Stable React key for either a status or a location breakdown row. */
function distributionRowKey(row: DistributionRow): string {
  return "status" in row ? row.status : row.location;
}

function DistributionRows({ rows }: { readonly rows: readonly DistributionRow[] }) {
  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={distributionRowKey(row)} className="flex items-center gap-3">
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

function OperationRows({ rows }: { readonly rows: readonly ProviderOperationStatRow[] }) {
  if (rows.length === 0) {
    return <p className="text-xs text-content-muted">No operation capabilities advertised yet.</p>;
  }
  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.operationId} className="space-y-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="truncate text-xs font-medium text-content" title={row.operationId}>
              {row.label}
            </span>
            <div className="flex items-center gap-2">
              <Badge tone={row.tone}>{`${row.available}/${row.providers} available`}</Badge>
              <span className="text-2xs tabular-nums text-content-subtle">{row.providers} total</span>
            </div>
          </div>
          <ProgressBar value={row.availabilityFraction} label={`${row.label} availability`} />
          <p className="text-2xs text-content-subtle">{row.availabilityPercent}% available</p>
        </li>
      ))}
    </ul>
  );
}

function ProviderStatsContent({ stats }: { readonly stats: ProviderStats }) {
  const generatedAt = providerStatsGeneratedAtLabel(stats);
  return (
    <div className="space-y-6">
      <StatGrid stats={stats} />
      {!hasProviderStatsData(stats) ? (
        <EmptyState
          title="No providers in this scope"
          description="Registered providers will populate these metrics as they come online."
        />
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <section aria-label="Providers by health status" className="rounded-md border border-line p-4">
              <h3 className="mb-3 text-sm font-medium text-content">Providers by status</h3>
              <DistributionRows rows={providerStatusRows(stats)} />
            </section>
            <section aria-label="Providers by runtime location" className="rounded-md border border-line p-4">
              <h3 className="mb-3 text-sm font-medium text-content">Providers by location</h3>
              <DistributionRows rows={providerLocationRows(stats)} />
            </section>
          </div>
          <section aria-label="Operation coverage" className="rounded-md border border-line p-4">
            <h3 className="mb-3 text-sm font-medium text-content">Operation coverage</h3>
            <OperationRows rows={providerOperationRows(stats)} />
          </section>
          {generatedAt ? (
            <p className="text-2xs text-content-subtle">Metrics generated {generatedAt}.</p>
          ) : null}
        </>
      )}
    </div>
  );
}

export interface ProviderStatsPanelProps {
  /** Optional runtime-location filter; omitted renders all locations. */
  readonly location?: ProviderLocation;
  /** Optional health-status filter; omitted renders all statuses. */
  readonly status?: ProviderStatus;
  readonly title?: string;
  readonly description?: string;
}

/**
 * Authoritative provider fleet metrics from the `useProviderStats` query hook.
 * Renders explicit loading, error, missing-data, empty and populated states;
 * every display value comes from `providerStatsHelpers` so JSX stays free of
 * inline derivation and mock/live transports render identically. See C57/C59/C60.
 */
export function ProviderStatsPanel({
  location,
  status,
  title = "Provider fleet stats",
  description = "Authoritative fleet metrics derived from the provider store; scoped to the active filters.",
}: ProviderStatsPanelProps) {
  const { data, isPending, isError, error, refetch } = useProviderStats(
    location || status ? { location, status } : undefined,
  );

  return (
    <Card>
      <div className="p-4">
        <SectionHeader title={title} description={description} />
      </div>
      <div className="border-t border-line p-4">
        {isPending ? (
          <div className="space-y-6" aria-busy="true" aria-label="Loading provider statistics">
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
            title="Could not load provider statistics"
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
            description="Provider fleet metrics are not available right now."
          />
        ) : (
          <ProviderStatsContent stats={data} />
        )}
      </div>
    </Card>
  );
}
