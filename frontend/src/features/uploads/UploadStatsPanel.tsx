import { useUploadStats } from "../../hooks/useQueries";
import { errorMessage } from "../../lib/errors";
import type { UploadStats } from "../../lib/types";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card, SectionHeader } from "../../ui/Card";
import { EmptyState, Skeleton } from "../../ui/Feedback";
import { ProgressBar } from "../../ui/ProgressBar";
import {
  hasUploadStatsData,
  uploadProjectRows,
  uploadStatsCards,
  uploadStatsGeneratedAtLabel,
  uploadStatusRows,
  type UploadProjectRow,
  type UploadStatusRow,
} from "./uploadStatsHelpers";

function StatGrid({ stats }: { readonly stats: UploadStats }) {
  const cards = uploadStatsCards(stats);
  return (
    <section
      aria-label="Upload ticket totals"
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

function StatusRows({ rows }: { readonly rows: readonly UploadStatusRow[] }) {
  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.status} className="flex items-center gap-3">
          <span className="w-24 shrink-0">
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

function ProjectRows({ rows }: { readonly rows: readonly UploadProjectRow[] }) {
  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.projectId} className="flex items-center gap-3">
          <span className="w-24 shrink-0 truncate text-xs text-content" title={row.projectId}>
            {row.label}
          </span>
          <ProgressBar
            value={row.fraction}
            label={`${row.label} completion`}
            className="flex-1"
          />
          <span className="w-12 shrink-0 text-right text-2xs tabular-nums text-content">
            {row.completed}/{row.total}
          </span>
          <span className="w-16 shrink-0 text-right text-2xs tabular-nums text-content-subtle">
            {row.bytesLabel}
          </span>
        </li>
      ))}
    </ul>
  );
}

function UploadStatsContent({ stats }: { readonly stats: UploadStats }) {
  const generatedAt = uploadStatsGeneratedAtLabel(stats);
  const statuses = uploadStatusRows(stats);
  const projects = uploadProjectRows(stats);

  return (
    <div className="space-y-6">
      <StatGrid stats={stats} />
      {!hasUploadStatsData(stats) ? (
        <EmptyState
          title="No upload tickets in this scope"
          description="Upload tickets will appear here as assets are registered with the studio."
        />
      ) : (
        <>
          <section aria-label="Tickets by status" className="rounded-md border border-line p-4">
            <h3 className="mb-3 text-sm font-medium text-content">Tickets by status</h3>
            <StatusRows rows={statuses} />
          </section>
          {projects.length > 0 ? (
            <section aria-label="Uploads by project" className="rounded-md border border-line p-4">
              <h3 className="mb-3 text-sm font-medium text-content">Uploads by project</h3>
              <ProjectRows rows={projects} />
            </section>
          ) : null}
          {generatedAt ? (
            <p className="text-2xs text-content-subtle">Statistics generated {generatedAt}.</p>
          ) : null}
        </>
      )}
    </div>
  );
}

export interface UploadStatsPanelProps {
  /** Optional project scope; omitted renders the workspace-wide snapshot. */
  readonly projectId?: string;
  readonly title?: string;
  readonly description?: string;
}

/**
 * Authoritative upload-ticket metrics from the `useUploadStats` query hook.
 * Renders explicit loading, error, missing-data, empty and populated states;
 * every display value comes from `uploadStatsHelpers` so JSX stays free of
 * inline derivation and mock/live transports render identically. See C97/C99/C100.
 */
export function UploadStatsPanel({
  projectId,
  title = "Upload stats",
  description = "Authoritative upload-ticket metrics derived from the workspace upload store.",
}: UploadStatsPanelProps) {
  const { data, isPending, isError, error, refetch } = useUploadStats(
    projectId ? { projectId } : undefined,
  );

  return (
    <Card>
      <div className="p-4">
        <SectionHeader title={title} description={description} />
      </div>
      <div className="border-t border-line p-4">
        {isPending ? (
          <div className="space-y-6" aria-busy="true" aria-label="Loading upload statistics">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} className="h-20" />
              ))}
            </div>
            <Skeleton className="h-40" />
          </div>
        ) : isError ? (
          <EmptyState
            title="Could not load upload statistics"
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
            description="Upload-ticket metrics are not available right now."
          />
        ) : (
          <UploadStatsContent stats={data} />
        )}
      </div>
    </Card>
  );
}
