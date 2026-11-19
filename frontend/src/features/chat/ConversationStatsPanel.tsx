import { useConversationStats } from "../../hooks/useQueries";
import { errorMessage } from "../../lib/errors";
import type { ConversationStats } from "../../lib/types";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card, SectionHeader } from "../../ui/Card";
import { EmptyState, Skeleton } from "../../ui/Feedback";
import { ProgressBar } from "../../ui/ProgressBar";
import {
  conversationRoleRows,
  conversationStatsCards,
  conversationStatsGeneratedAtLabel,
  conversationStatusRows,
  hasConversationStatsData,
  type ConversationRoleRow,
  type ConversationStatusRow,
} from "./conversationStatsHelpers";

function StatGrid({ stats }: { readonly stats: ConversationStats }) {
  const cards = conversationStatsCards(stats);
  return (
    <section
      aria-label="Conversation totals"
      className="grid grid-cols-2 gap-3 md:grid-cols-4"
    >
      {cards.map((card) => (
        <div key={card.key} className="rounded-md border border-line bg-surface-raised p-3">
          <p className="text-2xs font-semibold uppercase tracking-wider text-content-subtle">
            {card.label}
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-content">{card.value}</p>
          <p className="mt-0.5 text-2xs text-content-muted">{card.hint}</p>
        </div>
      ))}
    </section>
  );
}

function RoleRows({ rows }: { readonly rows: readonly ConversationRoleRow[] }) {
  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.role} className="flex items-center gap-3">
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
  );
}

function StatusRows({ rows }: { readonly rows: readonly ConversationStatusRow[] }) {
  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.status} className="flex items-center gap-3">
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
  );
}

function ConversationStatsContent({ stats }: { readonly stats: ConversationStats }) {
  const generatedAt = conversationStatsGeneratedAtLabel(stats);
  return (
    <div className="space-y-6">
      <StatGrid stats={stats} />
      {!hasConversationStatsData(stats) ? (
        <EmptyState
          title="No conversations yet"
          description="Messages exchanged in this scope will populate these metrics."
        />
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <section aria-label="Messages by role" className="rounded-md border border-line p-4">
              <h3 className="mb-3 text-sm font-medium text-content">Messages by role</h3>
              <RoleRows rows={conversationRoleRows(stats)} />
            </section>
            <section
              aria-label="Messages by delivery status"
              className="rounded-md border border-line p-4"
            >
              <h3 className="mb-3 text-sm font-medium text-content">Messages by status</h3>
              <StatusRows rows={conversationStatusRows(stats)} />
            </section>
          </div>
          {generatedAt ? (
            <p className="text-2xs text-content-subtle">Metrics generated {generatedAt}.</p>
          ) : null}
        </>
      )}
    </div>
  );
}

export interface ConversationStatsPanelProps {
  /** Optional project scope; omitted renders the workspace-wide snapshot. */
  readonly projectId?: string;
  readonly title?: string;
  readonly description?: string;
}

/**
 * Authoritative conversation/message metrics from the `useConversationStats`
 * query hook. Renders explicit loading, error, missing-data, empty and
 * populated states; every display value comes from `conversationStatsHelpers`
 * so JSX stays free of inline derivation and mock/live transports render
 * identically.
 */
export function ConversationStatsPanel({
  projectId,
  title = "Conversation stats",
  description = "Authoritative message metrics derived from the conversation store.",
}: ConversationStatsPanelProps) {
  const { data, isPending, isError, error, refetch } = useConversationStats(
    projectId ? { projectId } : undefined,
  );

  return (
    <Card>
      <div className="p-4">
        <SectionHeader title={title} description={description} />
      </div>
      <div className="border-t border-line p-4">
        {isPending ? (
          <div className="space-y-6" aria-busy="true" aria-label="Loading conversation statistics">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} className="h-20" />
              ))}
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <Skeleton className="h-40" />
              <Skeleton className="h-40" />
            </div>
          </div>
        ) : isError ? (
          <EmptyState
            title="Could not load conversation statistics"
            description={errorMessage(error)}
            action={
              <Button variant="primary" size="sm" onClick={() => void refetch()}>
                Try again
              </Button>
            }
          />
        ) : !data ? (
          <EmptyState
            title="Statistics unavailable"
            description="Conversation metrics are not available right now."
          />
        ) : (
          <ConversationStatsContent stats={data} />
        )}
      </div>
    </Card>
  );
}
