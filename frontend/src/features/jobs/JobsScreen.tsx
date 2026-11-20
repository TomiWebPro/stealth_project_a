import { useJobs } from "../../hooks/useQueries";
import { errorMessage } from "../../lib/errors";
import { findNavItem } from "../../navigation/routes";
import { PageHeader } from "../../layout/AppLayout";
import { useUiStore } from "../../stores/uiStore";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { EmptyState, Skeleton } from "../../ui/Feedback";
import { EventFeedPanel } from "./EventFeedPanel";
import { EventStatsPanel } from "./EventStatsPanel";
import { JobFeedPanel } from "./JobFeedPanel";
import { JobLogConsole } from "./JobLogConsole";
import { JobOverviewPanel } from "./JobOverviewPanel";
import { JobQueuePanel } from "./JobQueuePanel";
import { JobStatsPanel } from "./JobStatsPanel";
import { JobsPanel } from "./JobsPanel";
import { OrchestrationFeedPanel } from "./OrchestrationFeedPanel";
import { OrchestrationStatsPanel } from "./OrchestrationStatsPanel";
import { RetryFeedPanel } from "./RetryFeedPanel";
import { RetryStatsPanel } from "./RetryStatsPanel";
import { OperationFeedPanel } from "../operations/OperationFeedPanel";
import { OperationStatsPanel } from "../operations/OperationStatsPanel";

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

      <OperationStatsPanel />

      <OperationFeedPanel
        title="Global operation catalog feed"
        description="Operations from the authoritative catalog, ordered by title, with streaming and provider filters."
      />

      <OrchestrationStatsPanel
        title="Global orchestration stats"
        description="Authoritative workspace-wide plan, run and step metrics."
      />

      <OrchestrationFeedPanel
        title="Global orchestration feed"
        description="Newest-first plans and runs from the authoritative orchestration stores, with kind filters."
      />

      <EventStatsPanel
        title="Global job event stats"
        description="Authoritative workspace-wide status, progress and result event metrics."
      />

      <EventFeedPanel
        title="Global job event feed"
        description="Newest-first job events from the authoritative event stream, with type filters."
      />

      <RetryStatsPanel
        title="Global job retry stats"
        description="Authoritative workspace-wide retry and retried-job metrics."
      />

      <RetryFeedPanel
        title="Global job retry feed"
        description="Newest-first retried jobs from the authoritative retry ledger."
      />

      <JobQueuePanel
        title="Global job dispatch queue"
        description="Authoritative workspace-wide FIFO queue of queued and running jobs."
      />

      <JobFeedPanel
        title="Global job feed"
        description="Newest-first jobs from the authoritative job store, with status filters."
      />

      {data ? (
        <JobsPanel
          jobs={data}
          title="Global task panel"
          description="All jobs from useJobs with progress and retry affordances."
        />
      ) : null}

      <JobOverviewPanel
        jobs={data ?? []}
        title="Global job overview"
        description="Select a job to inspect its authoritative snapshot: identity, counts and newest events."
      />

      <JobLogConsole
        jobs={data ?? []}
        title="Global job log console"
        description="Select a job to inspect its authoritative execution events."
      />
    </div>
  );
}
