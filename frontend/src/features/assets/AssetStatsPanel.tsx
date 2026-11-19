import { useAssetStats } from "../../hooks/useQueries";
import { errorMessage } from "../../lib/errors";
import type { AssetStats } from "../../lib/types";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card, SectionHeader } from "../../ui/Card";
import { EmptyState, Skeleton } from "../../ui/Feedback";
import { ProgressBar } from "../../ui/ProgressBar";
import {
  assetStatsCards,
  assetStatsGeneratedAtLabel,
  assetStatusRows,
  assetTypeRows,
  hasAssetStatsData,
  type AssetStatusRow,
  type AssetTypeRow,
} from "./assetStatsHelpers";

function StatGrid({ stats }: { readonly stats: AssetStats }) {
  const cards = assetStatsCards(stats);
  return (
    <section
      aria-label="Asset inventory totals"
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

function TypeRows({ rows }: { readonly rows: readonly AssetTypeRow[] }) {
  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.type} className="flex items-center gap-3">
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

function StatusRows({ rows }: { readonly rows: readonly AssetStatusRow[] }) {
  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.status} className="flex items-center gap-3">
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

function AssetStatsContent({ stats }: { readonly stats: AssetStats }) {
  const generatedAt = assetStatsGeneratedAtLabel(stats);
  return (
    <div className="space-y-6">
      <StatGrid stats={stats} />
      {!hasAssetStatsData(stats) ? (
        <EmptyState
          title="No assets yet"
          description="Registered or generated assets will populate these metrics."
        />
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <section aria-label="Assets by type" className="rounded-md border border-line p-4">
              <h3 className="mb-3 text-sm font-medium text-content">Assets by type</h3>
              <TypeRows rows={assetTypeRows(stats)} />
            </section>
            <section
              aria-label="Assets by lifecycle status"
              className="rounded-md border border-line p-4"
            >
              <h3 className="mb-3 text-sm font-medium text-content">Assets by status</h3>
              <StatusRows rows={assetStatusRows(stats)} />
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

export interface AssetStatsPanelProps {
  /** Optional project scope; omitted renders the workspace-wide snapshot. */
  readonly projectId?: string;
  readonly title?: string;
  readonly description?: string;
}

/**
 * Authoritative asset inventory metrics from the `useAssetStats` query hook.
 * Renders explicit loading, error, missing-data, empty and populated states;
 * every display value comes from `assetStatsHelpers` so JSX stays free of inline
 * derivation and mock/live transports render identically.
 */
export function AssetStatsPanel({
  projectId,
  title = "Asset stats",
  description = "Authoritative inventory metrics derived from the asset store.",
}: AssetStatsPanelProps) {
  const { data, isPending, isError, error, refetch } = useAssetStats(
    projectId ? { projectId } : undefined,
  );

  return (
    <Card>
      <div className="p-4">
        <SectionHeader title={title} description={description} />
      </div>
      <div className="border-t border-line p-4">
        {isPending ? (
          <div className="space-y-6" aria-busy="true" aria-label="Loading asset statistics">
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
            title="Could not load asset statistics"
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
            description="Asset inventory metrics are not available right now."
          />
        ) : (
          <AssetStatsContent stats={data} />
        )}
      </div>
    </Card>
  );
}
