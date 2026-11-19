import { useConversationOverview } from "../../hooks/useQueries";
import { errorMessage } from "../../lib/errors";
import { useUiStore } from "../../stores/uiStore";
import { Badge, type BadgeTone } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card, SectionHeader } from "../../ui/Card";
import { EmptyState, Skeleton } from "../../ui/Feedback";
import { ProgressBar } from "../../ui/ProgressBar";
import {
  conversationOverviewGeneratedAtLabel,
  conversationOverviewIdentity,
  conversationOverviewRecentMessages,
  conversationOverviewRoleRows,
  conversationOverviewStatRows,
  conversationOverviewStatusRows,
  conversationOverviewSummaryLabel,
  hasConversationOverviewData,
  type ConversationOverviewRecentMessage,
} from "./conversationOverviewHelpers";

function StatGrid({
  rows,
}: {
  readonly rows: ReturnType<typeof conversationOverviewStatRows>;
}) {
  return (
    <section aria-label="Conversation snapshot" className="grid grid-cols-2 gap-3 md:grid-cols-3">
      {rows.map((row) => (
        <div key={row.key} className="rounded-md border border-line bg-surface-raised p-3">
          <p className="text-2xs font-semibold uppercase tracking-wider text-content-subtle">
            {row.label}
          </p>
          <p className="mt-1 truncate text-xl font-semibold tabular-nums text-content" title={row.value}>
            {row.value}
          </p>
          <p className="mt-0.5 text-2xs text-content-muted">{row.hint}</p>
        </div>
      ))}
    </section>
  );
}

function DistributionRows<
  T extends {
    label: string;
    tone: BadgeTone;
    fraction: number;
    count: number;
    percent: number;
  },
>({
  title,
  rows,
  keyFor,
}: {
  readonly title: string;
  readonly rows: readonly T[];
  readonly keyFor: (row: T) => string;
}) {
  return (
    <section aria-label={title} className="rounded-md border border-line p-4">
      <h3 className="mb-3 text-sm font-medium text-content">{title}</h3>
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={keyFor(row)} className="flex items-center gap-3">
            <span className="w-20 shrink-0">
              <Badge tone={row.tone}>{row.label}</Badge>
            </span>
            <ProgressBar value={row.fraction} label={`${row.label} share`} className="flex-1" />
            <span className="w-8 shrink-0 text-right text-xs tabular-nums text-content">
              {row.count}
            </span>
            <span className="w-9 shrink-0 text-right text-2xs tabular-nums text-content-subtle">
              {row.percent}%
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function RecentMessages({
  rows,
}: {
  readonly rows: readonly ConversationOverviewRecentMessage[];
}) {
  return (
    <section aria-label="Recent messages" className="rounded-md border border-line p-4">
      <h3 className="mb-3 text-sm font-medium text-content">Recent messages</h3>
      {rows.length === 0 ? (
        <p className="text-xs text-content-muted">No messages in this conversation yet.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.id} className="flex items-start gap-3">
              <Badge tone={row.roleTone}>{row.roleLabel}</Badge>
              <span className="shrink-0 text-2xs text-content-subtle">{row.statusLabel}</span>
              <span className="min-w-0 flex-1 truncate text-xs text-content" title={row.content}>
                {row.content}
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

export interface ConversationOverviewPanelProps {
  readonly conversationId: string;
  readonly title?: string;
  readonly description?: string;
}

/**
 * Authoritative single-conversation overview (C209/C211/C212 follow-up), backed
 * by the `useConversationOverview` query hook so the same view works in mock and
 * live mode. Renders explicit loading, error, missing-data, empty and populated
 * states; every display value is derived in `conversationOverviewHelpers`.
 * The project link deep-links to the existing project-detail screen; message
 * rows stay read-only because message content is rendered in the thread below.
 */
export function ConversationOverviewPanel({
  conversationId,
  title = "Conversation overview snapshot",
  description = "Compact authoritative snapshot: message counts, role/status breakdown and the newest messages.",
}: ConversationOverviewPanelProps) {
  const navigate = useUiStore((state) => state.navigate);
  const { data, isPending, isError, error, refetch } = useConversationOverview(conversationId);
  const identity = conversationOverviewIdentity(data);
  const stats = conversationOverviewStatRows(data);
  const roles = conversationOverviewRoleRows(data);
  const statuses = conversationOverviewStatusRows(data);
  const recent = conversationOverviewRecentMessages(data);
  const generatedAt = conversationOverviewGeneratedAtLabel(data);
  const summary = conversationOverviewSummaryLabel(data);

  return (
    <Card>
      <div className="p-4">
        <SectionHeader title={title} description={description} />
      </div>
      <div className="border-t border-line p-4">
        {isPending ? (
          <div className="space-y-6" aria-busy="true" aria-label="Loading conversation overview">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {Array.from({ length: 3 }, (_, index) => (
                <Skeleton key={index} className="h-20" />
              ))}
            </div>
            <Skeleton className="h-40" />
          </div>
        ) : isError ? (
          <EmptyState
            title="Could not load conversation overview"
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
            description="The authoritative snapshot for this conversation is not available right now."
          />
        ) : !hasConversationOverviewData(data) ? (
          <EmptyState
            title="No messages yet"
            description="This conversation has no messages to summarize."
          />
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 truncate text-sm font-semibold text-content" title={identity.title}>
                {identity.title}
              </span>
              <Badge tone={identity.roleTone}>{identity.roleLabel}</Badge>
              <span className="text-2xs text-content-subtle">{identity.messageLabel}</span>
              {identity.projectLabel ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => navigate("projects", { projectId: data.project_id })}
                >
                  {identity.projectLabel}
                </Button>
              ) : null}
              {identity.updatedLabel ? (
                <span className="text-2xs text-content-muted">Updated {identity.updatedLabel}</span>
              ) : null}
            </div>
            {identity.hasPreview ? (
              <p className="truncate text-xs text-content-muted" title={identity.excerpt}>
                Last message: {identity.excerpt}
              </p>
            ) : null}
            <StatGrid rows={stats} />
            <div className="grid gap-4 md:grid-cols-2">
              <DistributionRows title="Messages by role" rows={roles} keyFor={(row) => row.role} />
              <DistributionRows title="Messages by status" rows={statuses} keyFor={(row) => row.status} />
            </div>
            <RecentMessages rows={recent} />
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
