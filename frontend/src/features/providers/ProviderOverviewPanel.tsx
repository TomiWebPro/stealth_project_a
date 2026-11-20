import { useState } from "react";
import { useProviderOverview } from "../../hooks/useQueries";
import { errorMessage } from "../../lib/errors";
import type { Provider } from "../../lib/types";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card, SectionHeader } from "../../ui/Card";
import { EmptyState, Skeleton } from "../../ui/Feedback";
import { ProgressBar } from "../../ui/ProgressBar";
import {
  hasProviderOverviewData,
  providerOptionLabel,
  providerOverviewCoverage,
  providerOverviewGeneratedAtLabel,
  providerOverviewIdentity,
  providerOverviewOperationRows,
  providerOverviewStatRows,
  providerOverviewSummaryLabel,
  providerOverviewUnboundOperationIds,
} from "./providerOverviewHelpers";

function StatGrid({
  rows,
}: {
  readonly rows: ReturnType<typeof providerOverviewStatRows>;
}) {
  return (
    <section aria-label="Provider snapshot" className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {rows.map((row) => (
        <div key={row.key} className="rounded-md border border-line bg-surface-raised p-3">
          <p className="text-2xs font-semibold uppercase tracking-wider text-content-subtle">
            {row.label}
          </p>
          <p className="mt-1 truncate text-xl font-semibold tabular-nums text-content" title={row.value}>
            {row.value}
          </p>
          <p className="mt-0.5 text-2xs text-content-muted">{row.hint}</p>
        </div>
      ))}
    </section>
  );
}

function CatalogOperations({
  rows,
}: {
  readonly rows: ReturnType<typeof providerOverviewOperationRows>;
}) {
  return (
    <section aria-label="Catalog-bound operations" className="rounded-md border border-line p-4">
      <h3 className="mb-3 text-sm font-medium text-content">Catalog-bound operations</h3>
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.key} className="flex flex-wrap items-start gap-x-3 gap-y-1">
            <span className="min-w-0 flex-1">
              <span className="text-xs font-medium text-content" title={row.title}>
                {row.title}
              </span>
              <span className="ml-2 text-2xs text-content-subtle">{row.operationId}</span>
            </span>
            <span className="text-2xs text-content-muted" title={row.advertisedVersionsLabel}>
              advertised: {row.advertisedVersionsLabel}
            </span>
            <span className="text-2xs text-content-muted">catalog: {row.catalogVersion}</span>
            <Badge tone={row.schemaTone}>{row.schemaLabel}</Badge>
          </li>
        ))}
      </ul>
    </section>
  );
}

function UnboundOperations({ ids }: { readonly ids: readonly string[] }) {
  if (ids.length === 0) return null;
  return (
    <section aria-label="Unbound operations" className="rounded-md border border-line p-4">
      <h3 className="mb-3 text-sm font-medium text-content">Advertised, not in catalog</h3>
      <div className="flex flex-wrap gap-2">
        {ids.map((operationId) => (
          <Badge key={operationId} tone="neutral">
            {operationId}
          </Badge>
        ))}
      </div>
    </section>
  );
}

export interface ProviderOverviewPanelProps {
  /** Providers available to inspect; the panel renders a picker over them. */
  readonly providers: readonly Provider[];
  readonly title?: string;
  readonly description?: string;
}

/**
 * Authoritative single-provider overview (C217/C220/C221 follow-up), backed by
 * the `useProviderOverview` query hook so the same view works in mock and live
 * mode. Renders explicit loading, error, missing-data, empty and populated
 * states; every display value is derived in `providerOverviewHelpers`.
 */
export function ProviderOverviewPanel({
  providers,
  title = "Provider overview snapshot",
  description = "Compact authoritative snapshot: identity, coverage counts, catalog bindings and schema drift.",
}: ProviderOverviewPanelProps) {
  const [selectedProviderId, setSelectedProviderId] = useState("");

  // Fall back to the first provider when the current selection disappears
  // (e.g. the provider list changed) without an effect fighting the cache.
  const activeProviderId = providers.some((provider) => provider.id === selectedProviderId)
    ? selectedProviderId
    : (providers[0]?.id ?? "");

  const { data, isPending, isError, error, refetch } = useProviderOverview(activeProviderId);
  const identity = providerOverviewIdentity(data);
  const stats = providerOverviewStatRows(data);
  const coverage = providerOverviewCoverage(data);
  const operations = providerOverviewOperationRows(data);
  const unbound = providerOverviewUnboundOperationIds(data);
  const generatedAt = providerOverviewGeneratedAtLabel(data);
  const summary = providerOverviewSummaryLabel(data);

  const providerPicker = (
    <label className="flex items-center gap-2 text-xs text-content-muted">
      <span>Provider</span>
      <select
        aria-label="Select a provider to inspect"
        className="h-8 max-w-64 rounded-md border border-line-strong bg-surface-raised px-2 text-xs text-content"
        value={activeProviderId}
        onChange={(event) => setSelectedProviderId(event.target.value)}
        disabled={providers.length === 0}
      >
        {providers.length === 0 ? <option value="">No providers</option> : null}
        {providers.map((provider) => (
          <option key={provider.id} value={provider.id}>
            {providerOptionLabel(provider)}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <Card>
      <div className="p-4">
        <SectionHeader title={title} description={description} action={providerPicker} />
      </div>
      <div className="border-t border-line p-4">
        {providers.length === 0 ? (
          <EmptyState
            title="No providers to inspect"
            description="No local or cloud providers are available in the current data."
          />
        ) : isPending ? (
          <div className="space-y-6" aria-busy="true" aria-label="Loading provider overview">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} className="h-20" />
              ))}
            </div>
            <Skeleton className="h-40" />
          </div>
        ) : isError ? (
          <EmptyState
            title="Could not load provider overview"
            description={errorMessage(error)}
            action={
              <Button variant="primary" size="sm" onClick={() => void refetch()}>
                Try again
              </Button>
            }
          />
        ) : !data ? (
          <EmptyState
            title="Overview unavailable"
            description="The authoritative snapshot for this provider is not available right now."
          />
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 truncate text-sm font-semibold text-content" title={identity.nameLabel}>
                {identity.nameLabel}
              </span>
              <span className="text-2xs text-content-subtle">{identity.providerIdLabel}</span>
              <Badge tone="neutral">{identity.locationLabel}</Badge>
              <Badge tone={identity.statusTone}>{identity.statusLabel}</Badge>
            </div>

            <StatGrid rows={stats} />

            <section aria-label="Schema-match coverage" className="rounded-md border border-line p-4">
              <div className="mb-2 flex items-center justify-between text-xs text-content-muted">
                <span>Schema-match coverage</span>
                <span className="tabular-nums text-content">
                  {coverage.matched}/{coverage.total} · {coverage.percent}%
                </span>
              </div>
              <ProgressBar value={coverage.fraction} label="Schema-match coverage" />
            </section>

            {!hasProviderOverviewData(data) ? (
              <EmptyState
                title="No advertised operations"
                description="This provider advertises no operations or catalog bindings yet."
              />
            ) : (
              <div className="space-y-4">
                {operations.length > 0 ? <CatalogOperations rows={operations} /> : null}
                <UnboundOperations ids={unbound} />
              </div>
            )}

            {generatedAt ? (
              <p className="text-2xs text-content-subtle">
                {summary} · Snapshot generated {generatedAt}.
              </p>
            ) : null}
          </div>
        )}
      </div>
    </Card>
  );
}
