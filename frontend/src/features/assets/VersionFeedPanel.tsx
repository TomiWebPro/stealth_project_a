import { useState } from "react";
import { useVersionFeed } from "../../hooks/useQueries";
import { errorMessage } from "../../lib/errors";
import { useUiStore } from "../../stores/uiStore";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card, SectionHeader } from "../../ui/Card";
import { EmptyState, Skeleton } from "../../ui/Feedback";
import {
  VERSION_FEED_LIMITS,
  buildVersionFeedOptions,
  versionFeedEmptyDescription,
  versionFeedGeneratedAtLabel,
  versionFeedRows,
  versionFeedSummary,
  type VersionFeedRow,
} from "./versionFeedHelpers";

function VersionRow({
  row,
  onOpen,
}: {
  readonly row: VersionFeedRow;
  readonly onOpen: (row: VersionFeedRow) => void;
}) {
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <div className="flex shrink-0 flex-col items-start gap-1">
        <Badge tone="info">{row.versionLabel}</Badge>
        <Badge tone={row.typeTone}>{row.assetType}</Badge>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-content" title={row.assetName}>
          {row.assetName}
        </p>
        <p className="mt-1 truncate text-xs text-content-muted" title={row.projectName}>
          {row.projectName} · <span title={row.creatorId}>{row.creatorLabel}</span>
        </p>
      </div>
      <div className="shrink-0 text-right">
        <time className="block text-2xs text-content-subtle" dateTime={row.timestamp}>
          {row.relativeTime}
        </time>
        <div className="mt-1">
          <Button variant="secondary" size="sm" onClick={() => onOpen(row)}>
            Open
          </Button>
        </div>
      </div>
    </li>
  );
}

export interface VersionFeedPanelProps {
  /** Optional project scope; omitted renders the workspace-wide feed. */
  readonly projectId?: string;
  readonly title?: string;
  readonly description?: string;
}

/**
 * Authoritative asset version feed (C153/C155/C156 follow-up), backed by the
 * `useVersionFeed` query hook so the same view works in mock and live mode.
 * Renders explicit loading, error, missing-data, empty and populated states;
 * every display value is derived in `versionFeedHelpers`. Rows deep-link to the
 * asset detail panel, scoping the assets browser to the row's project first so
 * the selected asset is always resolvable. No new route is added.
 */
export function VersionFeedPanel({
  projectId,
  title = "Asset versions",
  description = "Newest-first asset version records derived from the authoritative version store.",
}: VersionFeedPanelProps) {
  const [limit, setLimit] = useState(25);
  const navigate = useUiStore((s) => s.navigate);
  const setAssetsProjectId = useUiStore((s) => s.setAssetsProjectId);

  const { data, isPending, isError, error, refetch } = useVersionFeed(
    buildVersionFeedOptions(projectId, limit),
  );
  const rows = versionFeedRows(data);
  const summary = versionFeedSummary(rows, data?.total);
  const generatedAt = versionFeedGeneratedAtLabel(data);

  const openAsset = (row: VersionFeedRow) => {
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
          aria-label="Version rows to show"
        >
          <span className="text-2xs text-content-subtle">Show</span>
          {VERSION_FEED_LIMITS.map((value) => (
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
          <div className="space-y-3 p-4" aria-busy="true" aria-label="Loading asset versions">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : isError ? (
          <div className="p-4">
            <EmptyState
              title="Could not load asset versions"
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
              title="Version feed unavailable"
              description="No version feed could be resolved right now."
            />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No asset versions yet"
              description={versionFeedEmptyDescription(Boolean(projectId))}
            />
          </div>
        ) : (
          <>
            <ol className="divide-y divide-line">
              {rows.map((row) => (
                <VersionRow key={row.id} row={row} onOpen={openAsset} />
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
