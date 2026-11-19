import { useState } from "react";
import { useLineageFeed } from "../../hooks/useQueries";
import { errorMessage } from "../../lib/errors";
import { useUiStore } from "../../stores/uiStore";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card, SectionHeader } from "../../ui/Card";
import { EmptyState, Skeleton } from "../../ui/Feedback";
import {
  LINEAGE_FEED_LIMITS,
  buildLineageFeedOptions,
  lineageFeedEmptyDescription,
  lineageFeedGeneratedAtLabel,
  lineageFeedRows,
  lineageFeedSummary,
  type LineageFeedRow,
} from "./lineageFeedHelpers";

function LineageRow({
  row,
  onOpenSource,
  onOpenTarget,
}: {
  readonly row: LineageFeedRow;
  readonly onOpenSource: (row: LineageFeedRow) => void;
  readonly onOpenTarget: (row: LineageFeedRow) => void;
}) {
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <div className="shrink-0">
        <Badge tone={row.typeTone}>{row.typeLabel}</Badge>
      </div>
      <div className="min-w-0 flex-1">
        <p
          className="truncate text-sm font-medium text-content"
          title={`${row.fromAssetName} → ${row.toAssetName}`}
        >
          {row.fromAssetName} <span aria-hidden="true">→</span> {row.toAssetName}
        </p>
        <p className="mt-1 truncate text-xs text-content-muted" title={row.projectName}>
          {row.projectName}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <time className="block text-2xs text-content-subtle" dateTime={row.timestamp}>
          {row.relativeTime}
        </time>
        <div className="mt-1 flex items-center justify-end gap-2">
          {row.hasTarget ? (
            <Button variant="secondary" size="sm" onClick={() => onOpenTarget(row)}>
              Target
            </Button>
          ) : null}
          <Button variant="secondary" size="sm" onClick={() => onOpenSource(row)}>
            Source
          </Button>
        </div>
      </div>
    </li>
  );
}

export interface LineageFeedPanelProps {
  /** Optional project scope; omitted renders the workspace-wide feed. */
  readonly projectId?: string;
  readonly title?: string;
  readonly description?: string;
}

/**
 * Authoritative asset lineage feed (C157/C159/C160 follow-up), backed by the
 * `useLineageFeed` query hook so the same view works in mock and live mode.
 * Renders explicit loading, error, missing-data, empty and populated states;
 * every display value is derived in `lineageFeedHelpers`. Rows deep-link to the
 * existing assets browser, scoping it to the row's project first so the selected
 * source/target asset is always resolvable. Links whose target was removed only
 * offer a source link. No new route is added.
 */
export function LineageFeedPanel({
  projectId,
  title = "Asset lineage",
  description = "Newest-first typed asset relationships derived from the authoritative lineage store.",
}: LineageFeedPanelProps) {
  const [limit, setLimit] = useState(25);
  const navigate = useUiStore((s) => s.navigate);
  const setAssetsProjectId = useUiStore((s) => s.setAssetsProjectId);

  const { data, isPending, isError, error, refetch } = useLineageFeed(
    buildLineageFeedOptions(projectId, limit),
  );
  const rows = lineageFeedRows(data);
  const summary = lineageFeedSummary(rows, data?.total);
  const generatedAt = lineageFeedGeneratedAtLabel(data);

  const openAsset = (assetId: string, projectScope: string) => {
    setAssetsProjectId(projectScope);
    navigate("assets", { assetId });
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
          aria-label="Relationships to show"
        >
          <span className="text-2xs text-content-subtle">Show</span>
          {LINEAGE_FEED_LIMITS.map((value) => (
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
          <div className="space-y-3 p-4" aria-busy="true" aria-label="Loading asset lineage">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : isError ? (
          <div className="p-4">
            <EmptyState
              title="Could not load asset lineage"
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
              title="Lineage feed unavailable"
              description="No lineage feed could be resolved right now."
            />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No asset relationships yet"
              description={lineageFeedEmptyDescription(Boolean(projectId))}
            />
          </div>
        ) : (
          <>
            <ol className="divide-y divide-line">
              {rows.map((row) => (
                <LineageRow
                  key={row.id}
                  row={row}
                  onOpenSource={(target) => openAsset(target.fromAssetId, target.projectId)}
                  onOpenTarget={(target) => openAsset(target.toAssetId, target.projectId)}
                />
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
