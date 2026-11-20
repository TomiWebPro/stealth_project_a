import { useState } from "react";
import { useTagOverview, useTags } from "../../hooks/useQueries";
import { errorMessage } from "../../lib/errors";
import { useUiStore } from "../../stores/uiStore";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card, SectionHeader } from "../../ui/Card";
import { EmptyState, Skeleton } from "../../ui/Feedback";
import {
  TAG_OVERVIEW_RECENT_LIMITS,
  buildTagOverviewOptions,
  buildTagOverviewPickerOptions,
  hasTagOverviewData,
  tagOverviewActiveOption,
  tagOverviewCountRows,
  tagOverviewEmptyDescription,
  tagOverviewIdentity,
  tagOverviewPickerOptions,
  tagOverviewRecentAssets,
  tagOverviewSummaryLabel,
  type TagOverviewCountRow,
} from "./tagOverviewHelpers";
import { tagFacetItems } from "./tagHelpers";
import type { AssetFeedRow } from "../assets/assetFeedHelpers";

function CountGrid({ rows }: { readonly rows: readonly TagOverviewCountRow[] }) {
  return (
    <section aria-label="Whole-scope tag counts" className="grid grid-cols-2 gap-3 md:grid-cols-3">
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

function RecentAssets({
  rows,
  onOpen,
}: {
  readonly rows: readonly AssetFeedRow[];
  readonly onOpen: (row: AssetFeedRow) => void;
}) {
  return (
    <section aria-label="Recent assets carrying this tag" className="rounded-md border border-line p-4">
      <h3 className="mb-3 text-sm font-medium text-content">Newest assets with this tag</h3>
      {rows.length === 0 ? (
        <p className="text-xs text-content-muted">No tagged assets in the recent page yet.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center gap-3">
              <Badge tone={row.typeTone}>{row.typeLabel}</Badge>
              <Badge tone={row.statusTone}>{row.statusLabel}</Badge>
              <Badge tone="info">{row.versionLabel}</Badge>
              <span className="min-w-0 flex-1 truncate text-xs text-content" title={row.assetName}>
                {row.assetName}
              </span>
              <span className="shrink-0 text-2xs tabular-nums text-content-muted">{row.sizeLabel}</span>
              <time className="shrink-0 text-2xs text-content-subtle" dateTime={row.timestamp}>
                {row.relativeTime}
              </time>
              <Button variant="secondary" size="sm" onClick={() => onOpen(row)}>
                Open
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export interface TagOverviewPanelProps {
  /** Optional project scope; omitted covers tags across the whole workspace. */
  readonly projectId?: string;
  readonly title?: string;
  readonly description?: string;
}

/**
 * Authoritative single-tag overview (C282/C284/C285 follow-up), backed by the
 * `useTagOverview` query hook so the same view works in mock and live mode. The
 * picker is populated from the authoritative `useTags` tag index (the same
 * source as the tag-facet panel), optionally scoped to `projectId`.
 * Renders explicit loading, error, missing-data, empty and populated states;
 * every display value is derived in `tagOverviewHelpers`. Rows stay read-only
 * (no tag-detail route); Open scopes the assets browser to the asset's project
 * before selecting it so the detail panel is always resolvable.
 */
export function TagOverviewPanel({
  projectId,
  title = "Tag overview",
  description = "Select a tag to inspect its usage and the newest assets carrying it.",
}: TagOverviewPanelProps) {
  const navigate = useUiStore((s) => s.navigate);
  const setAssetsProjectId = useUiStore((s) => s.setAssetsProjectId);
  const [selectedValue, setSelectedValue] = useState("");
  const [recentLimit, setRecentLimit] = useState(TAG_OVERVIEW_RECENT_LIMITS[0]);

  const {
    data: indexData,
    isPending: indexPending,
    isError: indexError,
    error: indexErr,
    refetch: refetchIndex,
  } = useTags(buildTagOverviewPickerOptions(projectId));

  const options = tagOverviewPickerOptions(tagFacetItems(indexData));
  // Fall back to the first tag when the current selection disappears (e.g. the
  // index changed) without an effect fighting the query cache.
  const active = tagOverviewActiveOption(options, selectedValue);

  const { data, isPending, isError, error, refetch } = useTagOverview(
    active?.value ?? "",
    buildTagOverviewOptions(recentLimit, projectId),
  );

  const identity = tagOverviewIdentity(data);
  const counts = tagOverviewCountRows(data);
  const recentAssets = tagOverviewRecentAssets(data);
  const summary = tagOverviewSummaryLabel(data);

  const picker = (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-2 text-xs text-content-muted">
        <span>Tag</span>
        <select
          aria-label="Select a tag to inspect"
          className="h-8 max-w-64 rounded-md border border-line-strong bg-surface-raised px-2 text-xs text-content"
          value={active?.value ?? ""}
          onChange={(event) => setSelectedValue(event.target.value)}
          disabled={options.length === 0}
        >
          {options.length === 0 ? <option value="">No tags</option> : null}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <Button variant="secondary" size="sm" onClick={() => void refetch()}>
        Refresh
      </Button>
    </div>
  );

  const openAsset = (row: AssetFeedRow) => {
    setAssetsProjectId(row.projectId);
    navigate("assets", { assetId: row.assetId });
  };

  return (
    <Card>
      <div className="p-4">
        <SectionHeader title={title} description={description} action={picker} />
        <div
          className="mt-3 flex flex-wrap items-center gap-2"
          role="group"
          aria-label="Recent tagged assets to show"
        >
          <span className="text-2xs text-content-subtle">Show</span>
          {TAG_OVERVIEW_RECENT_LIMITS.map((value) => (
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
        {indexPending ? (
          <div className="space-y-6" aria-busy="true" aria-label="Loading tag index">
            <Skeleton className="h-8 w-1/2" />
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {Array.from({ length: 3 }, (_, index) => (
                <Skeleton key={index} className="h-20" />
              ))}
            </div>
            <Skeleton className="h-40" />
          </div>
        ) : indexError ? (
          <EmptyState
            title="Could not load tags"
            description={errorMessage(indexErr)}
            action={
              <Button variant="primary" size="sm" onClick={() => void refetchIndex()}>
                Try again
              </Button>
            }
          />
        ) : options.length === 0 ? (
          <EmptyState title="No tags to inspect" description={tagOverviewEmptyDescription(Boolean(projectId))} />
        ) : isPending ? (
          <div className="space-y-6" aria-busy="true" aria-label="Loading tag overview">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {Array.from({ length: 3 }, (_, index) => (
                <Skeleton key={index} className="h-20" />
              ))}
            </div>
            <Skeleton className="h-40" />
          </div>
        ) : isError ? (
          <EmptyState
            title="Could not load tag overview"
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
            description="The authoritative snapshot for this tag is not available right now."
          />
        ) : !hasTagOverviewData(data) ? (
          <EmptyState
            title="No recorded tag activity"
            description="This tag has no asset counts or tagged assets yet."
          />
        ) : (
          <div className="space-y-6">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="accent">{identity.tagLabel}</Badge>
                <span className="min-w-0 truncate text-sm font-semibold text-content">
                  {identity.scopeLabel}
                </span>
                {data.project_id ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => navigate("projects", { projectId: data.project_id ?? undefined })}
                  >
                    {identity.projectLabel || "Open project"}
                  </Button>
                ) : null}
              </div>
              <p className="text-xs text-content-muted">Snapshot generated {identity.generatedLabel}.</p>
            </div>

            <CountGrid rows={counts} />

            <RecentAssets rows={recentAssets} onOpen={openAsset} />

            <p className="text-2xs text-content-subtle">{summary}.</p>
          </div>
        )}
      </div>
    </Card>
  );
}
