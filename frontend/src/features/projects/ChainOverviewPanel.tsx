import { useState } from "react";
import { useChainOverview, usePipelineFeed } from "../../hooks/useQueries";
import { errorMessage } from "../../lib/errors";
import { useUiStore } from "../../stores/uiStore";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card, SectionHeader } from "../../ui/Card";
import { EmptyState, Skeleton } from "../../ui/Feedback";
import {
  buildChainPickerFeedOptions,
  chainAssetRows,
  chainJobRows,
  chainOverviewGeneratedAtLabel,
  chainOverviewIdentity,
  chainOverviewOptions,
  chainOverviewStatRows,
  chainOverviewSummaryLabel,
  CHAIN_OVERVIEW_RECENT_LIMITS,
  chainPickerOptions,
  hasChainOverviewData,
  type ChainAssetRow,
  type ChainJobRow,
  type ChainOverviewStat,
} from "./chainOverviewHelpers";

function StatGrid({ rows }: { readonly rows: readonly ChainOverviewStat[] }) {
  return (
    <section aria-label="Chain overview" className="grid grid-cols-2 gap-3 md:grid-cols-4">
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

function RecentJobs({ rows }: { readonly rows: readonly ChainJobRow[] }) {
  return (
    <section aria-label="Recent chain jobs" className="rounded-md border border-line p-4">
      <h3 className="mb-3 text-sm font-medium text-content">Recent jobs</h3>
      {rows.length === 0 ? (
        <p className="text-xs text-content-muted">No linked jobs resolved for this chain.</p>
      ) : (
        <ol className="space-y-3">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <Badge tone={row.statusTone}>{row.statusLabel}</Badge>
              <span className="min-w-0 truncate text-xs font-medium text-content" title={row.operationLabel}>
                {row.operationLabel}
              </span>
              <span className="text-2xs text-content-subtle" title={row.id}>
                {row.shortJobId}
              </span>
              <time className="ml-auto text-2xs text-content-subtle" dateTime={row.timestamp}>
                {row.relativeTime}
              </time>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function RecentAssets({
  rows,
  onOpen,
}: {
  readonly rows: readonly ChainAssetRow[];
  readonly onOpen: (row: ChainAssetRow) => void;
}) {
  return (
    <section aria-label="Recent chain assets" className="rounded-md border border-line p-4">
      <h3 className="mb-3 text-sm font-medium text-content">Recent assets</h3>
      {rows.length === 0 ? (
        <p className="text-xs text-content-muted">No linked assets resolved for this chain.</p>
      ) : (
        <ol className="space-y-3">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="min-w-0 truncate text-xs font-medium text-content" title={row.name}>
                {row.name}
              </span>
              <Badge tone="neutral">{row.typeLabel}</Badge>
              <time className="text-2xs text-content-subtle" dateTime={row.timestamp}>
                {row.relativeTime}
              </time>
              <div className="ml-auto">
                <Button variant="secondary" size="sm" onClick={() => onOpen(row)}>
                  Open
                </Button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export interface ChainOverviewPanelProps {
  /** Optional project scope; omitted inspects chains across the workspace. */
  readonly projectId?: string;
  readonly title?: string;
  readonly description?: string;
}

/**
 * Authoritative single-pipeline-chain overview (C234/C236/C237 follow-up), backed
 * by the `useChainOverview` query hook so the same view works in mock and live
 * mode. The picker is populated from the authoritative `usePipelineFeed` query,
 * optionally scoped to `projectId`. Renders explicit loading, error,
 * missing-data, empty and populated states; every display value is derived in
 * `chainOverviewHelpers`. Asset rows deep-link to the assets browser (scoped to
 * the chain's project first); job rows stay read-only (no job-detail route).
 */
export function ChainOverviewPanel({
  projectId,
  title = "Chain overview snapshot",
  description = "Select a pipeline chain to inspect its identity, whole-chain counts and newest linked jobs/assets.",
}: ChainOverviewPanelProps) {
  const navigate = useUiStore((s) => s.navigate);
  const setAssetsProjectId = useUiStore((s) => s.setAssetsProjectId);
  const [selectedChainId, setSelectedChainId] = useState("");
  const [recentLimit, setRecentLimit] = useState(5);

  const {
    data: feedData,
    isPending: feedPending,
    isError: feedError,
    error: feedErr,
    refetch: refetchFeed,
  } = usePipelineFeed(buildChainPickerFeedOptions(projectId));

  const options = chainPickerOptions(feedData);
  // Fall back to the first chain when the current selection disappears (e.g.
  // the chain list changed) without an effect fighting the query cache.
  const activeChainId = options.some((option) => option.value === selectedChainId)
    ? selectedChainId
    : (options[0]?.value ?? "");

  const { data, isPending, isError, error, refetch } = useChainOverview(
    activeChainId,
    chainOverviewOptions(recentLimit),
  );

  const identity = chainOverviewIdentity(data);
  const stats = chainOverviewStatRows(data);
  const jobs = chainJobRows(data);
  const assets = chainAssetRows(data);
  const generatedAt = chainOverviewGeneratedAtLabel(data);
  const summary = chainOverviewSummaryLabel(data);

  const openAsset = (row: ChainAssetRow) => {
    setAssetsProjectId(identity.projectId || projectId || "");
    navigate("assets", { assetId: row.id });
  };

  const chainPicker = (
    <label className="flex items-center gap-2 text-xs text-content-muted">
      <span>Chain</span>
      <select
        aria-label="Select a pipeline chain to inspect"
        className="h-8 max-w-72 rounded-md border border-line-strong bg-surface-raised px-2 text-xs text-content"
        value={activeChainId}
        onChange={(event) => setSelectedChainId(event.target.value)}
        disabled={options.length === 0}
      >
        {options.length === 0 ? <option value="">No chains</option> : null}
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
        <SectionHeader title={title} description={description} action={chainPicker} />
        <div
          className="mt-3 flex flex-wrap items-center gap-2"
          role="group"
          aria-label="Recent items to show"
        >
          <span className="text-2xs text-content-subtle">Show</span>
          {CHAIN_OVERVIEW_RECENT_LIMITS.map((value) => (
            <Button
              key={value}
              variant={recentLimit === value ? "primary" : "secondary"}
              size="sm"
              aria-pressed={recentLimit === value}
              onClick={() => setRecentLimit(value)}
            >
              {value}
            </Button>
          ))}
        </div>
      </div>

      <div className="border-t border-line p-4">
        {feedPending ? (
          <div className="space-y-6" aria-busy="true" aria-label="Loading pipeline chains">
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
            title="Could not load pipeline chains"
            description={errorMessage(feedErr)}
            action={
              <Button variant="primary" size="sm" onClick={() => void refetchFeed()}>
                Try again
              </Button>
            }
          />
        ) : options.length === 0 ? (
          <EmptyState
            title="No pipeline chains to inspect"
            description="Training, shot and splat chains will appear here once a pipeline runs."
          />
        ) : isPending ? (
          <div className="space-y-6" aria-busy="true" aria-label="Loading chain overview">
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
            title="Could not load chain overview"
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
            description="The authoritative snapshot for this chain is not available right now."
          />
        ) : (
          <div className="space-y-6">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={identity.kindTone}>{identity.kindLabel}</Badge>
                <span className="min-w-0 truncate text-sm font-semibold text-content" title={identity.chainIdLabel}>
                  {identity.kindLabel} chain
                </span>
                <span className="text-2xs text-content-subtle">{identity.chainIdLabel}</span>
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
                {identity.projectName}
                {identity.createdLabel ? ` · created ${identity.createdLabel}` : ""}
                {` · by ${identity.createdByLabel}`}
              </p>
            </div>

            <StatGrid rows={stats} />

            {!hasChainOverviewData(data) ? (
              <EmptyState
                title="No linked chain activity"
                description="This chain has no linked jobs or assets yet."
              />
            ) : (
              <div className="grid gap-6 lg:grid-cols-2">
                <RecentJobs rows={jobs} />
                <RecentAssets rows={assets} onOpen={openAsset} />
              </div>
            )}

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
