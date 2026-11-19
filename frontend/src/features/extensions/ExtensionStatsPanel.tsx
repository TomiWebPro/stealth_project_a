import { useExtensionStats } from "../../hooks/useQueries";
import { errorMessage } from "../../lib/errors";
import type { ExtensionStats, ExtensionStatus, ExtensionType } from "../../lib/types";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card, SectionHeader } from "../../ui/Card";
import { EmptyState, Skeleton } from "../../ui/Feedback";
import { ProgressBar } from "../../ui/ProgressBar";
import {
  extensionPermissionRows,
  extensionStatsCards,
  extensionStatsGeneratedAtLabel,
  extensionStatusRows,
  extensionTrustRows,
  extensionTypeRows,
  hasExtensionStatsData,
  type ExtensionPermissionStatRow,
  type ExtensionStatusStatRow,
  type ExtensionTrustStatRow,
  type ExtensionTypeStatRow,
} from "./extensionStatsHelpers";

function StatGrid({ stats }: { readonly stats: ExtensionStats }) {
  const cards = extensionStatsCards(stats);
  return (
    <section aria-label="Extension totals" className="grid grid-cols-2 gap-3 md:grid-cols-4">
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

type DistributionRow = ExtensionTypeStatRow | ExtensionStatusStatRow;

/** Stable React key for either a type or a status breakdown row. */
function distributionRowKey(row: DistributionRow): string {
  return "type" in row ? row.type : row.status;
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

function PermissionRows({ rows }: { readonly rows: readonly ExtensionPermissionStatRow[] }) {
  if (rows.length === 0) {
    return <p className="text-xs text-content-muted">No permissions declared yet.</p>;
  }
  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.permission} className="space-y-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="truncate text-xs font-medium text-content" title={row.permission}>
              {row.permission}
            </span>
            <span className="text-2xs tabular-nums text-content-subtle">
              {`${row.extensions} extension${row.extensions === 1 ? "" : "s"} · ${row.percent}%`}
            </span>
          </div>
          <ProgressBar value={row.fraction} label={`${row.permission} coverage`} />
        </li>
      ))}
    </ul>
  );
}

function TrustRows({ rows }: { readonly rows: readonly ExtensionTrustStatRow[] }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {rows.map((row) => (
        <li key={row.key} className="flex items-center gap-2">
          <Badge tone={row.tone}>{row.label}</Badge>
          <span className="text-xs tabular-nums text-content">
            {`${row.count}/${row.percent}%`}
          </span>
        </li>
      ))}
    </ul>
  );
}

function ExtensionStatsContent({ stats }: { readonly stats: ExtensionStats }) {
  const generatedAt = extensionStatsGeneratedAtLabel(stats);
  return (
    <div className="space-y-6">
      <StatGrid stats={stats} />
      {!hasExtensionStatsData(stats) ? (
        <EmptyState
          title="No extensions in this scope"
          description="Registered manifests and installed extensions will populate these metrics."
        />
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <section aria-label="Registry extensions by type" className="rounded-md border border-line p-4">
              <h3 className="mb-3 text-sm font-medium text-content">Registry by type</h3>
              <DistributionRows rows={extensionTypeRows(stats)} />
            </section>
            <section aria-label="Installed extensions by status" className="rounded-md border border-line p-4">
              <h3 className="mb-3 text-sm font-medium text-content">Installed by status</h3>
              <DistributionRows rows={extensionStatusRows(stats)} />
            </section>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <section aria-label="Trust flags" className="rounded-md border border-line p-4">
              <h3 className="mb-3 text-sm font-medium text-content">Trust signals</h3>
              <TrustRows rows={extensionTrustRows(stats)} />
              <p className="mt-3 text-2xs text-content-subtle">
                {`${stats.total_permissions} declared permissions · ${stats.total_capabilities} capabilities`}
              </p>
            </section>
            <section aria-label="Permission coverage" className="rounded-md border border-line p-4">
              <h3 className="mb-3 text-sm font-medium text-content">Permission coverage</h3>
              <PermissionRows rows={extensionPermissionRows(stats)} />
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

export interface ExtensionStatsPanelProps {
  /** Optional registry-type filter; omitted renders all types. */
  readonly type?: ExtensionType;
  /** Optional installation-status filter; omitted renders all statuses. */
  readonly status?: ExtensionStatus;
  readonly title?: string;
  readonly description?: string;
}

/**
 * Authoritative extension registry/installation metrics from the
 * `useExtensionStats` query hook. Renders explicit loading, error,
 * missing-data, empty and populated states; every display value comes from
 * `extensionStatsHelpers` so JSX stays free of inline derivation and mock/live
 * transports render identically. See C61/C63/C64/C66.
 */
export function ExtensionStatsPanel({
  type,
  status,
  title = "Extension registry stats",
  description = "Authoritative registry and installation metrics derived from the extension stores; scoped to the active filters.",
}: ExtensionStatsPanelProps) {
  const { data, isPending, isError, error, refetch } = useExtensionStats(
    type || status ? { type, status } : undefined,
  );

  return (
    <Card>
      <div className="p-4">
        <SectionHeader title={title} description={description} />
      </div>
      <div className="border-t border-line p-4">
        {isPending ? (
          <div className="space-y-6" aria-busy="true" aria-label="Loading extension statistics">
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
            title="Could not load extension statistics"
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
            description="Extension registry metrics are not available right now."
          />
        ) : (
          <ExtensionStatsContent stats={data} />
        )}
      </div>
    </Card>
  );
}
