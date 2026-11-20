import { useState } from "react";
import { useMessageOverview, useMessages } from "../../hooks/useQueries";
import { errorMessage } from "../../lib/errors";
import { useUiStore } from "../../stores/uiStore";
import { Badge, type BadgeTone } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card, SectionHeader } from "../../ui/Card";
import { EmptyState, Skeleton } from "../../ui/Feedback";
import { ProgressBar } from "../../ui/ProgressBar";
import {
  MESSAGE_OVERVIEW_LIMITS,
  buildMessageOverviewOptions,
  hasMessageOverviewData,
  messageOverviewActiveOption,
  messageOverviewEmptyDescription,
  messageOverviewGeneratedAtLabel,
  messageOverviewIdentity,
  messageOverviewPickerOptions,
  messageOverviewRecentSiblings,
  messageOverviewRoleRows,
  messageOverviewStatRows,
  messageOverviewStatusRows,
  messageOverviewSummaryLabel,
  type MessageOverviewSibling,
} from "./messageOverviewHelpers";

function StatGrid({ rows }: { readonly rows: ReturnType<typeof messageOverviewStatRows> }) {
  return (
    <section aria-label="Message snapshot" className="grid grid-cols-2 gap-3 md:grid-cols-4">
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

function RecentSiblings({ rows }: { readonly rows: readonly MessageOverviewSibling[] }) {
  return (
    <section aria-label="Recent messages in this conversation" className="rounded-md border border-line p-4">
      <h3 className="mb-3 text-sm font-medium text-content">Newest messages in this conversation</h3>
      {rows.length === 0 ? (
        <p className="text-xs text-content-muted">No sibling messages for this snapshot yet.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li
              key={row.id}
              className={`flex items-start gap-3 rounded-sm px-1 py-0.5 ${row.isCurrent ? "bg-accent-muted" : ""}`}
              aria-current={row.isCurrent ? "true" : undefined}
            >
              <Badge tone={row.roleTone}>{row.roleLabel}</Badge>
              <span className="shrink-0 text-2xs text-content-subtle">{row.statusLabel}</span>
              <span className="min-w-0 flex-1 truncate text-xs text-content" title={row.contentPreview}>
                {row.contentPreview}
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

export interface MessageOverviewPanelProps {
  /** Authoritative conversation whose messages feed the picker. */
  readonly conversationId: string;
  readonly title?: string;
  readonly description?: string;
}

/**
 * Authoritative single-message overview (C270/C272/C273 follow-up), backed by
 * the `useMessageOverview` query hook so the same view works in mock and live
 * mode. The picker is fed by the authoritative `useMessages` query for the
 * selected conversation. Renders explicit loading, error, missing-data, empty
 * and populated states; every display value is derived in
 * `messageOverviewHelpers`. The project link deep-links to the existing
 * project-detail screen; message rows stay read-only because their content is
 * already rendered in the thread on this screen.
 */
export function MessageOverviewPanel({
  conversationId,
  title = "Message overview",
  description = "Select a message to inspect its identity, 1-based position, whole-conversation counts and newest siblings.",
}: MessageOverviewPanelProps) {
  const navigate = useUiStore((state) => state.navigate);
  const [selectedValue, setSelectedValue] = useState("");
  const [recentLimit, setRecentLimit] = useState(5);

  const {
    data: messages,
    isPending: messagesPending,
    isError: messagesError,
    error: messagesErr,
    refetch: refetchMessages,
  } = useMessages(conversationId);

  const options = messageOverviewPickerOptions(messages);
  // Fall back to the first message when the current selection disappears (e.g.
  // the conversation changed) without an effect fighting the query cache.
  const active = messageOverviewActiveOption(options, selectedValue);

  const { data, isPending, isError, error, refetch } = useMessageOverview(
    conversationId,
    active?.messageId ?? "",
    buildMessageOverviewOptions(recentLimit),
  );

  const identity = messageOverviewIdentity(data);
  const stats = messageOverviewStatRows(data);
  const roles = messageOverviewRoleRows(data);
  const statuses = messageOverviewStatusRows(data);
  const siblings = messageOverviewRecentSiblings(data);
  const generatedAt = messageOverviewGeneratedAtLabel(data);
  const summary = messageOverviewSummaryLabel(data);

  const picker = (
    <label className="flex items-center gap-2 text-xs text-content-muted">
      <span>Message</span>
      <select
        aria-label="Select a message to inspect"
        className="h-8 max-w-96 rounded-md border border-line-strong bg-surface-raised px-2 text-xs text-content"
        value={active?.value ?? ""}
        onChange={(event) => setSelectedValue(event.target.value)}
        disabled={options.length === 0}
      >
        {options.length === 0 ? <option value="">No messages</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <Card>
      <div className="p-4">
        <SectionHeader title={title} description={description} action={picker} />
        <div
          className="mt-3 flex flex-wrap items-center gap-2"
          role="group"
          aria-label="Sibling messages shown"
        >
          <span className="text-2xs text-content-subtle">Siblings</span>
          {MESSAGE_OVERVIEW_LIMITS.map((value) => (
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
        {messagesPending ? (
          <div className="space-y-6" aria-busy="true" aria-label="Loading messages">
            <Skeleton className="h-8 w-1/2" />
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} className="h-20" />
              ))}
            </div>
            <Skeleton className="h-40" />
          </div>
        ) : messagesError ? (
          <EmptyState
            title="Could not load messages"
            description={errorMessage(messagesErr)}
            action={
              <Button variant="primary" size="sm" onClick={() => void refetchMessages()}>
                Try again
              </Button>
            }
          />
        ) : options.length === 0 ? (
          <EmptyState
            title="No messages to inspect"
            description={messageOverviewEmptyDescription(Boolean(conversationId))}
          />
        ) : isPending ? (
          <div className="space-y-6" aria-busy="true" aria-label="Loading message overview">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} className="h-20" />
              ))}
            </div>
            <Skeleton className="h-40" />
          </div>
        ) : isError ? (
          <EmptyState
            title="Could not load message overview"
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
            description="The authoritative snapshot for this message is not available right now."
          />
        ) : !hasMessageOverviewData(data) ? (
          <EmptyState
            title="No recorded message activity"
            description="This conversation has no messages to summarize yet."
          />
        ) : (
          <div className="space-y-6">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={identity.roleTone}>{identity.roleLabel}</Badge>
                <Badge tone={identity.statusTone}>{identity.statusLabel}</Badge>
                <span className="text-2xs text-content-subtle">{identity.positionLabel}</span>
                <span className="min-w-0 truncate text-sm font-semibold text-content" title={identity.conversationTitle}>
                  {identity.conversationTitle}
                </span>
                {identity.messageLabel ? (
                  <span className="text-2xs text-content-subtle">{identity.messageLabel}</span>
                ) : null}
                {identity.attachmentLabel ? (
                  <Badge tone="accent">{identity.attachmentLabel}</Badge>
                ) : null}
              </div>
              <p className="text-sm text-content" title={identity.contentPreview}>
                {identity.contentPreview}
              </p>
              <div className="flex flex-wrap items-center gap-2 text-xs text-content-muted">
                {identity.createdLabel ? <span>Sent {identity.createdLabel}</span> : null}
                {identity.operationLabel ? <span>{identity.operationLabel}</span> : null}
              </div>
              {identity.projectLabel ? (
                <div className="pt-1">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => navigate("projects", { projectId: data.project_id })}
                  >
                    Open project
                  </Button>
                </div>
              ) : null}
            </div>

            <StatGrid rows={stats} />

            <div className="grid gap-4 md:grid-cols-2">
              <DistributionRows title="Messages by role" rows={roles} keyFor={(row) => row.role} />
              <DistributionRows title="Messages by status" rows={statuses} keyFor={(row) => row.status} />
            </div>

            <RecentSiblings rows={siblings} />

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
