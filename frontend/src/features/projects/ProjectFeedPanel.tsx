import { useState } from "react";
import { useProjectFeed } from "../../hooks/useQueries";
import { errorMessage } from "../../lib/errors";
import type { ProjectLifecycle } from "../../lib/types";
import { useUiStore } from "../../stores/uiStore";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card, SectionHeader } from "../../ui/Card";
import { EmptyState, Skeleton } from "../../ui/Feedback";
import {
  buildProjectFeedOptions,
  projectFeedEmptyDescription,
  projectFeedGeneratedAtLabel,
  PROJECT_FEED_LIMITS,
  PROJECT_FEED_LIFECYCLE_FILTERS,
  projectFeedLifecycleChipLabel,
  projectFeedRows,
  projectFeedSummary,
  type ProjectFeedRow,
} from "./projectFeedHelpers";

function ProjectRow({
  row,
  onOpen,
}: {
  readonly row: ProjectFeedRow;
  readonly onOpen: (row: ProjectFeedRow) => void;
}) {
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <Badge tone={row.lifecycleTone}>{row.lifecycleLabel}</Badge>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-content" title={row.name}>
          {row.name}
        </p>
        <p className="truncate text-xs text-content-muted" title={row.orgName}>
          {row.orgName} · <span>{row.descriptionLabel}</span>
        </p>
      </div>
      <div className="shrink-0 text-right">
        <time className="block text-2xs text-content-subtle" dateTime={row.timestamp}>
          {row.relativeTime}
        </time>
        <div className="mt-1 flex justify-end">
          <Button variant="secondary" size="sm" onClick={() => onOpen(row)}>
            Open
          </Button>
        </div>
      </div>
    </li>
  );
}

export interface ProjectFeedPanelProps {
  /** Optional organization scope; omitted renders the workspace-wide feed. */
  readonly orgId?: string;
  readonly title?: string;
  readonly description?: string;
}

/**
 * Authoritative project feed (C145/C147/C148 follow-up), backed by the
 * `useProjectFeed` query hook so the same view works in mock and live mode.
 * Supports lifecycle and page-size filters, renders explicit loading, error,
 * missing-data, empty and populated states, and derives every display value in
 * `projectFeedHelpers`. Rows deep-link to the existing project-detail screen.
 */
export function ProjectFeedPanel({
  orgId,
  title = "Projects",
  description = "Newest-first projects derived from the authoritative project store.",
}: ProjectFeedPanelProps) {
  const [limit, setLimit] = useState(25);
  const [lifecycle, setLifecycle] = useState<ProjectLifecycle | undefined>(undefined);
  const navigate = useUiStore((s) => s.navigate);

  const { data, isPending, isError, error, refetch } = useProjectFeed(
    buildProjectFeedOptions(orgId, lifecycle, limit),
  );
  const rows = projectFeedRows(data);
  const summary = projectFeedSummary(rows, data?.total);
  const generatedAt = projectFeedGeneratedAtLabel(data);

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
          aria-label="Project lifecycle filter"
        >
          <span className="text-2xs text-content-subtle">Lifecycle</span>
          {PROJECT_FEED_LIFECYCLE_FILTERS.map((value) => (
            <Button
              key={value ?? "all"}
              variant={lifecycle === value ? "primary" : "secondary"}
              size="sm"
              aria-pressed={lifecycle === value}
              onClick={() => setLifecycle(value)}
            >
              {projectFeedLifecycleChipLabel(value)}
            </Button>
          ))}
        </div>
        <div
          className="mt-2 flex flex-wrap items-center gap-2"
          role="group"
          aria-label="Project rows to show"
        >
          <span className="text-2xs text-content-subtle">Show</span>
          {PROJECT_FEED_LIMITS.map((value) => (
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
          <div className="space-y-3 p-4" aria-busy="true" aria-label="Loading projects">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : isError ? (
          <div className="p-4">
            <EmptyState
              title="Could not load projects"
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
              title="Project feed unavailable"
              description="No project feed could be resolved right now."
            />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No projects yet"
              description={projectFeedEmptyDescription(Boolean(orgId), Boolean(lifecycle))}
            />
          </div>
        ) : (
          <>
            <ol className="divide-y divide-line">
              {rows.map((row) => (
                <ProjectRow
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
