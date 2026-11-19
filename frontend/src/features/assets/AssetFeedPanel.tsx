import { useState } from "react";
import { useAssetFeed } from "../../hooks/useQueries";
import { errorMessage } from "../../lib/errors";
import { useUiStore } from "../../stores/uiStore";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card, SectionHeader } from "../../ui/Card";
import { EmptyState, Skeleton } from "../../ui/Feedback";
import {
  ASSET_FEED_LIMITS,
  assetFeedEmptyDescription,
  assetFeedGeneratedAtLabel,
  assetFeedRows,
  assetFeedSummary,
  buildAssetFeedOptions,
  type AssetFeedRow,
} from "./assetFeedHelpers";

function AssetRow({
  row,
  onOpen,
}: {
  readonly row: AssetFeedRow;
  readonly onOpen: (row: AssetFeedRow) => void;
}) {
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <Badge tone={row.typeTone}>{row.typeLabel}</Badge>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-content" title={row.assetName}>
          {row.assetName}
        </p>
        <p className="truncate text-xs text-content-muted" title={row.projectName}>
          {row.projectName} · <span className="tabular-nums">{row.versionLabel}</span> ·{" "}
          <span className="tabular-nums">{row.sizeLabel}</span>
        </p>
      </div>
      <div className="shrink-0 text-right">
        <time className="block text-2xs text-content-subtle" dateTime={row.timestamp}>
          {row.relativeTime}
        </time>
        <div className="mt-1 flex items-center justify-end gap-2">
          <Badge tone={row.statusTone}>{row.statusLabel}</Badge>
          <Button variant="secondary" size="sm" onClick={() => onOpen(row)}>
            Open
          </Button>
        </div>
      </div>
    </li>
  );
}

export interface AssetFeedPanelProps {
  /** Optional project scope; omitted renders the workspace-wide feed. */
  readonly projectId?: string;
  readonly title?: string;
  readonly description?: string;
}

/**
 * Authoritative asset feed (C137/C139/C140 follow-up), backed by the
 * `useAssetFeed` query hook so the same view works in mock and live mode.
 * Renders explicit loading, error, missing-data, empty and populated states;
 * every display value is derived in `assetFeedHelpers`. Rows deep-link to the
 * asset detail panel, scoping the assets browser to the row's project first so
 * the selected asset is always resolvable.
 */
export function AssetFeedPanel({
  projectId,
  title = "Assets",
  description = "Newest-first live assets derived from the authoritative asset store.",
}: AssetFeedPanelProps) {
  const [limit, setLimit] = useState(25);
  const navigate = useUiStore((s) => s.navigate);
  const setAssetsProjectId = useUiStore((s) => s.setAssetsProjectId);

  const { data, isPending, isError, error, refetch } = useAssetFeed(
    buildAssetFeedOptions(projectId, limit),
  );
  const rows = assetFeedRows(data);
  const summary = assetFeedSummary(rows, data?.total);
  const generatedAt = assetFeedGeneratedAtLabel(data);

  const openAsset = (row: AssetFeedRow) => {
    setAssetsProjectId(row.projectId);
    navigate("assets", { assetId: row.assetId });
  };

  return (
    <Card>
      <div className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <SectionHeader title={title} description={rows.length === 0 ? description : summary} />
          <Button variant="secondary" size="sm" onClick={() => void refetch()}>
            Refresh
          </Button>
        </div>
        <div
          className="mt-3 flex flex-wrap items-center gap-2"
          role="group"
          aria-label="Asset rows to show"
        >
          <span className="text-2xs text-content-subtle">Show</span>
          {ASSET_FEED_LIMITS.map((value) => (
            <Button
              key={value}
              variant={limit === value ? "primary" : "secondary"}
              size="sm"
              aria-pressed={limit === value}
              onClick={() => setLimit(value)}
            >
              {value}
            </Button>
          ))}
        </div>
      </div>

      <div className="border-t border-line">
        {isPending ? (
          <div className="space-y-3 p-4" aria-busy="true" aria-label="Loading assets">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : isError ? (
          <div className="p-4">
            <EmptyState
              title="Could not load assets"
              description={errorMessage(error)}
              action={
                <Button variant="primary" size="sm" onClick={() => void refetch()}>
                  Try again
                </Button>
              }
            />
          </div>
        ) : !data ? (
          <div className="p-4">
            <EmptyState
              title="Asset feed unavailable"
              description="No asset feed could be resolved right now."
            />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No assets yet"
              description={assetFeedEmptyDescription(Boolean(projectId))}
            />
          </div>
        ) : (
          <>
            <ol className="divide-y divide-line">
              {rows.map((row) => (
                <AssetRow key={row.id} row={row} onOpen={openAsset} />
              ))}
            </ol>
            {generatedAt ? (
              <p className="border-t border-line px-4 py-2 text-2xs text-content-subtle">
                Feed generated {generatedAt}.
              </p>
            ) : null}
          </>
        )}
      </div>
    </Card>
  );
}
