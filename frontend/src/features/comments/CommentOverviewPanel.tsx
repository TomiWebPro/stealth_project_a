import { useState } from "react";
import { useCommentFeed, useCommentOverview } from "../../hooks/useQueries";
import { errorMessage } from "../../lib/errors";
import { useUiStore } from "../../stores/uiStore";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card, SectionHeader } from "../../ui/Card";
import { EmptyState, Skeleton } from "../../ui/Feedback";
import {
  COMMENT_FEED_LIMITS,
  buildCommentFeedOptions,
  commentFeedRows,
} from "./commentFeedHelpers";
import {
  buildCommentOverviewOptions,
  commentOverviewActiveOption,
  commentOverviewCountRows,
  commentOverviewEmptyDescription,
  commentOverviewGeneratedAtLabel,
  commentOverviewIdentity,
  commentOverviewPickerOptions,
  commentOverviewRecentComments,
  commentOverviewSummaryLabel,
  hasCommentOverviewData,
  type CommentOverviewCountRow,
  type CommentOverviewSiblingRow,
} from "./commentOverviewHelpers";

function CountGrid({ rows }: { readonly rows: readonly CommentOverviewCountRow[] }) {
  return (
    <section aria-label="Whole-project comment counts" className="grid grid-cols-2 gap-3">
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

function ThreadComments({ rows }: { readonly rows: readonly CommentOverviewSiblingRow[] }) {
  return (
    <section aria-label="Same-thread comments" className="rounded-md border border-line p-4">
      <h3 className="mb-3 text-sm font-medium text-content">Newest comments in this thread</h3>
      {rows.length === 0 ? (
        <p className="text-xs text-content-muted">No sibling comments in this thread yet.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.id} className="flex items-start gap-3">
              <Badge tone="info">{row.authorLabel}</Badge>
              {row.hasAsset ? <Badge tone="accent">{row.assetLabel}</Badge> : null}
              <span className="min-w-0 flex-1 truncate text-xs text-content-subtle" title={row.bodyPreview}>
                {row.bodyPreview}
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

export interface CommentOverviewPanelProps {
  /** Optional project scope; omitted offers comments across the workspace. */
  readonly projectId?: string;
  readonly title?: string;
  readonly description?: string;
}

/**
 * Authoritative single-comment overview (C254/C256/C257 follow-up), backed by
 * the `useCommentOverview` query hook so the same view works in mock and live
 * mode. The picker is populated from the authoritative `useCommentFeed` query,
 * optionally scoped to `projectId`. Renders explicit loading, error,
 * missing-data, empty and populated states; every display value is derived in
 * `commentOverviewHelpers`. Rows stay read-only (no comment-detail route); the
 * project and asset buttons deep-link to their existing screens.
 */
export function CommentOverviewPanel({
  projectId,
  title = "Comment overview",
  description = "Select a comment to inspect its identity, reference and whole-project comment activity.",
}: CommentOverviewPanelProps) {
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
  } = useCommentFeed(buildCommentFeedOptions(projectId, feedLimit));

  const options = commentOverviewPickerOptions(commentFeedRows(feedData));
  // Fall back to the first comment when the current selection disappears (e.g.
  // the feed changed) without an effect fighting the query cache.
  const active = commentOverviewActiveOption(options, selectedValue);

  const { data, isPending, isError, error, refetch } = useCommentOverview(
    active?.commentId ?? "",
    buildCommentOverviewOptions(),
  );

  const identity = commentOverviewIdentity(data);
  const counts = commentOverviewCountRows(data);
  const siblings = commentOverviewRecentComments(data);
  const generatedAt = commentOverviewGeneratedAtLabel(data);
  const summary = commentOverviewSummaryLabel(data);

  const picker = (
    <label className="flex items-center gap-2 text-xs text-content-muted">
      <span>Comment</span>
      <select
        aria-label="Select a comment to inspect"
        className="h-8 max-w-96 rounded-md border border-line-strong bg-surface-raised px-2 text-xs text-content"
        value={active?.value ?? ""}
        onChange={(event) => setSelectedValue(event.target.value)}
        disabled={options.length === 0}
      >
        {options.length === 0 ? <option value="">No comments</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );

  const openAsset = () => {
    if (!data?.asset_id) return;
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
          aria-label="Comments available in the picker"
        >
          <span className="text-2xs text-content-subtle">Picker feed</span>
          {COMMENT_FEED_LIMITS.map((value) => (
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
          <div className="space-y-6" aria-busy="true" aria-label="Loading comments">
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
            title="Could not load comments"
            description={errorMessage(feedErr)}
            action={
              <Button variant="primary" size="sm" onClick={() => void refetchFeed()}>
                Try again
              </Button>
            }
          />
        ) : options.length === 0 ? (
          <EmptyState
            title="No comments to inspect"
            description={commentOverviewEmptyDescription(Boolean(projectId))}
          />
        ) : isPending ? (
          <div className="space-y-6" aria-busy="true" aria-label="Loading comment overview">
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} className="h-20" />
              ))}
            </div>
            <Skeleton className="h-40" />
          </div>
        ) : isError ? (
          <EmptyState
            title="Could not load comment overview"
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
            description="The authoritative snapshot for this comment is not available right now."
          />
        ) : !hasCommentOverviewData(data) ? (
          <EmptyState
            title="No recorded comment activity"
            description="This comment has no sibling comments or whole-project activity yet."
          />
        ) : (
          <div className="space-y-6">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={identity.referenceTone}>{identity.referenceLabel}</Badge>
                <Badge tone="info">{identity.authorLabel}</Badge>
                {identity.hasAsset ? <Badge tone="accent">{identity.assetLabel}</Badge> : null}
                <span className="text-sm font-semibold text-content">{identity.projectLabel}</span>
              </div>
              <p className="text-sm text-content" title={identity.bodyPreview}>
                {identity.bodyPreview}
              </p>
              <p className="text-xs text-content-muted">Commented {identity.createdLabel || "—"}</p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => navigate("projects", { projectId: data.project_id })}
                >
                  Open project
                </Button>
                {identity.hasAsset ? (
                  <Button variant="secondary" size="sm" onClick={openAsset}>
                    Open asset
                  </Button>
                ) : null}
              </div>
            </div>

            <CountGrid rows={counts} />

            <ThreadComments rows={siblings} />

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
