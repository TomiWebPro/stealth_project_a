import { useProjectOverview } from "../../hooks/useQueries";
import { errorMessage } from "../../lib/errors";
import { useUiStore } from "../../stores/uiStore";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card, SectionHeader } from "../../ui/Card";
import { EmptyState, Skeleton } from "../../ui/Feedback";
import type {
  ProjectOverviewCountRow,
  ProjectOverviewJobRow,
  ProjectOverviewAssetRow,
} from "./projectOverviewHelpers";
import {
  hasProjectOverviewData,
  projectOverviewCountRows,
  projectOverviewGeneratedAtLabel,
  projectOverviewIdentity,
  projectOverviewRecentAssets,
  projectOverviewRecentJobs,
  projectOverviewSummaryLabel,
} from "./projectOverviewHelpers";

function CountGrid({ rows }: { readonly rows: readonly ProjectOverviewCountRow[] }) {
  return (
    <section aria-label="Cross-domain counts" className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
      {rows.map((row) => (
        <div key={row.key} className="rounded-md border border-line bg-surface-raised p-3">
          <p className="text-2xs font-semibold uppercase tracking-wider text-content-subtle">{row.label}</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-content">{row.value}</p>
          <p className="mt-0.5 text-2xs text-content-muted">{row.hint}</p>
        </div>
      ))}
    </section>
  );
}

function RecentJobs({ rows }: { readonly rows: readonly ProjectOverviewJobRow[] }) {
  return (
    <section aria-label="Recent jobs" className="rounded-md border border-line p-4">
      <h3 className="mb-3 text-sm font-medium text-content">Recent jobs</h3>
      {rows.length === 0 ? (
        <p className="text-xs text-content-muted">No recent jobs in this project.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center gap-3">
              <Badge tone={row.statusTone}>{row.statusLabel}</Badge>
              <span className="min-w-0 flex-1 truncate text-xs text-content" title={row.operationLabel}>
                {row.operationLabel}
              </span>
              <span className="shrink-0 text-2xs tabular-nums text-content-muted">{row.progressPercent}%</span>
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

function RecentAssets({
  rows,
  onOpen,
}: {
  readonly rows: readonly ProjectOverviewAssetRow[];
  readonly onOpen: (row: ProjectOverviewAssetRow) => void;
}) {
  return (
    <section aria-label="Recent assets" className="rounded-md border border-line p-4">
      <h3 className="mb-3 text-sm font-medium text-content">Recent assets</h3>
      {rows.length === 0 ? (
        <p className="text-xs text-content-muted">No recent assets in this project.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center gap-3">
              <Badge tone={row.typeTone}>{row.typeLabel}</Badge>
              <span className="min-w-0 flex-1 truncate text-xs text-content" title={row.name}>
                {row.name}
              </span>
              <span className="shrink-0 text-2xs tabular-nums text-content-muted">{row.versionLabel}</span>
              <time className="shrink-0 text-2xs text-content-subtle" dateTime={row.timestamp}>
                {row.relativeTime}
              </time>
              <Button variant="secondary" size="sm" onClick={() => onOpen(row)}>
                Open
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export interface ProjectOverviewPanelProps {
  readonly projectId: string;
  readonly title?: string;
  readonly description?: string;
}

/**
 * Authoritative single-project overview (C201/C203/C204 follow-up), backed by
 * the `useProjectOverview` query hook so the same view works in mock and live
 * mode. Renders explicit loading, error, missing-data, empty and populated
 * states; every display value is derived in `projectOverviewHelpers`. Recent
 * assets deep-link to the asset detail panel (scoping the assets browser to the
 * project first); recent jobs stay read-only because there is no job-detail
 * route.
 */
export function ProjectOverviewPanel({
  projectId,
  title = "Project overview snapshot",
  description = "Compact authoritative snapshot: cross-domain counts and the newest jobs and assets, derived from the project stores.",
}: ProjectOverviewPanelProps) {
  const navigate = useUiStore((s) => s.navigate);
  const setAssetsProjectId = useUiStore((s) => s.setAssetsProjectId);
  const { data, isPending, isError, error, refetch } = useProjectOverview(projectId);
  const identity = projectOverviewIdentity(data);
  const counts = projectOverviewCountRows(data);
  const jobs = projectOverviewRecentJobs(data);
  const assets = projectOverviewRecentAssets(data);
  const generatedAt = projectOverviewGeneratedAtLabel(data);
  const summary = projectOverviewSummaryLabel(data);

  const openAsset = (row: ProjectOverviewAssetRow) => {
    setAssetsProjectId(projectId);
    navigate("assets", { assetId: row.id });
  };

  return (
    <Card>
      <div className="p-4">
        <SectionHeader title={title} description={description} />
      </div>
      <div className="border-t border-line p-4">
        {isPending ? (
          <div className="space-y-6" aria-busy="true" aria-label="Loading project overview">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
              {Array.from({ length: 7 }, (_, index) => (
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
            title="Could not load project overview"
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
            description="The authoritative snapshot for this project is not available right now."
          />
        ) : !hasProjectOverviewData(data) ? (
          <EmptyState
            title="No project activity yet"
            description="This project has no counted entities or recent items."
          />
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={identity.lifecycleTone}>{identity.lifecycleLabel}</Badge>
              {identity.createdLabel ? (
                <span className="text-2xs text-content-muted">Created {identity.createdLabel}</span>
              ) : null}
              {summary ? <span className="text-2xs text-content-subtle">{summary}</span> : null}
            </div>
            <CountGrid rows={counts} />
            <div className="grid gap-6 lg:grid-cols-2">
              <RecentJobs rows={jobs} />
              <RecentAssets rows={assets} onOpen={openAsset} />
            </div>
            {generatedAt ? (
              <p className="text-2xs text-content-subtle">Snapshot generated {generatedAt}.</p>
            ) : null}
          </div>
        )}
      </div>
    </Card>
  );
}
