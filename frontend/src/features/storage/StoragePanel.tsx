import { useStorageStats } from "../../hooks/useQueries";
import type { StorageStats } from "../../lib/types";
import { errorMessage } from "../../lib/errors";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card, SectionHeader } from "../../ui/Card";
import { EmptyState, Skeleton } from "../../ui/Feedback";
import { ProgressBar } from "../../ui/ProgressBar";
import { storageUsage } from "./storageHelpers";

function StorageContent({ stats }: { readonly stats: StorageStats }) {
  const usage = storageUsage(stats);

  if (!usage.hasObjects) {
    return (
      <div className="space-y-3">
        <EmptyState
          title="No stored objects"
          description="Generated and published assets will be counted here as they are added."
        />
        <div className="flex items-center justify-between gap-2 text-xs text-content-muted">
          <span>Quota {usage.limitLabel}</span>
          <Badge tone={usage.tone}>{usage.statusLabel}</Badge>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-content">
          {usage.usedLabel} of {usage.limitLabel} used
        </p>
        <Badge tone={usage.tone}>{usage.statusLabel}</Badge>
      </div>
      <ProgressBar value={usage.usedFraction} label="Project storage quota used" />
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-content-muted">
        <span>{usage.objectCountLabel}</span>
        <span>{usage.remainingLabel} remaining</span>
      </div>
    </div>
  );
}

interface StoragePanelProps {
  readonly projectId: string;
  readonly title?: string;
  readonly description?: string;
}

/**
 * Project storage/quota card backed by the `useStorageStats` query hook.
 * Renders explicit loading, error, empty and populated states; all display
 * values come from `storageUsage` so JSX stays free of inline derivation.
 */
export function StoragePanel({
  projectId,
  title = "Storage",
  description = "Project quota and object usage from the storage stats API.",
}: StoragePanelProps) {
  const { data, isPending, isError, error, refetch } = useStorageStats(projectId);

  return (
    <Card>
      <div className="p-4">
        <SectionHeader title={title} description={description} />
      </div>
      <div className="border-t border-line p-4">
        {isPending ? (
          <div className="space-y-3" aria-busy="true" aria-label="Loading storage stats">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-2 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        ) : isError ? (
          <EmptyState
            title="Could not load storage stats"
            description={errorMessage(error)}
            action={
              <Button variant="primary" size="sm" onClick={() => void refetch()}>
                Try again
              </Button>
            }
          />
        ) : !data ? (
          <EmptyState
            title="No storage data"
            description="Storage statistics are unavailable for this project."
          />
        ) : (
          <StorageContent stats={data} />
        )}
      </div>
    </Card>
  );
}
