import { useState } from "react";
import { usePublishFeed, usePublishOverview } from "../../hooks/useQueries";
import { errorMessage } from "../../lib/errors";
import { useUiStore } from "../../stores/uiStore";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card, SectionHeader } from "../../ui/Card";
import { EmptyState, Skeleton } from "../../ui/Feedback";
import { publishFeedRows } from "./publishFeedHelpers";
import {
  buildPublishOverviewOptions,
  buildPublishPickerFeedOptions,
  hasPublishOverviewData,
  publishOverviewActiveOption,
  publishOverviewCountRows,
  publishOverviewEmptyDescription,
  publishOverviewGeneratedAtLabel,
  publishOverviewIdentity,
  publishOverviewPickerOptions,
  publishOverviewRecentSiblings,
  publishOverviewSummaryLabel,
  PUBLISH_OVERVIEW_DEFAULT_RECENT_LIMIT,
  PUBLISH_OVERVIEW_RECENT_LIMITS,
  type PublishOverviewCountRow,
  type PublishOverviewSiblingRow,
} from "./publishOverviewHelpers";

function CountGrid({ rows }: { readonly rows: readonly PublishOverviewCountRow[] }) {
  return (
    <section aria-label="Whole-scope publish counts" className="grid grid-cols-2 gap-3 md:grid-cols-3">
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

function RecentSiblings({ rows }: { readonly rows: readonly PublishOverviewSiblingRow[] }) {
  return (
    <section aria-label="Recent publications in this project" className="rounded-md border border-line p-4">
      <h3 className="mb-3 text-sm font-medium text-content">Newest publications in this project</h3>
      {rows.length === 0 ? (
        <p className="text-xs text-content-muted">No sibling publications in this project yet.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center gap-3">
              <Badge tone={row.typeTone}>{row.typeLabel}</Badge>
              <Badge tone="info">{row.versionLabel}</Badge>
              {row.selected ? <Badge tone="success">Viewing</Badge> : null}
              <span className="min-w-0 flex-1 truncate text-xs text-content" title={row.assetName}>
                {row.assetName}
              </span>
              <span className="shrink-0 text-2xs tabular-nums text-content-muted">{row.sizeLabel}</span>
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

export interface PublishOverviewPanelProps {
  /** Optional project scope; omitted offers publications across the workspace. */
  readonly projectId?: string;
  readonly title?: string;
  readonly description?: string;
}

/**
 * Authoritative single publish-receipt overview (C278/C280/C281 follow-up),
 * backed by the `usePublishOverview` query hook so the same view works in mock
 * and live mode. The picker is populated from the authoritative `usePublishFeed`
 * query, optionally scoped to `projectId`. Renders explicit loading, error,
 * missing-data, empty and populated states; every display value is derived in
 * `publishOverviewHelpers`. Rows stay read-only (no publication-detail route);
 * the Open button scopes the assets browser to the publication's project before
 * selecting the asset so the detail panel is always resolvable.
 */
export function PublishOverviewPanel({
  projectId,
  title = "Publication overview",
  description = "Select a publication to inspect its receipt identity and whole-project publish activity.",
}: PublishOverviewPanelProps) {
  const navigate = useUiStore((s) => s.navigate);
  const setAssetsProjectId = useUiStore((s) => s.setAssetsProjectId);
  const [selectedValue, setSelectedValue] = useState("");
  const [recentLimit, setRecentLimit] = useState(PUBLISH_OVERVIEW_DEFAULT_RECENT_LIMIT);

  const {
    data: feedData,
    isPending: feedPending,
    isError: feedError,
    error: feedErr,
    refetch: refetchFeed,
  } = usePublishFeed(buildPublishPickerFeedOptions(projectId));

  const options = publishOverviewPickerOptions(publishFeedRows(feedData));
  // Fall back to the first publication when the current selection disappears
  // (e.g. the feed changed) without an effect fighting the query cache.
  const active = publishOverviewActiveOption(options, selectedValue);

  const { data, isPending, isError, error, refetch } = usePublishOverview(
    active?.assetId ?? "",
    buildPublishOverviewOptions(recentLimit),
  );

  const identity = publishOverviewIdentity(data);
  const counts = publishOverviewCountRows(data);
  const siblings = publishOverviewRecentSiblings(data);
  const generatedAt = publishOverviewGeneratedAtLabel(data);
  const summary = publishOverviewSummaryLabel(data);

  const picker = (
    <label className="flex items-center gap-2 text-xs text-content-muted">
      <span>Publication</span>
      <select
        aria-label="Select a publication to inspect"
        className="h-8 max-w-96 rounded-md border border-line-strong bg-surface-raised px-2 text-xs text-content"
        value={active?.value ?? ""}
        onChange={(event) => setSelectedValue(event.target.value)}
        disabled={options.length === 0}
      >
        {options.length === 0 ? <option value="">No publications</option> : null}
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
        <div
          className="mt-3 flex flex-wrap items-center gap-2"
          role="group"
          aria-label="Recent publications to show"
        >
          <span className="text-2xs text-content-subtle">Show</span>
          {PUBLISH_OVERVIEW_RECENT_LIMITS.map((value) => (
            <Button
              key={value}
              variant={recentLimit === value ? "primary" : "secondary"}
              size="sm"
              aria-pressed={recentLimit === value}
              onClick={() => setRecentLimit(value)}
            >
              {value}
            </Button>
          ))}
        </div>
      </div>

      <div className="border-t border-line p-4">
        {feedPending ? (
          <div className="space-y-6" aria-busy="true" aria-label="Loading publications">
            <Skeleton className="h-8 w-1/2" />
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {Array.from({ length: 3 }, (_, index) => (
                <Skeleton key={index} className="h-20" />
              ))}
            </div>
            <Skeleton className="h-40" />
          </div>
        ) : feedError ? (
          <EmptyState
            title="Could not load publications"
            description={errorMessage(feedErr)}
            action={
              <Button variant="primary" size="sm" onClick={() => void refetchFeed()}>
                Try again
              </Button>
            }
          />
        ) : options.length === 0 ? (
          <EmptyState
            title="No publications to inspect"
            description={publishOverviewEmptyDescription(Boolean(projectId))}
          />
        ) : isPending ? (
          <div className="space-y-6" aria-busy="true" aria-label="Loading publication overview">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {Array.from({ length: 3 }, (_, index) => (
                <Skeleton key={index} className="h-20" />
              ))}
            </div>
            <Skeleton className="h-40" />
          </div>
        ) : isError ? (
          <EmptyState
            title="Could not load publication overview"
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
            description="The authoritative snapshot for this publication is not available right now."
          />
        ) : !hasPublishOverviewData(data) ? (
          <EmptyState
            title="No recorded publish activity"
            description="This publication has no receipt counts or sibling records yet."
          />
        ) : (
          <div className="space-y-6">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={identity.typeTone}>{identity.typeLabel}</Badge>
                <Badge tone="info">{identity.versionLabel}</Badge>
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
                {identity.sizeLabel} delivered · published {identity.publishedLabel}
              </p>
            </div>

            <CountGrid rows={counts} />

            <RecentSiblings rows={siblings} />

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
