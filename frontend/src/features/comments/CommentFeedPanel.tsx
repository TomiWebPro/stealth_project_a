import { useState } from "react";
import { useCommentFeed } from "../../hooks/useQueries";
import { errorMessage } from "../../lib/errors";
import { useUiStore } from "../../stores/uiStore";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card, SectionHeader } from "../../ui/Card";
import { EmptyState, Skeleton } from "../../ui/Feedback";
import {
  COMMENT_FEED_LIMITS,
  buildCommentFeedOptions,
  commentFeedEmptyDescription,
  commentFeedGeneratedAtLabel,
  commentFeedRows,
  commentFeedSummary,
  type CommentFeedRow,
} from "./commentFeedHelpers";

function CommentRow({
  row,
  onOpen,
  onOpenAsset,
}: {
  readonly row: CommentFeedRow;
  readonly onOpen: (row: CommentFeedRow) => void;
  readonly onOpenAsset: (row: CommentFeedRow) => void;
}) {
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <Badge tone={row.authorTone}>{row.authorLabel}</Badge>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-content" title={row.body}>
          {row.bodyPreview}
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

export interface CommentFeedPanelProps {
  /** Optional project scope; omitted renders the workspace-wide feed. */
  readonly projectId?: string;
  readonly title?: string;
  readonly description?: string;
}

/**
 * Authoritative comment feed (C149/C151/C152 follow-up), backed by the
 * `useCommentFeed` query hook so the same view works in mock and live mode.
 * Renders explicit loading, error, missing-data, empty and populated states;
 * every display value is derived in `commentFeedHelpers`. Rows deep-link to the
 * existing project-detail screen, and comments that reference an asset also link
 * to the asset detail panel (scoping the assets browser to the row's project so
 * the selection is always resolvable). No new route is added.
 */
export function CommentFeedPanel({
  projectId,
  title = "Comments",
  description = "Newest-first collaboration comments derived from the authoritative comment store.",
}: CommentFeedPanelProps) {
  const [limit, setLimit] = useState(25);
  const navigate = useUiStore((s) => s.navigate);
  const setAssetsProjectId = useUiStore((s) => s.setAssetsProjectId);

  const { data, isPending, isError, error, refetch } = useCommentFeed(
    buildCommentFeedOptions(projectId, limit),
  );
  const rows = commentFeedRows(data);
  const summary = commentFeedSummary(rows, data?.total);
  const generatedAt = commentFeedGeneratedAtLabel(data);

  const openAsset = (row: CommentFeedRow) => {
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
          aria-label="Comments to show"
        >
          <span className="text-2xs text-content-subtle">Show</span>
          {COMMENT_FEED_LIMITS.map((value) => (
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
          <div className="space-y-3 p-4" aria-busy="true" aria-label="Loading comments">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : isError ? (
          <div className="p-4">
            <EmptyState
              title="Could not load comments"
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
              title="Comment feed unavailable"
              description="No comment feed could be resolved right now."
            />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No comments yet"
              description={commentFeedEmptyDescription(Boolean(projectId))}
            />
          </div>
        ) : (
          <>
            <ol className="divide-y divide-line">
              {rows.map((row) => (
                <CommentRow
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
