import { useState } from "react";
import { useLineageFeed, useLineageOverview } from "../../hooks/useQueries";
import { errorMessage } from "../../lib/errors";
import { useUiStore } from "../../stores/uiStore";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card, SectionHeader } from "../../ui/Card";
import { EmptyState, Skeleton } from "../../ui/Feedback";
import {
  LINEAGE_OVERVIEW_FEED_LIMITS,
  buildLineageOverviewFeedOptions,
  buildLineageOverviewOptions,
  hasLineageOverviewData,
  lineageOverviewActiveOption,
  lineageOverviewCountRows,
  lineageOverviewEmptyDescription,
  lineageOverviewGeneratedAtLabel,
  lineageOverviewIdentity,
  lineageOverviewPickerOptions,
  lineageOverviewRecentRows,
  lineageOverviewSummaryLabel,
  type LineageOverviewCountRow,
  type LineageOverviewSiblingRow,
} from "./lineageOverviewHelpers";
import { lineageFeedRows } from "./lineageFeedHelpers";

function CountGrid({ rows }: { readonly rows: readonly LineageOverviewCountRow[] }) {
  return (
    <section aria-label="Whole-source-asset lineage counts" className="grid grid-cols-2 gap-3">
      {rows.map((row) => (
        <div key={row.key} className="rounded-md border border-line bg-surface-raised p-3">
          <p className="text-2xs font-semibold uppercase tracking-wider text-content-subtle">
            {row.label}
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-content">{row.value}</p>
          <p className="mt-0.5 text-2xs text-content-muted">{row.hint}</p>
        </div>
      ))}
    </section>
  );
}

function SiblingRow({
  row,
  onOpenSource,
  onOpenTarget,
}: {
  readonly row: LineageOverviewSiblingRow;
  readonly onOpenSource: (row: LineageOverviewSiblingRow) => void;
  readonly onOpenTarget: (row: LineageOverviewSiblingRow) => void;
}) {
  return (
    <li className="flex items-start gap-3">
      <Badge tone={row.typeTone}>{row.typeLabel}</Badge>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs text-content" title={`${row.fromAssetName} → ${row.toAssetName}`}>
          {row.fromAssetName} <span aria-hidden="true">→</span> {row.toAssetName}
        </p>
        <p className="mt-0.5 truncate text-2xs text-content-muted" title={row.projectName}>
          {row.projectName}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <time className="text-2xs text-content-subtle" dateTime={row.timestamp}>
          {row.relativeTime}
        </time>
        {row.hasTarget ? (
          <Button variant="secondary" size="sm" onClick={() => onOpenTarget(row)}>
            Target
          </Button>
        ) : null}
        <Button variant="secondary" size="sm" onClick={() => onOpenSource(row)}>
          Source
        </Button>
      </div>
    </li>
  );
}

export interface LineageOverviewPanelProps {
  /** Optional project scope; omitted offers relationships across the workspace. */
  readonly projectId?: string;
  readonly title?: string;
  readonly description?: string;
}

/**
 * Authoritative single lineage-relationship overview (C258/C260/C261 follow-up),
 * backed by the `useLineageOverview` query hook so the same view works in mock and
 * live mode. The picker is populated from the authoritative `useLineageFeed`
 * query, optionally scoped to `projectId`. Renders explicit loading, error,
 * missing-data, empty and populated states; every display value is derived in
 * `lineageOverviewHelpers`. Rows stay read-only (no relationship-detail route);
 * the project and asset buttons deep-link to their existing screens, scoping the
 * assets browser to the relationship's project before selecting an endpoint.
 */
export function LineageOverviewPanel({
  projectId,
  title = "Relationship overview",
  description = "Select an asset relationship to inspect both endpoints and whole-source-asset lineage activity.",
}: LineageOverviewPanelProps) {
  const navigate = useUiStore((s) => s.navigate);
  const setAssetsProjectId = useUiStore((s) => s.setAssetsProjectId);
  const [selectedValue, setSelectedValue] = useState("");
  const [feedLimit, setFeedLimit] = useState(25);

  const {
    data: feedData,
    isPending: feedPending,
    isError: feedError,
    error: feedErr,
    refetch: refetchFeed,
  } = useLineageFeed(buildLineageOverviewFeedOptions(projectId, feedLimit));

  const options = lineageOverviewPickerOptions(lineageFeedRows(feedData));
  // Fall back to the first relationship when the current selection disappears
  // (e.g. the feed changed) without an effect fighting the query cache.
  const active = lineageOverviewActiveOption(options, selectedValue);

  const { data, isPending, isError, error, refetch } = useLineageOverview(
    active?.relationshipId ?? "",
    buildLineageOverviewOptions(),
  );

  const identity = lineageOverviewIdentity(data);
  const counts = lineageOverviewCountRows(data);
  const siblings = lineageOverviewRecentRows(data);
  const generatedAt = lineageOverviewGeneratedAtLabel(data);
  const summary = lineageOverviewSummaryLabel(data);

  const picker = (
    <label className="flex items-center gap-2 text-xs text-content-muted">
      <span>Relationship</span>
      <select
        aria-label="Select an asset relationship to inspect"
        className="h-8 max-w-96 rounded-md border border-line-strong bg-surface-raised px-2 text-xs text-content"
        value={active?.value ?? ""}
        onChange={(event) => setSelectedValue(event.target.value)}
        disabled={options.length === 0}
      >
        {options.length === 0 ? <option value="">No relationships</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );

  const openAsset = (assetId: string, projectScope: string) => {
    setAssetsProjectId(projectScope);
    navigate("assets", { assetId });
  };

  return (
    <Card>
      <div className="p-4">
        <SectionHeader title={title} description={description} action={picker} />
        <div
          className="mt-3 flex flex-wrap items-center gap-2"
          role="group"
          aria-label="Relationships available in the picker"
        >
          <span className="text-2xs text-content-subtle">Picker feed</span>
          {LINEAGE_OVERVIEW_FEED_LIMITS.map((value) => (
            <Button
              key={value}
              variant={feedLimit === value ? "primary" : "secondary"}
              size="sm"
              aria-pressed={feedLimit === value}
              onClick={() => setFeedLimit(value)}
            >
              {value}
            </Button>
          ))}
        </div>
      </div>

      <div className="border-t border-line p-4">
        {feedPending ? (
          <div className="space-y-6" aria-busy="true" aria-label="Loading relationships">
            <Skeleton className="h-8 w-1/2" />
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} className="h-20" />
              ))}
            </div>
            <Skeleton className="h-40" />
          </div>
        ) : feedError ? (
          <EmptyState
            title="Could not load relationships"
            description={errorMessage(feedErr)}
            action={
              <Button variant="primary" size="sm" onClick={() => void refetchFeed()}>
                Try again
              </Button>
            }
          />
        ) : options.length === 0 ? (
          <EmptyState
            title="No relationships to inspect"
            description={lineageOverviewEmptyDescription(Boolean(projectId))}
          />
        ) : isPending ? (
          <div className="space-y-6" aria-busy="true" aria-label="Loading relationship overview">
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} className="h-20" />
              ))}
            </div>
            <Skeleton className="h-40" />
          </div>
        ) : isError ? (
          <EmptyState
            title="Could not load relationship overview"
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
            description="The authoritative snapshot for this relationship is not available right now."
          />
        ) : !hasLineageOverviewData(data) ? (
          <EmptyState
            title="No recorded lineage activity"
            description="This relationship has no sibling links or whole-source-asset activity yet."
          />
        ) : (
          <div className="space-y-6">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={identity.typeTone}>{identity.typeLabel}</Badge>
                <Badge tone="info">{identity.fromTypeLabel || "Asset"}</Badge>
                {identity.hasTarget ? <Badge tone="accent">{identity.toTypeLabel || "Asset"}</Badge> : null}
                <span className="text-sm font-semibold text-content">{identity.projectLabel}</span>
              </div>
              <p className="text-sm text-content">
                {identity.fromName} <span aria-hidden="true">→</span> {identity.toName}
              </p>
              <p className="text-xs text-content-muted">
                Linked {identity.createdLabel || "—"} · {identity.shortId}
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => navigate("projects", { projectId: data.project_id })}
                >
                  Open project
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => openAsset(data.from_asset_id, data.project_id)}
                >
                  Open source
                </Button>
                {identity.hasTarget ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => openAsset(data.to_asset_id, data.project_id)}
                  >
                    Open target
                  </Button>
                ) : null}
              </div>
            </div>

            <CountGrid rows={counts} />

            <section aria-label="Sibling relationships" className="rounded-md border border-line p-4">
              <h3 className="mb-3 text-sm font-medium text-content">Newest links in this project</h3>
              {siblings.length === 0 ? (
                <p className="text-xs text-content-muted">No sibling relationships yet.</p>
              ) : (
                <ul className="space-y-2">
                  {siblings.map((row) => (
                    <SiblingRow
                      key={row.id}
                      row={row}
                      onOpenSource={(item) => openAsset(item.fromAssetId, item.projectId)}
                      onOpenTarget={(item) => openAsset(item.toAssetId, item.projectId)}
                    />
                  ))}
                </ul>
              )}
            </section>

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
