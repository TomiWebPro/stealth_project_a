import { useCommentStats, useProjects } from "../../hooks/useQueries";
import { errorMessage } from "../../lib/errors";
import type { CommentStats } from "../../lib/types";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card, SectionHeader } from "../../ui/Card";
import { EmptyState, Skeleton } from "../../ui/Feedback";
import { ProgressBar } from "../../ui/ProgressBar";
import {
  commentAuthorRows,
  commentProjectRows,
  commentReferenceRows,
  commentStatsCards,
  commentStatsGeneratedAtLabel,
  hasCommentStatsData,
  type CommentAuthorRow,
  type CommentProjectRow,
  type CommentReferenceRow,
} from "./commentStatsHelpers";

function StatGrid({ stats }: { readonly stats: CommentStats }) {
  const cards = commentStatsCards(stats);
  return (
    <section
      aria-label="Comment totals"
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

function ReferenceRows({ rows }: { readonly rows: readonly CommentReferenceRow[] }) {
  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.reference} className="flex items-center gap-3">
          <span className="w-28 shrink-0">
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

function ProjectRows({ rows }: { readonly rows: readonly CommentProjectRow[] }) {
  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.projectId} className="flex items-center gap-3">
          <span className="w-28 shrink-0 truncate text-xs text-content-muted" title={row.projectId}>
            {row.label}
          </span>
          <span className="flex shrink-0 gap-1">
            <Badge tone="info">{`${row.comments} comments`}</Badge>
            <Badge tone="accent">{`${row.authors} authors`}</Badge>
          </span>
          <span className="ml-auto text-2xs tabular-nums text-content-subtle">
            {row.activity} signals
          </span>
        </li>
      ))}
    </ul>
  );
}

function AuthorRows({ rows }: { readonly rows: readonly CommentAuthorRow[] }) {
  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.authorId} className="flex items-center gap-3">
          <span className="w-28 shrink-0 truncate text-xs text-content-muted" title={row.authorId}>
            {row.label}
          </span>
          <ProgressBar
            value={row.comments > 0 ? 1 : 0}
            label={`${row.label} author share`}
            className="flex-1"
          />
          <span className="w-16 shrink-0 text-right text-2xs tabular-nums text-content-subtle">
            {row.comments} comments
          </span>
        </li>
      ))}
    </ul>
  );
}

function CommentStatsContent({
  stats,
  projectNames,
}: {
  readonly stats: CommentStats;
  readonly projectNames: Readonly<Record<string, string>>;
}) {
  const generatedAt = commentStatsGeneratedAtLabel(stats);
  const references = commentReferenceRows(stats);
  const projects = commentProjectRows(stats, projectNames);
  const authors = commentAuthorRows(stats);

  return (
    <div className="space-y-6">
      <StatGrid stats={stats} />
      {!hasCommentStatsData(stats) ? (
        <EmptyState
          title="No comments in this scope"
          description="Collaboration comments will populate these metrics as contributors discuss projects and assets."
        />
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <section aria-label="Comments by reference" className="rounded-md border border-line p-4">
              <h3 className="mb-3 text-sm font-medium text-content">Comments by reference</h3>
              <ReferenceRows rows={references} />
            </section>
            <section aria-label="Activity by project" className="rounded-md border border-line p-4">
              <h3 className="mb-3 text-sm font-medium text-content">Activity by project</h3>
              {projects.length === 0 ? (
                <p className="text-xs text-content-muted">No projects in this scope.</p>
              ) : (
                <ProjectRows rows={projects} />
              )}
            </section>
          </div>
          {authors.length > 0 ? (
            <section aria-label="Top authors" className="rounded-md border border-line p-4">
              <h3 className="mb-3 text-sm font-medium text-content">Top authors</h3>
              <AuthorRows rows={authors} />
            </section>
          ) : null}
          {generatedAt ? (
            <p className="text-2xs text-content-subtle">Metrics generated {generatedAt}.</p>
          ) : null}
        </>
      )}
    </div>
  );
}

export interface CommentStatsPanelProps {
  /** Optional project scope; omitted renders the workspace-wide snapshot. */
  readonly projectId?: string;
  readonly title?: string;
  readonly description?: string;
}

/**
 * Authoritative comment metrics from the `useCommentStats` query hook. Renders
 * explicit loading, error, missing-data, empty and populated states; every
 * display value comes from `commentStatsHelpers` so JSX stays free of inline
 * derivation and mock/live transports render identically. See C165/C167/C168.
 */
export function CommentStatsPanel({
  projectId,
  title = "Comment stats",
  description = "Authoritative comment metrics derived from the collaboration comment store.",
}: CommentStatsPanelProps) {
  const { data, isPending, isError, error, refetch } = useCommentStats(
    projectId ? { projectId } : undefined,
  );
  const projectNames: Record<string, string> = {};
  for (const project of useProjects().data ?? []) projectNames[project.id] = project.name;

  return (
    <Card>
      <div className="p-4">
        <SectionHeader title={title} description={description} />
      </div>
      <div className="border-t border-line p-4">
        {isPending ? (
          <div className="space-y-6" aria-busy="true" aria-label="Loading comment statistics">
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
            title="Could not load comment statistics"
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
            description="Comment metrics are not available right now."
          />
        ) : (
          <CommentStatsContent stats={data} projectNames={projectNames} />
        )}
      </div>
    </Card>
  );
}
