import { useDashboard } from "../../hooks/useQueries";
import { errorMessage } from "../../lib/errors";
import type { DashboardSummary } from "../../lib/types";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card, SectionHeader } from "../../ui/Card";
import { EmptyState, Skeleton } from "../../ui/Feedback";
import { ProgressBar } from "../../ui/ProgressBar";
import {
  assetTypeBreakdown,
  dashboardStats,
  generatedAtLabel,
  hasDashboardData,
  jobStatusBreakdown,
  recentAssetRows,
  recentJobRows,
  type DashboardBreakdownRow,
} from "./dashboardHelpers";

function StatGrid({ summary }: { readonly summary: DashboardSummary }) {
  const stats = dashboardStats(summary);
  return (
    <section aria-label="Workspace totals" className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
      {stats.map((stat) => (
        <div key={stat.key} className="rounded-md border border-line bg-surface-raised p-3">
          <p className="text-2xs font-semibold uppercase tracking-wider text-content-subtle">
            {stat.label}
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-content">{stat.value}</p>
          <p className="mt-0.5 text-2xs text-content-muted">{stat.hint}</p>
        </div>
      ))}
    </section>
  );
}

function BreakdownList({
  rows,
}: {
  readonly rows: readonly DashboardBreakdownRow[];
}) {
  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.key} className="flex items-center gap-3">
          <span className="w-20 shrink-0 text-xs text-content-muted">{row.label}</span>
          <ProgressBar
            value={row.fraction}
            label={`${row.label} share`}
            className="flex-1"
          />
          <span className="w-10 shrink-0 text-right text-xs tabular-nums text-content">
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

function DashboardContent({ summary }: { readonly summary: DashboardSummary }) {
  const recentJobs = recentJobRows(summary);
  const recentAssets = recentAssetRows(summary);
  const generatedAt = generatedAtLabel(summary);

  return (
    <div className="space-y-6">
      <StatGrid summary={summary} />

      {!hasDashboardData(summary) ? (
        <EmptyState
          title="No workspace data yet"
          description="Projects, assets and jobs will appear here as soon as the studio creates them."
        />
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <section aria-label="Jobs by status" className="rounded-md border border-line p-4">
              <h3 className="mb-3 text-sm font-medium text-content">Jobs by status</h3>
              <BreakdownList rows={jobStatusBreakdown(summary)} />
            </section>
            <section aria-label="Assets by type" className="rounded-md border border-line p-4">
              <h3 className="mb-3 text-sm font-medium text-content">Assets by type</h3>
              <BreakdownList rows={assetTypeBreakdown(summary)} />
            </section>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <section aria-label="Recent jobs" className="rounded-md border border-line p-4">
              <h3 className="mb-3 text-sm font-medium text-content">Recent jobs</h3>
              {recentJobs.length === 0 ? (
                <p className="text-xs text-content-muted">No jobs submitted yet.</p>
              ) : (
                <ul className="space-y-3">
                  {recentJobs.map((job) => (
                    <li key={job.id} className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-medium text-content">{job.label}</span>
                        <Badge tone={job.tone}>{job.status}</Badge>
                      </div>
                      <ProgressBar value={job.progress / 100} label={`${job.label} progress`} />
                      <p className="text-2xs text-content-subtle">{job.when}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-label="Recent assets" className="rounded-md border border-line p-4">
              <h3 className="mb-3 text-sm font-medium text-content">Recent assets</h3>
              {recentAssets.length === 0 ? (
                <p className="text-xs text-content-muted">No assets generated yet.</p>
              ) : (
                <ul className="space-y-2">
                  {recentAssets.map((asset) => (
                    <li key={asset.id} className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs text-content" title={asset.name}>
                        {asset.name}
                      </span>
                      <Badge tone={asset.tone}>{asset.type}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {generatedAt ? (
            <p className="text-2xs text-content-subtle">Snapshot generated {generatedAt}.</p>
          ) : null}
        </>
      )}
    </div>
  );
}

/**
 * Authoritative workspace snapshot backed by the `useDashboard` query hook.
 * Renders explicit loading, error, missing-data, empty and populated states;
 * every display value comes from `dashboardHelpers`.
 */
export function DashboardPanel() {
  const { data, isPending, isError, error, refetch } = useDashboard();

  return (
    <Card>
      <div className="p-4">
        <SectionHeader
          title="Workspace snapshot"
          description="Authoritative counts, breakdowns and recent activity derived from the studio stores."
        />
      </div>
      <div className="border-t border-line p-4">
        {isPending ? (
          <div className="space-y-6" aria-busy="true" aria-label="Loading workspace snapshot">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
              {Array.from({ length: 6 }, (_, index) => (
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
            title="Could not load the workspace snapshot"
            description={errorMessage(error)}
            action={
              <Button variant="primary" size="sm" onClick={() => void refetch()}>
                Try again
              </Button>
            }
          />
        ) : !data ? (
          <EmptyState
            title="Snapshot unavailable"
            description="The dashboard summary is not available right now."
          />
        ) : (
          <DashboardContent summary={data} />
        )}
      </div>
    </Card>
  );
}
