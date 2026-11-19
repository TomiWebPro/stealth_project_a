import { useJobs } from "../../hooks/useQueries";
import { errorMessage } from "../../lib/errors";
import { findNavItem } from "../../navigation/routes";
import { PageHeader } from "../../layout/AppLayout";
import { useUiStore } from "../../stores/uiStore";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { EmptyState, Skeleton } from "../../ui/Feedback";
import { JobStatsPanel } from "./JobStatsPanel";
import { JobsPanel } from "./JobsPanel";

/**
 * Global tasks/jobs screen for routes without a dedicated Phase 1b view.
 * Renders jobs from `useJobs` with all five statuses, progress, and retry.
 */
export function JobsScreen() {
  const activeRoute = useUiStore((state) => state.activeRoute);
  const item = findNavItem(activeRoute);
  const { data, isPending, isError, error, refetch } = useJobs();

  return (
    <div className="space-y-6">
      <PageHeader
        title={item?.label ?? "Tasks"}
        description={
          item?.description
            ? `${item.description} · Global jobs and task status.`
            : "Global jobs and task status."
        }
        actions={
          <Button variant="secondary" size="sm" onClick={() => void refetch()}>
            Refresh
          </Button>
        }
      />

      {isPending ? (
        <div className="space-y-4" aria-busy="true" aria-label="Loading jobs">
          <Skeleton className="h-24" />
          <Skeleton className="h-64" />
        </div>
      ) : null}

      {isError ? (
        <Card className="p-6">
          <EmptyState
            title="Could not load jobs"
            description={errorMessage(error)}
            action={
              <Button variant="primary" size="sm" onClick={() => void refetch()}>
                Try again
              </Button>
            }
          />
        </Card>
      ) : null}

      <JobStatsPanel
        title="Global job execution stats"
        description="Authoritative workspace-wide lifecycle, outcome and timing metrics."
      />

      {data ? (
        <JobsPanel
          jobs={data}
          title="Global task panel"
          description="All jobs from useJobs with progress and retry affordances."
        />
      ) : null}
    </div>
  );
}
