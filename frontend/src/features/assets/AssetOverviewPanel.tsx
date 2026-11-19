import { useAssetOverview } from "../../hooks/useQueries";
import { errorMessage } from "../../lib/errors";
import { useUiStore } from "../../stores/uiStore";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card, SectionHeader } from "../../ui/Card";
import { EmptyState, Skeleton } from "../../ui/Feedback";
import type { AssetOverviewCountRow, AssetOverviewVersionRow } from "./assetOverviewHelpers";
import {
  assetOverviewCountRows,
  assetOverviewGeneratedAtLabel,
  assetOverviewIdentity,
  assetOverviewRecentVersions,
  assetOverviewSummaryLabel,
  hasAssetOverviewData,
} from "./assetOverviewHelpers";

function CountGrid({ rows }: { readonly rows: readonly AssetOverviewCountRow[] }) {
  return (
    <section aria-label="Cross-domain counts" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
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

function RecentVersions({
  rows,
}: {
  readonly rows: readonly AssetOverviewVersionRow[];
}) {
  return (
    <section aria-label="Recent versions" className="rounded-md border border-line p-4">
      <h3 className="mb-3 text-sm font-medium text-content">Recent versions</h3>
      {rows.length === 0 ? (
        <p className="text-xs text-content-muted">No version records for this asset yet.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center gap-3">
              <Badge tone="info">{row.versionLabel}</Badge>
              <span className="shrink-0 text-2xs tabular-nums text-content-muted">{row.bytesLabel}</span>
              <span className="min-w-0 flex-1 truncate text-2xs text-content-subtle" title={row.creatorLabel}>
                {row.creatorLabel}
              </span>
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

export interface AssetOverviewPanelProps {
  readonly assetId: string;
  readonly title?: string;
  readonly description?: string;
}

/**
 * Authoritative single-asset overview (C205/C207/C208 follow-up), backed by the
 * `useAssetOverview` query hook so the same view works in mock and live mode.
 * Renders explicit loading, error, missing-data, empty and populated states;
 * every display value is derived in `assetOverviewHelpers`. Recent version rows
 * stay read-only because there is no version-detail route; the project link
 * deep-links to the existing project-detail screen.
 */
export function AssetOverviewPanel({
  assetId,
  title = "Asset overview snapshot",
  description = "Compact authoritative snapshot: cross-domain counts and the newest version records, derived from the asset stores.",
}: AssetOverviewPanelProps) {
  const navigate = useUiStore((s) => s.navigate);
  const { data, isPending, isError, error, refetch } = useAssetOverview(assetId);
  const identity = assetOverviewIdentity(data);
  const counts = assetOverviewCountRows(data);
  const versions = assetOverviewRecentVersions(data);
  const generatedAt = assetOverviewGeneratedAtLabel(data);
  const summary = assetOverviewSummaryLabel(data);

  return (
    <Card>
      <div className="p-4">
        <SectionHeader title={title} description={description} />
      </div>
      <div className="border-t border-line p-4">
        {isPending ? (
          <div className="space-y-6" aria-busy="true" aria-label="Loading asset overview">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {Array.from({ length: 5 }, (_, index) => (
                <Skeleton key={index} className="h-20" />
              ))}
            </div>
            <Skeleton className="h-40" />
          </div>
        ) : isError ? (
          <EmptyState
            title="Could not load asset overview"
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
            description="The authoritative snapshot for this asset is not available right now."
          />
        ) : !hasAssetOverviewData(data) ? (
          <EmptyState
            title="No asset activity yet"
            description="This asset has no counted relationships, versions or publish record."
          />
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 truncate text-sm font-semibold text-content" title={identity.name}>
                {identity.name}
              </span>
              <Badge tone={identity.typeTone}>{identity.typeLabel}</Badge>
              <Badge tone={identity.statusTone}>{identity.statusLabel}</Badge>
              <Badge tone="info">{identity.versionLabel}</Badge>
              <Badge tone={identity.publishedTone}>{identity.publishedLabel}</Badge>
              {identity.projectLabel ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => navigate("projects", { projectId: data.project_id })}
                >
                  {identity.projectLabel}
                </Button>
              ) : null}
              {identity.createdLabel ? (
                <span className="text-2xs text-content-muted">Created {identity.createdLabel}</span>
              ) : null}
              {summary ? <span className="text-2xs text-content-subtle">{summary}</span> : null}
            </div>
            <CountGrid rows={counts} />
            <RecentVersions rows={versions} />
            {generatedAt ? (
              <p className="text-2xs text-content-subtle">Snapshot generated {generatedAt}.</p>
            ) : null}
          </div>
        )}
      </div>
    </Card>
  );
}
