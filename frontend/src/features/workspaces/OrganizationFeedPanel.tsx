import { useState } from "react";
import { useOrganizationFeed } from "../../hooks/useQueries";
import { errorMessage } from "../../lib/errors";
import { Button } from "../../ui/Button";
import { Card, SectionHeader } from "../../ui/Card";
import { EmptyState, Skeleton } from "../../ui/Feedback";
import { Badge } from "../../ui/Badge";
import {
  buildOrganizationFeedOptions,
  organizationFeedEmptyDescription,
  organizationFeedGeneratedAtLabel,
  organizationFeedRows,
  organizationFeedSummary,
  ORGANIZATION_FEED_LIMITS,
  type OrganizationFeedRow,
} from "./organizationFeedHelpers";

function OrganizationRow({ row }: { readonly row: OrganizationFeedRow }) {
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-content" title={row.name}>
          {row.name}
        </p>
        <p className="mt-1 truncate text-xs text-content-muted" title={row.slug}>
          @{row.slug}
        </p>
        <div className="mt-2 flex flex-wrap gap-1">
          <Badge tone="neutral">{row.memberLabel}</Badge>
          <Badge tone="info">{row.projectLabel}</Badge>
        </div>
      </div>
      <time className="shrink-0 text-2xs text-content-subtle" dateTime={row.timestamp}>
        {row.relativeTime}
      </time>
    </li>
  );
}

export interface OrganizationFeedPanelProps {
  readonly title?: string;
  readonly description?: string;
}

/**
 * Authoritative organization feed (C161/C163/C164 follow-up), backed by the
 * `useOrganizationFeed` query hook so the same view works in mock and live mode.
 * Renders explicit loading, error, missing-data, empty and populated states;
 * every display value is derived in `organizationFeedHelpers`. There is no
 * organization-detail route, so rows stay read-only rather than deep-linking to
 * an unrelated screen.
 */
export function OrganizationFeedPanel({
  title = "Organizations",
  description = "Newest-first organizations derived from the authoritative organization store.",
}: OrganizationFeedPanelProps) {
  const [limit, setLimit] = useState(25);
  const { data, isPending, isError, error, refetch } = useOrganizationFeed(
    buildOrganizationFeedOptions(limit),
  );
  const rows = organizationFeedRows(data);
  const summary = organizationFeedSummary(rows, data?.total);
  const generatedAt = organizationFeedGeneratedAtLabel(data);

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
          aria-label="Organizations to show"
        >
          <span className="text-2xs text-content-subtle">Show</span>
          {ORGANIZATION_FEED_LIMITS.map((value) => (
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
          <div className="space-y-3 p-4" aria-busy="true" aria-label="Loading organizations">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : isError ? (
          <div className="p-4">
            <EmptyState
              title="Could not load organizations"
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
              title="Organization feed unavailable"
              description="No organization feed could be resolved right now."
            />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-4">
            <EmptyState title="No organizations yet" description={organizationFeedEmptyDescription()} />
          </div>
        ) : (
          <>
            <ol className="divide-y divide-line">
              {rows.map((row) => (
                <OrganizationRow key={row.id} row={row} />
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
