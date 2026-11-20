import { useState } from "react";
import { useExtensionOverview } from "../../hooks/useQueries";
import { errorMessage } from "../../lib/errors";
import type { Extension } from "../../lib/types";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card, SectionHeader } from "../../ui/Card";
import { EmptyState, Skeleton } from "../../ui/Feedback";
import {
  extensionOverviewGeneratedAtLabel,
  extensionOverviewIdentity,
  extensionOverviewInstalledLabel,
  extensionOverviewOptionLabel,
  extensionOverviewOptionValue,
  extensionOverviewScopeGroups,
  extensionOverviewStatRows,
  extensionOverviewSummaryLabel,
  hasExtensionOverviewData,
} from "./extensionOverviewHelpers";

function StatGrid({
  rows,
}: {
  readonly rows: ReturnType<typeof extensionOverviewStatRows>;
}) {
  return (
    <section aria-label="Extension snapshot" className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
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

function ScopeGroups({
  groups,
}: {
  readonly groups: ReturnType<typeof extensionOverviewScopeGroups>;
}) {
  const populated = groups.filter((group) => group.values.length > 0);
  if (populated.length === 0) return null;
  return (
    <section aria-label="Declared scope" className="space-y-3">
      {populated.map((group) => (
        <div key={group.key} className="rounded-md border border-line p-4">
          <h3 className="mb-2 text-sm font-medium text-content">{group.label}</h3>
          <div className="flex flex-wrap gap-2">
            {group.values.map((value, index) => (
              <Badge key={`${group.key}-${index}-${value}`} tone="neutral">
                {value}
              </Badge>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

export interface ExtensionOverviewPanelProps {
  /** Installed extensions available to inspect; the panel renders a picker over them. */
  readonly extensions: readonly Extension[];
  readonly title?: string;
  readonly description?: string;
}

/**
 * Authoritative single-extension overview (C222/C224/C225 follow-up), backed by
 * the `useExtensionOverview` query hook so the same view works in mock and live
 * mode. Renders explicit loading, error, missing-data, empty and populated
 * states; every display value is derived in `extensionOverviewHelpers`. There is
 * no extension-detail route, so the panel stays read-only.
 */
export function ExtensionOverviewPanel({
  extensions,
  title = "Extension overview snapshot",
  description = "Compact authoritative snapshot: manifest identity, trust flags and declared scope.",
}: ExtensionOverviewPanelProps) {
  const [selectedValue, setSelectedValue] = useState("");

  const options = extensions.map((extension) => ({
    value: extensionOverviewOptionValue(extension),
    label: extensionOverviewOptionLabel(extension),
  }));

  // Fall back to the first option when the current selection disappears
  // (e.g. the extension list changed) without an effect fighting the cache.
  const activeValue =
    options.some((option) => option.value === selectedValue)
      ? selectedValue
      : (options[0]?.value ?? "");

  const { data, isPending, isError, error, refetch } = useExtensionOverview(activeValue);
  const identity = extensionOverviewIdentity(data);
  const stats = extensionOverviewStatRows(data);
  const groups = extensionOverviewScopeGroups(data);
  const generatedAt = extensionOverviewGeneratedAtLabel(data);
  const installedAt = extensionOverviewInstalledLabel(data);
  const summary = extensionOverviewSummaryLabel(data);

  const picker = (
    <label className="flex items-center gap-2 text-xs text-content-muted">
      <span>Extension</span>
      <select
        aria-label="Select an extension to inspect"
        className="h-8 max-w-72 rounded-md border border-line-strong bg-surface-raised px-2 text-xs text-content"
        value={activeValue}
        onChange={(event) => setSelectedValue(event.target.value)}
        disabled={options.length === 0}
      >
        {options.length === 0 ? <option value="">No extensions</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <Card>
      <div className="p-4">
        <SectionHeader title={title} description={description} action={picker} />
      </div>
      <div className="border-t border-line p-4">
        {options.length === 0 ? (
          <EmptyState
            title="No extensions to inspect"
            description="Install an extension to see its authoritative manifest and declared scope."
          />
        ) : isPending ? (
          <div className="space-y-6" aria-busy="true" aria-label="Loading extension overview">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
              {Array.from({ length: 5 }, (_, index) => (
                <Skeleton key={index} className="h-20" />
              ))}
            </div>
            <Skeleton className="h-40" />
          </div>
        ) : isError ? (
          <EmptyState
            title="Could not load extension overview"
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
            description="The authoritative snapshot for this extension is not available right now."
          />
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 truncate text-sm font-semibold text-content" title={identity.manifestIdLabel}>
                {identity.nameLabel}
              </span>
              <span className="text-2xs text-content-subtle">{identity.publisherVersionLabel}</span>
              <span className="font-mono text-2xs text-content-subtle" title={identity.manifestIdLabel}>
                {identity.shortIdLabel}
              </span>
              <Badge tone={identity.typeTone}>{identity.typeLabel}</Badge>
              <Badge tone={identity.statusTone}>{identity.statusLabel}</Badge>
              <Badge tone={identity.trustTone}>{identity.trustLabel}</Badge>
            </div>

            <p className="text-2xs text-content-muted">
              Runtime: {identity.runtimeLabel}
              {installedAt ? ` · Installed ${installedAt}` : ""}
            </p>

            <StatGrid rows={stats} />

            {!hasExtensionOverviewData(data) ? (
              <EmptyState
                title="No declared scope"
                description="This extension declares no permissions, capabilities, providers, UI contributions or dependencies."
              />
            ) : (
              <ScopeGroups groups={groups} />
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
