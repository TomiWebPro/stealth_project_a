import { useState } from "react";
import { useProjectAudit } from "../../hooks/useQueries";
import { errorMessage } from "../../lib/errors";
import type { AuditQuery } from "../../lib/audit";
import type { AuditEventKind } from "../../lib/types";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card, SectionHeader } from "../../ui/Card";
import { EmptyState, Skeleton } from "../../ui/Feedback";
import {
  AUDIT_KIND_FILTERS,
  auditFeedItems,
  auditFeedSummary,
} from "./auditFeedHelpers";

interface AuditFeedPanelProps {
  readonly projectId: string;
  readonly title?: string;
}

/**
 * Authoritative project activity feed (C20b). Backed by `useProjectAudit` so the
 * same view works in mock and live mode; renders explicit loading, error,
 * missing-data, empty and populated states with display values from
 * `auditFeedHelpers`.
 */
export function AuditFeedPanel({
  projectId,
  title = "Audit trail",
}: AuditFeedPanelProps) {
  const [kind, setKind] = useState<AuditEventKind | "all">("all");
  const query: AuditQuery = kind === "all" ? {} : { kind };
  const { data, isPending, isError, error, refetch } = useProjectAudit(projectId, query);

  const items = auditFeedItems(data);
  const summary = auditFeedSummary(items);

  return (
    <Card>
      <div className="p-4">
        <SectionHeader title={title} description={summary} />
        <div
          className="mt-3 flex flex-wrap gap-2"
          role="group"
          aria-label="Filter audit events by kind"
        >
          {AUDIT_KIND_FILTERS.map((filter) => (
            <Button
              key={filter.value}
              variant={kind === filter.value ? "primary" : "secondary"}
              size="sm"
              aria-pressed={kind === filter.value}
              onClick={() => setKind(filter.value)}
            >
              {filter.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="border-t border-line">
        {isPending ? (
          <div className="space-y-3 p-4" aria-busy="true" aria-label="Loading audit trail">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : isError ? (
          <div className="p-4">
            <EmptyState
              title="Could not load audit trail"
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
              title="Audit feed unavailable"
              description="No audit feed could be resolved for this project."
            />
          </div>
        ) : items.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No audit events"
              description={
                kind === "all"
                  ? "Asset creation, publishing and jobs will be recorded here."
                  : `No ${kind} events recorded for this project yet.`
              }
            />
          </div>
        ) : (
          <ol className="divide-y divide-line">
            {items.map((item) => (
              <li key={item.id} className="flex items-start gap-3 px-4 py-3">
                <Badge tone={item.tone}>{item.kind}</Badge>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-content" title={item.label}>
                    {item.label}
                  </p>
                  <p className="truncate text-xs text-content-muted" title={item.detail}>
                    {item.detail}
                  </p>
                </div>
                <time className="shrink-0 text-2xs text-content-subtle" dateTime={item.timestamp}>
                  {item.relativeTime}
                </time>
              </li>
            ))}
          </ol>
        )}
      </div>
    </Card>
  );
}
