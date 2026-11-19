import { useState } from "react";
import { useConversationFeed } from "../../hooks/useQueries";
import { errorMessage } from "../../lib/errors";
import { useUiStore } from "../../stores/uiStore";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card, SectionHeader } from "../../ui/Card";
import { EmptyState, Skeleton } from "../../ui/Feedback";
import {
  CONVERSATION_FEED_LIMITS,
  buildConversationFeedOptions,
  conversationFeedEmptyDescription,
  conversationFeedGeneratedAtLabel,
  conversationFeedRows,
  conversationFeedSummary,
  type ConversationFeedRow,
} from "./conversationFeedHelpers";

function ConversationRow({
  row,
  onOpen,
}: {
  readonly row: ConversationFeedRow;
  readonly onOpen: (row: ConversationFeedRow) => void;
}) {
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <Badge tone={row.roleTone}>{row.roleLabel}</Badge>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-content" title={row.title}>
          {row.title}
        </p>
        <p className="truncate text-xs text-content-muted" title={row.projectName}>
          {row.projectName} · <span className="tabular-nums">{row.messageLabel}</span>
        </p>
        <p className={`mt-1 truncate text-xs ${row.hasPreview ? "text-content-muted" : "text-content-subtle italic"}`}>
          {row.excerpt}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <time className="block text-2xs text-content-subtle" dateTime={row.timestamp}>
          {row.relativeTime}
        </time>
        <Button variant="secondary" size="sm" onClick={() => onOpen(row)}>
          Open
        </Button>
      </div>
    </li>
  );
}

export interface ConversationFeedPanelProps {
  /** Optional project scope; omitted renders the workspace-wide feed. */
  readonly projectId?: string;
  readonly title?: string;
  readonly description?: string;
}

/**
 * Authoritative conversation feed (C133/C135/C136 follow-up), backed by the
 * `useConversationFeed` query hook so the same view works in mock and live mode.
 * Renders explicit loading, error, missing-data, empty and populated states;
 * every display value is derived in `conversationFeedHelpers`. Rows deep-link to
 * the existing chat route with the selected conversation, adding no new route.
 */
export function ConversationFeedPanel({
  projectId,
  title = "Conversations",
  description = "Newest-first conversations derived from the authoritative conversation store.",
}: ConversationFeedPanelProps) {
  const [limit, setLimit] = useState(25);
  const navigate = useUiStore((s) => s.navigate);

  const { data, isPending, isError, error, refetch } = useConversationFeed(
    buildConversationFeedOptions(projectId, limit),
  );
  const rows = conversationFeedRows(data);
  const summary = conversationFeedSummary(rows, data?.total);
  const generatedAt = conversationFeedGeneratedAtLabel(data);

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
          aria-label="Conversations to show"
        >
          <span className="text-2xs text-content-subtle">Show</span>
          {CONVERSATION_FEED_LIMITS.map((value) => (
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
          <div className="space-y-3 p-4" aria-busy="true" aria-label="Loading conversations">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : isError ? (
          <div className="p-4">
            <EmptyState
              title="Could not load conversations"
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
              title="Conversation feed unavailable"
              description="No conversation feed could be resolved right now."
            />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No conversations yet"
              description={conversationFeedEmptyDescription(Boolean(projectId))}
            />
          </div>
        ) : (
          <>
            <ol className="divide-y divide-line">
              {rows.map((row) => (
                <ConversationRow
                  key={row.id}
                  row={row}
                  onOpen={(target) => navigate("chat", { conversationId: target.conversationId })}
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
