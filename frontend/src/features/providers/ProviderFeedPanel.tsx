import { useState } from "react";
import { useProviderFeed } from "../../hooks/useQueries";
import { errorMessage } from "../../lib/errors";
import type { ProviderLocation, ProviderStatus } from "../../lib/types";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card, SectionHeader } from "../../ui/Card";
import { EmptyState, Skeleton } from "../../ui/Feedback";
import {
  buildProviderFeedOptions,
  providerFeedEmptyDescription,
  providerFeedGeneratedAtLabel,
  providerFeedLocationChipLabel,
  providerFeedRows,
  providerFeedStatusChipLabel,
  providerFeedSummary,
  PROVIDER_FEED_LIMITS,
  PROVIDER_FEED_LOCATION_FILTERS,
  PROVIDER_FEED_STATUS_FILTERS,
  type ProviderFeedRow,
} from "./providerFeedHelpers";

function ProviderRow({ row }: { readonly row: ProviderFeedRow }) {
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-content" title={row.id}>
          {row.name}
        </p>
        <p className="mt-0.5 truncate font-mono text-xs text-content-muted" title={row.id}>
          {row.id}
        </p>
        <p className="mt-1 truncate text-xs text-content-muted" title={row.operationPreview}>
          {row.operationPreview}
        </p>
        <div className="mt-2 flex flex-wrap gap-1">
          <Badge tone={row.locationTone}>{row.locationLabel}</Badge>
          <Badge tone={row.statusTone}>{row.statusLabel}</Badge>
          <Badge tone="info">{row.capabilityLabel}</Badge>
        </div>
      </div>
    </li>
  );
}

export interface ProviderFeedPanelProps {
  /** Active runtime-location filter; omitted renders all locations. */
  readonly location?: ProviderLocation;
  /** Active health-status filter; omitted renders all statuses. */
  readonly status?: ProviderStatus;
  /** When both change handlers are supplied the filters are controlled by the parent. */
  readonly onLocationChange?: (value: ProviderLocation | undefined) => void;
  readonly onStatusChange?: (value: ProviderStatus | undefined) => void;
  readonly title?: string;
  readonly description?: string;
}

/**
 * Authoritative provider feed (C185/C187/C188 follow-up), backed by the
 * `useProviderFeed` query hook so the same view works in mock and live mode.
 * Supports location/status/page-size filters and renders explicit loading,
 * error, missing-data, empty and populated states; every display value is
 * derived in `providerFeedHelpers`. Rows are ordered by name/ provider id (the
 * static registry has no registration timestamp), so there is no relative-time
 * column — only the feed's generated-at footer.
 */
export function ProviderFeedPanel({
  location,
  status,
  onLocationChange,
  onStatusChange,
  title = "Provider feed",
  description = "Providers projected from the authoritative registry, ordered by name.",
}: ProviderFeedPanelProps) {
  const [fallbackLocation, setFallbackLocation] = useState<ProviderLocation | undefined>(undefined);
  const [fallbackStatus, setFallbackStatus] = useState<ProviderStatus | undefined>(undefined);
  const [limit, setLimit] = useState(25);

  const controlled = onLocationChange !== undefined && onStatusChange !== undefined;
  const activeLocation = controlled ? location : fallbackLocation;
  const activeStatus = controlled ? status : fallbackStatus;
  const changeLocation = (value: ProviderLocation | undefined) => {
    if (onLocationChange) onLocationChange(value);
    else setFallbackLocation(value);
  };
  const changeStatus = (value: ProviderStatus | undefined) => {
    if (onStatusChange) onStatusChange(value);
    else setFallbackStatus(value);
  };

  const { data, isPending, isError, error, refetch } = useProviderFeed(
    buildProviderFeedOptions(activeLocation, activeStatus, limit),
  );
  const rows = providerFeedRows(data);
  const summary = providerFeedSummary(rows, data?.total);
  const generatedAt = providerFeedGeneratedAtLabel(data);
  const filtered = activeLocation !== undefined || activeStatus !== undefined;

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
          aria-label="Provider location filter"
        >
          <span className="text-2xs text-content-subtle">Location</span>
          {PROVIDER_FEED_LOCATION_FILTERS.map((value) => (
            <Button
              key={value ?? "all"}
              variant={activeLocation === value ? "primary" : "secondary"}
              size="sm"
              aria-pressed={activeLocation === value}
              onClick={() => changeLocation(value)}
            >
              {providerFeedLocationChipLabel(value)}
            </Button>
          ))}
        </div>
        <div
          className="mt-2 flex flex-wrap items-center gap-2"
          role="group"
          aria-label="Provider status filter"
        >
          <span className="text-2xs text-content-subtle">Status</span>
          {PROVIDER_FEED_STATUS_FILTERS.map((value) => (
            <Button
              key={value ?? "all"}
              variant={activeStatus === value ? "primary" : "secondary"}
              size="sm"
              aria-pressed={activeStatus === value}
              onClick={() => changeStatus(value)}
            >
              {providerFeedStatusChipLabel(value)}
            </Button>
          ))}
        </div>
        <div
          className="mt-2 flex flex-wrap items-center gap-2"
          role="group"
          aria-label="Providers to show"
        >
          <span className="text-2xs text-content-subtle">Show</span>
          {PROVIDER_FEED_LIMITS.map((value) => (
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
          <div className="space-y-3 p-4" aria-busy="true" aria-label="Loading provider feed">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : isError ? (
          <div className="p-4">
            <EmptyState
              title="Could not load provider feed"
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
              title="Provider feed unavailable"
              description="No provider feed could be resolved right now."
            />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-4">
            <EmptyState title="No providers in this scope" description={providerFeedEmptyDescription(filtered)} />
          </div>
        ) : (
          <>
            <ol className="divide-y divide-line">
              {rows.map((row) => (
                <ProviderRow key={row.id} row={row} />
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
