import { useState } from "react";
import { useCollaborationFeed, useCollaborationOverview } from "../../hooks/useQueries";
import { errorMessage } from "../../lib/errors";
import { useUiStore } from "../../stores/uiStore";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card, SectionHeader } from "../../ui/Card";
import { EmptyState, Skeleton } from "../../ui/Feedback";
import { ProgressBar } from "../../ui/ProgressBar";
import {
  COLLABORATION_OVERVIEW_LIMITS,
  buildCollaborationOverviewOptions,
  buildCollaborationOverviewPickerOptions,
  collaborationOverviewActiveOption,
  collaborationOverviewEmptyDescription,
  collaborationOverviewGeneratedAtLabel,
  collaborationOverviewIdentity,
  collaborationOverviewPickerOptions,
  collaborationOverviewRecentSignals,
  collaborationOverviewStateRows,
  collaborationOverviewStatRows,
  collaborationOverviewSummaryLabel,
  hasCollaborationOverviewData,
  type CollaborationOverviewIdentity,
  type CollaborationOverviewSibling,
  type CollaborationOverviewStat,
} from "./collaborationOverviewHelpers";
import type { CollaborationStateRow } from "./collaborationStatsHelpers";

function StatGrid({ rows }: { readonly rows: readonly CollaborationOverviewStat[] }) {
  return (
    <section aria-label="Collaboration snapshot" className="grid grid-cols-2 gap-3 md:grid-cols-4">
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

function IdentityHeader({ identity }: { readonly identity: CollaborationOverviewIdentity }) {
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={identity.signalTone}>{identity.signalLabel}</Badge>
        {identity.hasState ? <Badge tone={identity.stateTone}>{identity.stateLabel}</Badge> : null}
        <span className="min-w-0 truncate text-sm font-semibold text-content" title={identity.detail}>
          {identity.detail || identity.signalLabel}
        </span>
        <time className="shrink-0 text-2xs text-content-subtle">{identity.relativeTime}</time>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-content-muted">
        {identity.projectLabel ? <span>{identity.projectLabel}</span> : null}
        {identity.actorLabel ? <span className="font-mono text-2xs">{identity.actorLabel}</span> : null}
      </div>
    </div>
  );
}

function StateRows({ rows }: { readonly rows: readonly CollaborationStateRow[] }) {
  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.state} className="flex items-center gap-3">
          <span className="w-16 shrink-0">
            <Badge tone={row.tone}>{row.label}</Badge>
          </span>
          <ProgressBar value={row.fraction} label={`${row.label} share`} className="flex-1" />
          <span className="w-8 shrink-0 text-right text-xs tabular-nums text-content">{row.count}</span>
          <span className="w-9 shrink-0 text-right text-2xs tabular-nums text-content-subtle">
            {row.percent}%
          </span>
        </li>
      ))}
    </ul>
  );
}

function RecentSiblings({ rows }: { readonly rows: readonly CollaborationOverviewSibling[] }) {
  return (
    <section aria-label="Recent signals in this project" className="rounded-md border border-line p-4">
      <h3 className="mb-3 text-sm font-medium text-content">Newest signals in this project</h3>
      {rows.length === 0 ? (
        <p className="text-xs text-content-muted">No sibling signals for this snapshot yet.</p>
      ) : (
        <ol className="space-y-2">
          {rows.map((row) => (
            <li
              key={row.id}
              className={`flex flex-wrap items-start gap-x-3 gap-y-1 rounded-sm px-1 py-0.5 ${row.isCurrent ? "bg-accent-muted" : ""}`}
              aria-current={row.isCurrent ? "true" : undefined}
            >
              <span className="w-16 shrink-0">
                <Badge tone={row.signalTone}>{row.signalLabel}</Badge>
              </span>
              <span className="min-w-0 flex-1 truncate text-xs text-content" title={row.detail}>
                {row.hasState ? (
                  <>
                    {row.actorLabel} is <Badge tone={row.stateTone}>{row.stateLabel}</Badge>
                  </>
                ) : (
                  <span title={row.detail}>{row.detail || row.actorLabel}</span>
                )}
              </span>
              <time className="shrink-0 text-2xs text-content-subtle" dateTime={row.timestamp}>
                {row.relativeTime}
              </time>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export interface CollaborationOverviewPanelProps {
  /** Optional project scope for the picker; omitted renders the workspace-wide feed. */
  readonly projectId?: string;
  readonly title?: string;
  readonly description?: string;
}

/**
 * Authoritative single collaboration-signal overview (C294/C296/C297 follow-up),
 * backed by the `useCollaborationOverview` query hook so the same view works in
 * mock and live mode. The picker is fed by the authoritative `useCollaborationFeed`
 * for the active project scope. Renders explicit loading, error, missing-data,
 * empty and populated states; every display value is derived in
 * `collaborationOverviewHelpers`. The project link deep-links to the existing
 * project-detail screen and comment signals referencing an asset also link to the
 * asset detail panel (scoping the assets browser first). No new route is added.
 */
export function CollaborationOverviewPanel({
  projectId,
  title = "Collaboration overview",
  description = "Select a presence or comment signal to inspect its identity, project activity and newest siblings.",
}: CollaborationOverviewPanelProps) {
  const navigate = useUiStore((state) => state.navigate);
  const setAssetsProjectId = useUiStore((state) => state.setAssetsProjectId);
  const [selectedValue, setSelectedValue] = useState("");
  const [recentLimit, setRecentLimit] = useState(COLLABORATION_OVERVIEW_LIMITS[0]);

  const {
    data: feed,
    isPending: feedPending,
    isError: feedError,
    error: feedErr,
    refetch: refetchFeed,
  } = useCollaborationFeed(buildCollaborationOverviewPickerOptions(projectId));

  const options = collaborationOverviewPickerOptions(feed);
  // Fall back to the first signal when the current selection disappears (e.g. the
  // feed refreshed) without an effect fighting the query cache.
  const active = collaborationOverviewActiveOption(options, selectedValue);

  const { data, isPending, isError, error, refetch } = useCollaborationOverview(
    active?.signalKey ?? "",
    buildCollaborationOverviewOptions(recentLimit),
  );

  const identity = collaborationOverviewIdentity(data);
  const stats = collaborationOverviewStatRows(data);
  const states = collaborationOverviewStateRows(data);
  const siblings = collaborationOverviewRecentSignals(data);
  const generatedAt = collaborationOverviewGeneratedAtLabel(data);
  const summary = collaborationOverviewSummaryLabel(data);
  const overviewAssetId = data?.asset_id ?? null;

  const picker = (
    <label className="flex items-center gap-2 text-xs text-content-muted">
      <span>Signal</span>
      <select
        aria-label="Select a collaboration signal to inspect"
        className="h-8 max-w-96 rounded-md border border-line-strong bg-surface-raised px-2 text-xs text-content"
        value={active?.value ?? ""}
        onChange={(event) => setSelectedValue(event.target.value)}
        disabled={options.length === 0}
      >
        {options.length === 0 ? <option value="">No collaboration signals</option> : null}
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
        <SectionHeader title={title} description={description} action={picker} />
        <div
          className="mt-3 flex flex-wrap items-center gap-2"
          role="group"
          aria-label="Sibling signals shown"
        >
          <span className="text-2xs text-content-subtle">Siblings</span>
          {COLLABORATION_OVERVIEW_LIMITS.map((value) => (
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
          <div className="space-y-6" aria-busy="true" aria-label="Loading collaboration signals">
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
            title="Could not load collaboration signals"
            description={errorMessage(feedErr)}
            action={
              <Button variant="primary" size="sm" onClick={() => void refetchFeed()}>
                Try again
              </Button>
            }
          />
        ) : options.length === 0 ? (
          <EmptyState
            title="No collaboration signals to inspect"
            description={collaborationOverviewEmptyDescription(Boolean(projectId))}
          />
        ) : isPending ? (
          <div className="space-y-6" aria-busy="true" aria-label="Loading collaboration overview">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} className="h-20" />
              ))}
            </div>
            <Skeleton className="h-40" />
          </div>
        ) : isError ? (
          <EmptyState
            title="Could not load collaboration overview"
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
            description="The authoritative snapshot for this collaboration signal is not available right now."
          />
        ) : !hasCollaborationOverviewData(data) ? (
          <EmptyState
            title="No recorded collaboration"
            description="This signal's project has no collaboration activity to summarize yet."
          />
        ) : (
          <div className="space-y-6">
            <IdentityHeader identity={identity} />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate("projects", { projectId: data.project_id })}
              >
                Open project
              </Button>
              {overviewAssetId ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setAssetsProjectId(data.project_id);
                    navigate("assets", { assetId: overviewAssetId });
                  }}
                >
                  Open asset
                </Button>
              ) : null}
            </div>

            <StatGrid rows={stats} />

            <section aria-label="Signals by presence state" className="rounded-md border border-line p-4">
              <h3 className="mb-3 text-sm font-medium text-content">Signals by presence state</h3>
              <StateRows rows={states} />
            </section>

            <RecentSiblings rows={siblings} />

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
