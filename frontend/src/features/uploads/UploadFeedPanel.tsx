import { useState } from "react";
import { useUploadFeed } from "../../hooks/useQueries";
import { errorMessage } from "../../lib/errors";
import { useUiStore } from "../../stores/uiStore";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card, SectionHeader } from "../../ui/Card";
import { EmptyState, Skeleton } from "../../ui/Feedback";
import {
  UPLOAD_FEED_LIMITS,
  buildUploadFeedOptions,
  uploadFeedEmptyDescription,
  uploadFeedGeneratedAtLabel,
  uploadFeedRows,
  uploadFeedSummary,
  type UploadFeedRow,
} from "./uploadFeedHelpers";

function UploadRow({
  row,
  onOpen,
}: {
  readonly row: UploadFeedRow;
  readonly onOpen: (row: UploadFeedRow) => void;
}) {
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <Badge tone={row.statusTone}>{row.statusLabel}</Badge>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-content" title={row.filename}>
          {row.filename}
        </p>
        <p className="truncate text-xs text-content-muted" title={row.projectName}>
          {row.projectName} · <span className="tabular-nums">{row.sizeLabel}</span> /{" "}
          <span className="tabular-nums">{row.declaredSizeLabel}</span> · {row.contentType}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <time className="block text-2xs text-content-subtle" dateTime={row.timestamp}>
          {row.relativeTime}
        </time>
        <span className="block text-2xs text-content-subtle">{row.expiresLabel}</span>
      </div>
      <Button variant="secondary" size="sm" onClick={() => onOpen(row)}>
        Open
      </Button>
    </li>
  );
}

export interface UploadFeedPanelProps {
  /** Optional project scope; omitted renders the workspace-wide feed. */
  readonly projectId?: string;
  readonly title?: string;
  readonly description?: string;
}

/**
 * Authoritative upload-ticket feed (C129/C131/C132 follow-up), backed by the
 * `useUploadFeed` query hook so the same view works in mock and live mode.
 * Renders explicit loading, error, missing-data, empty and populated states;
 * every display value is derived in `uploadFeedHelpers`. Rows deep-link to the
 * existing project-detail screen without adding a new route.
 */
export function UploadFeedPanel({
  projectId,
  title = "Upload tickets",
  description = "Newest-first upload tickets derived from the authoritative upload store.",
}: UploadFeedPanelProps) {
  const [limit, setLimit] = useState(25);
  const navigate = useUiStore((s) => s.navigate);

  const { data, isPending, isError, error, refetch } = useUploadFeed(
    buildUploadFeedOptions(projectId, limit),
  );
  const rows = uploadFeedRows(data);
  const summary = uploadFeedSummary(rows, data?.total);
  const generatedAt = uploadFeedGeneratedAtLabel(data);

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
          aria-label="Upload tickets to show"
        >
          <span className="text-2xs text-content-subtle">Show</span>
          {UPLOAD_FEED_LIMITS.map((value) => (
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
          <div className="space-y-3 p-4" aria-busy="true" aria-label="Loading upload tickets">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : isError ? (
          <div className="p-4">
            <EmptyState
              title="Could not load upload tickets"
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
              title="Upload feed unavailable"
              description="No upload feed could be resolved right now."
            />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No upload tickets yet"
              description={uploadFeedEmptyDescription(Boolean(projectId))}
            />
          </div>
        ) : (
          <>
            <ol className="divide-y divide-line">
              {rows.map((row) => (
                <UploadRow
                  key={row.id}
                  row={row}
                  onOpen={(target) => navigate("projects", { projectId: target.projectId })}
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
