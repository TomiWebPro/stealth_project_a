import { useState } from "react";
import { useUploadFeed, useUploadOverview } from "../../hooks/useQueries";
import { errorMessage } from "../../lib/errors";
import { useUiStore } from "../../stores/uiStore";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card, SectionHeader } from "../../ui/Card";
import { EmptyState, Skeleton } from "../../ui/Feedback";
import { ProgressBar } from "../../ui/ProgressBar";
import {
  buildUploadPickerFeedOptions,
  hasUploadOverviewData,
  uploadOverviewCountRows,
  uploadOverviewEmptyDescription,
  uploadOverviewGeneratedAtLabel,
  uploadOverviewIdentity,
  uploadOverviewProgress,
  uploadOverviewStatRows,
  uploadOverviewSummaryLabel,
  uploadPickerOptions,
  type UploadOverviewStat,
} from "./uploadOverviewHelpers";

function StatGrid({ rows }: { readonly rows: readonly UploadOverviewStat[] }) {
  return (
    <section aria-label="Upload ticket accounting" className="grid grid-cols-2 gap-3 md:grid-cols-4">
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

export interface UploadOverviewPanelProps {
  /** Optional project scope; omitted inspects tickets across the workspace. */
  readonly projectId?: string;
  readonly title?: string;
  readonly description?: string;
}

/**
 * Authoritative single-upload-ticket overview (C246/C248/C249 follow-up), backed
 * by the `useUploadOverview` query hook so the same view works in mock and live
 * mode. The picker is populated from the authoritative `useUploadFeed` query,
 * optionally scoped to `projectId`. Renders explicit loading, error,
 * missing-data, empty and populated states; every display value is derived in
 * `uploadOverviewHelpers`. Ticket rows stay read-only (no upload-detail route);
 * the ticket's project deep-links to project detail.
 */
export function UploadOverviewPanel({
  projectId,
  title = "Upload ticket overview",
  description = "Select an upload ticket to inspect its identity, byte accounting and whole-project activity.",
}: UploadOverviewPanelProps) {
  const navigate = useUiStore((s) => s.navigate);
  const [selectedUploadId, setSelectedUploadId] = useState("");

  const {
    data: feedData,
    isPending: feedPending,
    isError: feedError,
    error: feedErr,
    refetch: refetchFeed,
  } = useUploadFeed(buildUploadPickerFeedOptions(projectId));

  const options = uploadPickerOptions(feedData);
  // Fall back to the first ticket when the current selection disappears (e.g.
  // the feed changed) without an effect fighting the query cache.
  const activeUploadId = options.some((option) => option.value === selectedUploadId)
    ? selectedUploadId
    : (options[0]?.value ?? "");

  const { data, isPending, isError, error, refetch } = useUploadOverview(activeUploadId);

  const identity = uploadOverviewIdentity(data);
  const stats = uploadOverviewStatRows(data);
  const counts = uploadOverviewCountRows(data);
  const progress = uploadOverviewProgress(data);
  const generatedAt = uploadOverviewGeneratedAtLabel(data);
  const summary = uploadOverviewSummaryLabel(data);

  const uploadPicker = (
    <label className="flex items-center gap-2 text-xs text-content-muted">
      <span>Ticket</span>
      <select
        aria-label="Select an upload ticket to inspect"
        className="h-8 max-w-96 rounded-md border border-line-strong bg-surface-raised px-2 text-xs text-content"
        value={activeUploadId}
        onChange={(event) => setSelectedUploadId(event.target.value)}
        disabled={options.length === 0}
      >
        {options.length === 0 ? <option value="">No tickets</option> : null}
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
        <SectionHeader title={title} description={description} action={uploadPicker} />
      </div>

      <div className="border-t border-line p-4">
        {feedPending ? (
          <div className="space-y-6" aria-busy="true" aria-label="Loading upload tickets">
            <Skeleton className="h-8 w-1/2" />
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} className="h-20" />
              ))}
            </div>
            <Skeleton className="h-40" />
          </div>
        ) : feedError ? (
          <EmptyState
            title="Could not load upload tickets"
            description={errorMessage(feedErr)}
            action={
              <Button variant="primary" size="sm" onClick={() => void refetchFeed()}>
                Try again
              </Button>
            }
          />
        ) : options.length === 0 ? (
          <EmptyState
            title="No upload tickets to inspect"
            description={uploadOverviewEmptyDescription(Boolean(projectId))}
          />
        ) : isPending ? (
          <div className="space-y-6" aria-busy="true" aria-label="Loading upload overview">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} className="h-20" />
              ))}
            </div>
            <Skeleton className="h-40" />
          </div>
        ) : isError ? (
          <EmptyState
            title="Could not load upload overview"
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
            description="The authoritative snapshot for this upload ticket is not available right now."
          />
        ) : !hasUploadOverviewData(data) ? (
          <EmptyState
            title="No recorded upload activity"
            description="This ticket has no declared or uploaded bytes and no project upload activity yet."
          />
        ) : (
          <div className="space-y-6">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={identity.statusTone}>{identity.statusLabel}</Badge>
                {identity.expired ? <Badge tone="danger">Expired</Badge> : null}
                <span
                  className="min-w-0 truncate text-sm font-semibold text-content"
                  title={identity.filename}
                >
                  {identity.filename}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!identity.projectId}
                  onClick={() => navigate("projects", { projectId: identity.projectId })}
                >
                  Open project
                </Button>
              </div>
              <p className="text-xs text-content-muted">
                {identity.projectName} · {identity.contentType} ·{" "}
                <span title={identity.uploadIdLabel}>{identity.uploadIdLabel}</span>
              </p>
              <p className="text-xs text-content-subtle">
                Created {identity.createdLabel || "—"} · expires {identity.expiresLabel || "—"}
              </p>
            </div>

            <StatGrid rows={stats} />

            <section aria-label="Upload progress" className="rounded-md border border-line p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-sm font-medium text-content">Upload progress</h3>
                <span className="text-xs tabular-nums text-content-muted">
                  {progress.percent}% complete
                </span>
              </div>
              <ProgressBar value={progress.fraction} label="Upload completion" />
            </section>

            <section
              aria-label="Whole-project upload activity"
              className="rounded-md border border-line p-4"
            >
              <h3 className="mb-3 text-sm font-medium text-content">
                Activity in {identity.projectName}
              </h3>
              <ul className="grid gap-3 sm:grid-cols-3">
                {counts.map((row) => (
                  <li key={row.key} className="rounded-md border border-line bg-surface-raised p-3">
                    <p className="text-2xs font-semibold uppercase tracking-wider text-content-subtle">
                      {row.label}
                    </p>
                    <p className="mt-1 text-lg font-semibold tabular-nums text-content" title={row.value}>
                      {row.value}
                    </p>
                    <p className="mt-0.5 text-2xs text-content-muted">{row.hint}</p>
                  </li>
                ))}
              </ul>
            </section>

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
