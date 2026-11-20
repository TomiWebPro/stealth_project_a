import { useState } from "react";
import { useVersionFeed, useVersionOverview } from "../../hooks/useQueries";
import { errorMessage } from "../../lib/errors";
import { useUiStore } from "../../stores/uiStore";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card, SectionHeader } from "../../ui/Card";
import { EmptyState, Skeleton } from "../../ui/Feedback";
import { buildVersionFeedOptions, versionFeedRows } from "./versionFeedHelpers";
import {
  buildVersionOverviewOptions,
  hasVersionOverviewData,
  versionOverviewActiveOption,
  versionOverviewCountRows,
  versionOverviewEmptyDescription,
  versionOverviewGeneratedAtLabel,
  versionOverviewIdentity,
  versionOverviewPickerOptions,
  versionOverviewRecentVersions,
  versionOverviewSummaryLabel,
  type VersionOverviewCountRow,
  type VersionOverviewSiblingRow,
} from "./versionOverviewHelpers";

function CountGrid({ rows }: { readonly rows: readonly VersionOverviewCountRow[] }) {
  return (
    <section aria-label="Whole-asset version counts" className="grid grid-cols-2 gap-3">
      {rows.map((row) => (
        <div key={row.key} className="rounded-md border border-line bg-surface-raised p-3">
          <p className="text-2xs font-semibold uppercase tracking-wider text-content-subtle">{row.label}</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-content">{row.value}</p>
          <p className="mt-0.5 text-2xs text-content-muted">{row.hint}</p>
        </div>
      ))}
    </section>
  );
}

function SiblingVersions({ rows }: { readonly rows: readonly VersionOverviewSiblingRow[] }) {
  return (
    <section aria-label="Sibling version records" className="rounded-md border border-line p-4">
      <h3 className="mb-3 text-sm font-medium text-content">Newest versions of this asset</h3>
      {rows.length === 0 ? (
        <p className="text-xs text-content-muted">No sibling version records for this asset yet.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center gap-3">
              <Badge tone="info">{row.versionLabel}</Badge>
              {row.latest ? <Badge tone="success">Latest</Badge> : null}
              <span className="shrink-0 text-2xs tabular-nums text-content-muted">{row.bytesLabel}</span>
              <span className="min-w-0 flex-1 truncate text-2xs text-content-subtle" title={row.creatorLabel}>
                {row.creatorLabel}
              </span>
              <time className="shrink-0 text-2xs text-content-subtle" dateTime={row.timestamp}>
                {row.relativeTime}
              </time>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export interface VersionOverviewPanelProps {
  /** Optional project scope; omitted offers versions across the workspace. */
  readonly projectId?: string;
  readonly title?: string;
  readonly description?: string;
}

/**
 * Authoritative single asset-version overview (C250/C252/C253 follow-up), backed
 * by the `useVersionOverview` query hook so the same view works in mock and live
 * mode. The picker is populated from the authoritative `useVersionFeed` query,
 * optionally scoped to `projectId`. Renders explicit loading, error,
 * missing-data, empty and populated states; every display value is derived in
 * `versionOverviewHelpers`. Version rows stay read-only (no version-detail
 * route); the Open button scopes the assets browser to the version's project
 * before selecting the asset so the detail panel is always resolvable.
 */
export function VersionOverviewPanel({
  projectId,
  title = "Asset version overview",
  description = "Select a version to inspect its identity, storage reference and whole-asset version activity.",
}: VersionOverviewPanelProps) {
  const navigate = useUiStore((s) => s.navigate);
  const setAssetsProjectId = useUiStore((s) => s.setAssetsProjectId);
  const [selectedValue, setSelectedValue] = useState("");

  const {
    data: feedData,
    isPending: feedPending,
    isError: feedError,
    error: feedErr,
    refetch: refetchFeed,
  } = useVersionFeed(buildVersionFeedOptions(projectId, 25));

  const options = versionOverviewPickerOptions(versionFeedRows(feedData));
  // Fall back to the first version when the current selection disappears (e.g.
  // the feed changed) without an effect fighting the query cache.
  const active = versionOverviewActiveOption(options, selectedValue);

  const { data, isPending, isError, error, refetch } = useVersionOverview(
    active?.assetId ?? "",
    active?.version ?? 1,
    buildVersionOverviewOptions(),
  );

  const identity = versionOverviewIdentity(data);
  const counts = versionOverviewCountRows(data);
  const siblings = versionOverviewRecentVersions(data);
  const generatedAt = versionOverviewGeneratedAtLabel(data);
  const summary = versionOverviewSummaryLabel(data);

  const picker = (
    <label className="flex items-center gap-2 text-xs text-content-muted">
      <span>Version</span>
      <select
        aria-label="Select an asset version to inspect"
        className="h-8 max-w-96 rounded-md border border-line-strong bg-surface-raised px-2 text-xs text-content"
        value={active?.value ?? ""}
        onChange={(event) => setSelectedValue(event.target.value)}
        disabled={options.length === 0}
      >
        {options.length === 0 ? <option value="">No versions</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );

  const openAsset = () => {
    if (!data) return;
    setAssetsProjectId(data.project_id);
    navigate("assets", { assetId: data.asset_id });
  };

  return (
    <Card>
      <div className="p-4">
        <SectionHeader title={title} description={description} action={picker} />
      </div>

      <div className="border-t border-line p-4">
        {feedPending ? (
          <div className="space-y-6" aria-busy="true" aria-label="Loading asset versions">
            <Skeleton className="h-8 w-1/2" />
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 2 }, (_, index) => (
                <Skeleton key={index} className="h-20" />
              ))}
            </div>
            <Skeleton className="h-40" />
          </div>
        ) : feedError ? (
          <EmptyState
            title="Could not load asset versions"
            description={errorMessage(feedErr)}
            action={
              <Button variant="primary" size="sm" onClick={() => void refetchFeed()}>
                Try again
              </Button>
            }
          />
        ) : options.length === 0 ? (
          <EmptyState
            title="No asset versions to inspect"
            description={versionOverviewEmptyDescription(Boolean(projectId))}
          />
        ) : isPending ? (
          <div className="space-y-6" aria-busy="true" aria-label="Loading asset version overview">
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 2 }, (_, index) => (
                <Skeleton key={index} className="h-20" />
              ))}
            </div>
            <Skeleton className="h-40" />
          </div>
        ) : isError ? (
          <EmptyState
            title="Could not load version overview"
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
            description="The authoritative snapshot for this asset version is not available right now."
          />
        ) : !hasVersionOverviewData(data) ? (
          <EmptyState
            title="No recorded version activity"
            description="This version has no sibling records or whole-asset version activity yet."
          />
        ) : (
          <div className="space-y-6">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={identity.typeTone}>{identity.typeLabel}</Badge>
                <Badge tone="info">{identity.versionLabel}</Badge>
                <Badge tone={identity.latestTone}>{identity.latestLabel}</Badge>
                <span
                  className="min-w-0 truncate text-sm font-semibold text-content"
                  title={identity.assetName}
                >
                  {identity.assetName}
                </span>
                <Button variant="secondary" size="sm" onClick={openAsset}>
                  Open asset
                </Button>
                {identity.projectLabel ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => navigate("projects", { projectId: data.project_id })}
                  >
                    {identity.projectLabel}
                  </Button>
                ) : null}
              </div>
              <p className="text-xs text-content-muted">
                {identity.storageLabel} · {identity.contentTypeLabel || "—"} ·{" "}
                <span title={identity.creatorLabel}>By {identity.creatorLabel}</span>
              </p>
              <p className="text-xs text-content-subtle">Created {identity.createdLabel || "—"}</p>
            </div>

            <CountGrid rows={counts} />

            <SiblingVersions rows={siblings} />

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
