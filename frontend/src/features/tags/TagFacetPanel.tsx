import { useState } from "react";
import { useTags } from "../../hooks/useQueries";
import { errorMessage } from "../../lib/errors";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card, SectionHeader } from "../../ui/Card";
import { EmptyState, Skeleton } from "../../ui/Feedback";
import {
  TAG_LIMITS,
  buildTagOptions,
  tagEmptyDescription,
  tagFacetItems,
  tagIndexSummary,
  type TagFacetItem,
} from "./tagHelpers";

interface TagFacetPanelProps {
  /** Scope the authoritative index to one project (the assets browser selection). */
  readonly projectId?: string;
  /** When provided, facets become buttons that apply the tag to a filter. */
  readonly onSelectTag?: (tag: string) => void;
}

function TagFacetRow({
  item,
  onSelect,
}: {
  readonly item: TagFacetItem;
  readonly onSelect?: (tag: string) => void;
}) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-3">
        <Badge tone={item.tone}>{item.name}</Badge>
        <span className="shrink-0 text-2xs text-content-subtle">{item.countLabel}</span>
      </div>
      <div className="mt-2 h-1 w-full overflow-hidden rounded bg-surface-overlay">
        <div
          className="h-full rounded bg-info"
          style={{ width: `${item.sharePercent}%` }}
          aria-hidden="true"
        />
      </div>
    </>
  );

  return onSelect ? (
    <li>
      <button
        type="button"
        onClick={() => onSelect(item.name)}
        title={`Filter assets by tag ${item.name}`}
        className="block w-full rounded-md border border-line bg-surface-raised p-3 text-left hover:border-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {body}
      </button>
    </li>
  ) : (
    <li className="rounded-md border border-line bg-surface-raised p-3">{body}</li>
  );
}

/**
 * Authoritative asset tag facets (C33/C36 follow-up). Backed by `useTags` so
 * the same view works in mock and live mode; renders explicit loading, error,
 * missing-data, empty and populated states with every display value derived in
 * `tagHelpers`. Project scoping comes from the assets browser selection and a
 * clicked facet can be applied to its search filter.
 */
export function TagFacetPanel({ projectId, onSelectTag }: TagFacetPanelProps) {
  const [prefix, setPrefix] = useState("");
  const [limit, setLimit] = useState(10);
  const { data, isPending, isError, error, refetch } = useTags(
    buildTagOptions(prefix, limit, projectId),
  );
  const items = tagFacetItems(data);
  const summary = tagIndexSummary(items, data?.total);

  return (
    <Card>
      <div className="p-4">
        <SectionHeader
          title="Tag facets"
          description={summary}
          action={
            <Button variant="secondary" size="sm" onClick={() => void refetch()}>
              Refresh
            </Button>
          }
        />
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="flex min-w-48 flex-1 flex-col gap-1 text-xs text-content-muted">
            Tag prefix
            <input
              value={prefix}
              onChange={(event) => setPrefix(event.target.value)}
              placeholder="Filter tags by prefix"
              className="h-9 rounded-md border border-line bg-surface px-3 text-sm text-content"
            />
          </label>
          <div className="flex items-center gap-2" role="group" aria-label="Tag facets to show">
            <span className="text-2xs text-content-subtle">Show</span>
            {TAG_LIMITS.map((value) => (
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
      </div>

      <div className="border-t border-line">
        {isPending ? (
          <div className="space-y-3 p-4" aria-busy="true" aria-label="Loading tag facets">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : isError ? (
          <div className="p-4">
            <EmptyState
              title="Could not load tag facets"
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
              title="Tag index unavailable"
              description="No tag index could be resolved right now."
            />
          </div>
        ) : items.length === 0 ? (
          <div className="p-4">
            <EmptyState title="No tags found" description={tagEmptyDescription(prefix)} />
          </div>
        ) : (
          <ul className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <TagFacetRow key={item.name} item={item} onSelect={onSelectTag} />
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
