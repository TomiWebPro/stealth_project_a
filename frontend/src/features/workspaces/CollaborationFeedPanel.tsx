import { useState } from "react";
import { useCollaborationFeed } from "../../hooks/useQueries";
import { errorMessage } from "../../lib/errors";
import type { CollaborationSignal } from "../../lib/types";
import { useUiStore } from "../../stores/uiStore";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card, SectionHeader } from "../../ui/Card";
import { EmptyState, Skeleton } from "../../ui/Feedback";
import {
  COLLABORATION_FEED_LIMITS,
  COLLABORATION_FEED_SIGNAL_FILTERS,
  buildCollaborationFeedOptions,
  collaborationFeedEmptyDescription,
  collaborationFeedGeneratedAtLabel,
  collaborationFeedRows,
  collaborationFeedSummary,
  collaborationSignalChipLabel,
  type CollaborationFeedRow,
} from "./collaborationFeedHelpers";

function SignalRow({
  row,
  onOpen,
  onOpenAsset,
}: {
  readonly row: CollaborationFeedRow;
  readonly onOpen: (row: CollaborationFeedRow) => void;
  readonly onOpenAsset: (row: CollaborationFeedRow) => void;
}) {
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <Badge tone={row.signalTone}>{row.signalLabel}</Badge>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-content">
          {row.hasState ? (
            <>
              {row.actorLabel} is <Badge tone={row.stateTone}>{row.stateLabel}</Badge>
            </>
          ) : (
            <span title={row.body}>{row.bodyPreview}</span>
          )}
        </p>
        <p className="mt-1 truncate text-xs text-content-muted" title={row.projectName}>
          {row.projectName}
          {row.hasAsset ? (
            <>
              {" · "}
              <Badge tone="accent">{row.assetLabel}</Badge>
            </>
          ) : null}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <time className="block text-2xs text-content-subtle" dateTime={row.timestamp}>
          {row.relativeTime}
        </time>
        <div className="mt-1 flex items-center justify-end gap-2">
          {row.hasAsset ? (
            <Button variant="secondary" size="sm" onClick={() => onOpenAsset(row)}>
              Asset
            </Button>
          ) : null}
          <Button variant="secondary" size="sm" onClick={() => onOpen(row)}>
            Open
          </Button>
        </div>
      </div>
    </li>
  );
}

export interface CollaborationFeedPanelProps {
  /** Optional project scope; omitted renders the workspace-wide feed. */
  readonly projectId?: string;
  readonly title?: string;
  readonly description?: string;
}

/**
 * Authoritative collaboration feed (C197/C199/C200 follow-up), backed by the
 * `useCollaborationFeed` query hook so the same view works in mock and live
 * mode. Renders explicit loading, error, missing-data, empty and populated
 * states; every display value is derived in `collaborationFeedHelpers`. Signal
 * kind and page-size filter chips narrow the newest-first feed, rows deep-link
 * to the existing project-detail screen and comment rows that reference an asset
 * also link to the asset detail panel (scoping the assets browser to the row's
 * project first so the selection is always resolvable). No new route is added.
 */
export function CollaborationFeedPanel({
  projectId,
  title = "Collaboration feed",
  description = "Newest-first presence and comment signals derived from the authoritative collaboration stores.",
}: CollaborationFeedPanelProps) {
  const [limit, setLimit] = useState(25);
  const [signal, setSignal] = useState<CollaborationSignal | undefined>(undefined);
  const navigate = useUiStore((s) => s.navigate);
  const setAssetsProjectId = useUiStore((s) => s.setAssetsProjectId);

  const { data, isPending, isError, error, refetch } = useCollaborationFeed(
    buildCollaborationFeedOptions(projectId, signal, limit),
  );
  const rows = collaborationFeedRows(data);
  const summary = collaborationFeedSummary(rows, data?.total);
  const generatedAt = collaborationFeedGeneratedAtLabel(data);

  const openAsset = (row: CollaborationFeedRow) => {
    if (!row.assetId) return;
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
          aria-label="Collaboration signal filter"
        >
          <span className="text-2xs text-content-subtle">Signal</span>
          {COLLABORATION_FEED_SIGNAL_FILTERS.map((value) => (
            <Button
              key={value ?? "all"}
              variant={signal === value ? "primary" : "secondary"}
              size="sm"
              aria-pressed={signal === value}
              onClick={() => setSignal(value)}
            >
              {collaborationSignalChipLabel(value)}
            </Button>
          ))}
        </div>
        <div
          className="mt-2 flex flex-wrap items-center gap-2"
          role="group"
          aria-label="Signals to show"
        >
          <span className="text-2xs text-content-subtle">Show</span>
          {COLLABORATION_FEED_LIMITS.map((value) => (
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
          <div className="space-y-3 p-4" aria-busy="true" aria-label="Loading collaboration signals">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : isError ? (
          <div className="p-4">
            <EmptyState
              title="Could not load collaboration signals"
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
              title="Collaboration feed unavailable"
              description="No collaboration feed could be resolved right now."
            />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No collaboration signals yet"
              description={collaborationFeedEmptyDescription(Boolean(projectId), Boolean(signal))}
            />
          </div>
        ) : (
          <>
            <ol className="divide-y divide-line">
              {rows.map((row) => (
                <SignalRow
                  key={row.id}
                  row={row}
                  onOpen={(target) => navigate("projects", { projectId: target.projectId })}
                  onOpenAsset={openAsset}
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
