import { useState } from "react";
import { useOperationOverview } from "../../hooks/useQueries";
import { errorMessage } from "../../lib/errors";
import type { OperationSpec } from "../../lib/types";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card, SectionHeader } from "../../ui/Card";
import { EmptyState, Skeleton } from "../../ui/Feedback";
import { ProgressBar } from "../../ui/ProgressBar";
import {
  hasOperationOverviewData,
  operationOptionLabel,
  operationOverviewBindingRows,
  operationOverviewCoverage,
  operationOverviewGeneratedAtLabel,
  operationOverviewIdentity,
  operationOverviewSettingKeysLabel,
  operationOverviewStatRows,
  operationOverviewSummaryLabel,
  operationOverviewTypesLabel,
  operationOverviewUnboundProviderIds,
  type OperationOverviewBindingRow,
} from "./operationOverviewHelpers";

function StatGrid({
  rows,
}: {
  readonly rows: ReturnType<typeof operationOverviewStatRows>;
}) {
  return (
    <section aria-label="Operation shape" className="grid grid-cols-2 gap-3 md:grid-cols-4">
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

function CatalogShape({ overview }: { readonly overview: Parameters<typeof operationOverviewIdentity>[0] }) {
  const input = operationOverviewTypesLabel(overview?.input_types);
  const output = operationOverviewTypesLabel(overview?.output_types);
  const settings = operationOverviewSettingKeysLabel(overview?.setting_keys);
  return (
    <section aria-label="Catalog shape" className="rounded-md border border-line p-4">
      <h3 className="mb-3 text-sm font-medium text-content">Catalog shape</h3>
      <dl className="space-y-2 text-xs">
        <div className="flex gap-2">
          <dt className="w-20 shrink-0 text-content-subtle">Inputs</dt>
          <dd className="min-w-0 flex-1 text-content">{input}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-20 shrink-0 text-content-subtle">Outputs</dt>
          <dd className="min-w-0 flex-1 text-content">{output}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-20 shrink-0 text-content-subtle">Settings</dt>
          <dd className="min-w-0 flex-1 break-words text-content">{settings}</dd>
        </div>
      </dl>
    </section>
  );
}

function ProviderBindings({ rows }: { readonly rows: readonly OperationOverviewBindingRow[] }) {
  return (
    <section aria-label="Provider bindings" className="rounded-md border border-line p-4">
      <h3 className="mb-3 text-sm font-medium text-content">Provider bindings</h3>
      <ul className="space-y-3">
        {rows.map((row) => (
          <li key={row.key} className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="min-w-0 truncate text-xs font-medium text-content" title={row.nameLabel}>
              {row.nameLabel}
            </span>
            <span className="text-2xs text-content-subtle" title={row.providerId}>
              {row.providerId || "—"}
            </span>
            <Badge tone="neutral">{row.locationLabel}</Badge>
            <Badge tone={row.statusTone}>{row.statusLabel}</Badge>
            <Badge tone={row.schemaTone}>{row.schemaLabel}</Badge>
            <span className="text-2xs text-content-muted" title="Advertised schema versions">
              versions: {row.advertisedLabel}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function UnboundProviders({ ids }: { readonly ids: readonly string[] }) {
  if (ids.length === 0) return null;
  return (
    <section aria-label="Declared providers without a binding" className="rounded-md border border-line p-4">
      <h3 className="mb-2 text-sm font-medium text-content">Declared but unbound</h3>
      <p className="mb-2 text-2xs text-content-muted">
        Declared provider ids that do not advertise this operation in the catalog.
      </p>
      <ul className="flex flex-wrap gap-2">
        {ids.map((id) => (
          <li key={id}>
            <Badge tone="warning">{id}</Badge>
          </li>
        ))}
      </ul>
    </section>
  );
}

export interface OperationOverviewPanelProps {
  /** Catalog operations available to inspect; the panel renders a picker over them. */
  readonly operations: readonly OperationSpec[];
  readonly title?: string;
  readonly description?: string;
}

/**
 * Authoritative single-operation overview (C230/C232/C233 follow-up), backed by
 * the `useOperationOverview` query hook so the same view works in mock and live
 * mode. Renders explicit loading, error, missing-data, empty and populated
 * states; every display value is derived in `operationOverviewHelpers`. Rows
 * stay read-only because there is no operation-detail route.
 */
export function OperationOverviewPanel({
  operations,
  title = "Operation overview snapshot",
  description = "Compact authoritative snapshot: catalog shape, provider bindings and schema drift.",
}: OperationOverviewPanelProps) {
  const [selectedOperationId, setSelectedOperationId] = useState("");

  // Fall back to the first operation when the current selection disappears
  // (e.g. the catalog changed) without an effect fighting the query cache.
  const activeOperationId = operations.some((operation) => operation.id === selectedOperationId)
    ? selectedOperationId
    : (operations[0]?.id ?? "");

  const { data, isPending, isError, error, refetch } = useOperationOverview(activeOperationId);
  const identity = operationOverviewIdentity(data);
  const stats = operationOverviewStatRows(data);
  const coverage = operationOverviewCoverage(data);
  const bindings = operationOverviewBindingRows(data);
  const unbound = operationOverviewUnboundProviderIds(data);
  const generatedAt = operationOverviewGeneratedAtLabel(data);
  const summary = operationOverviewSummaryLabel(data);

  const operationPicker = (
    <label className="flex items-center gap-2 text-xs text-content-muted">
      <span>Operation</span>
      <select
        aria-label="Select an operation to inspect"
        className="h-8 max-w-64 rounded-md border border-line-strong bg-surface-raised px-2 text-xs text-content"
        value={activeOperationId}
        onChange={(event) => setSelectedOperationId(event.target.value)}
        disabled={operations.length === 0}
      >
        {operations.length === 0 ? <option value="">No operations</option> : null}
        {operations.map((operation) => (
          <option key={operation.id} value={operation.id}>
            {operationOptionLabel(operation)}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <Card>
      <div className="p-4">
        <SectionHeader title={title} description={description} action={operationPicker} />
      </div>
      <div className="border-t border-line p-4">
        {operations.length === 0 ? (
          <EmptyState
            title="No operations to inspect"
            description="The authoritative operation catalog is empty in the current data."
          />
        ) : isPending ? (
          <div className="space-y-6" aria-busy="true" aria-label="Loading operation overview">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} className="h-20" />
              ))}
            </div>
            <Skeleton className="h-40" />
          </div>
        ) : isError ? (
          <EmptyState
            title="Could not load operation overview"
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
            description="The authoritative snapshot for this operation is not available right now."
          />
        ) : (
          <div className="space-y-6">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 truncate text-sm font-semibold text-content" title={identity.titleLabel}>
                  {identity.titleLabel}
                </span>
                <span className="text-2xs text-content-subtle">{identity.operationIdLabel}</span>
                <Badge tone="neutral">{`Schema ${identity.schemaLabel}`}</Badge>
                <Badge tone={identity.streamingTone}>{identity.streamingLabel}</Badge>
              </div>
              <p className="text-xs text-content-muted">{identity.description}</p>
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

            {!hasOperationOverviewData(data) ? (
              <EmptyState
                title="No catalog shape recorded"
                description="This operation has no settings, asset types or provider bindings yet."
              />
            ) : (
              <div className="space-y-4">
                <CatalogShape overview={data} />
                {bindings.length > 0 ? <ProviderBindings rows={bindings} /> : null}
                <UnboundProviders ids={unbound} />
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
