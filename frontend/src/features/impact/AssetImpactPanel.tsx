import { useState } from "react";
import { useAssetImpact } from "../../hooks/useQueries";
import { errorMessage } from "../../lib/errors";
import type { Asset } from "../../lib/types";
import { useUiStore } from "../../stores/uiStore";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card, SectionHeader } from "../../ui/Card";
import { EmptyState, Skeleton } from "../../ui/Feedback";
import {
  IMPACT_DEPTH_CHIPS,
  buildImpactOptions,
  impactEmptyDescription,
  impactRows,
  impactSummary,
  type ImpactRow,
} from "./impactHelpers";

interface AssetImpactPanelProps {
  readonly assetId: string;
  /** Siblings used to resolve descendant ids to readable asset names. */
  readonly assets?: readonly Asset[];
}

function ImpactRowView({
  row,
  onOpen,
}: {
  readonly row: ImpactRow;
  readonly onOpen: (assetId: string) => void;
}) {
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <Badge tone={row.tone}>{row.depthLabel}</Badge>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-content" title={row.id}>
          {row.label}
        </p>
        <p className="text-xs text-content-subtle">{row.relationshipLabel}</p>
      </div>
      <Button variant="secondary" size="sm" onClick={() => onOpen(row.id)}>
        Open
      </Button>
    </li>
  );
}

/**
 * Downstream asset impact (C34/C37 follow-up). Backed by `useAssetImpact` so
 * the same view works in mock and live mode; renders explicit loading, error,
 * missing-root, empty and populated states with every display value derived in
 * `impactHelpers`. Rows select the descendant asset on the existing assets deep
 * link, enabling step-through of the generated lineage chain.
 */
export function AssetImpactPanel({ assetId, assets }: AssetImpactPanelProps) {
  const [maxDepth, setMaxDepth] = useState(5);
  const selectAsset = useUiStore((state) => state.selectAsset);
  const { data, isPending, isError, error, refetch } = useAssetImpact(
    assetId,
    buildImpactOptions(maxDepth),
  );
  const rows = impactRows(data, assets);
  const summary = impactSummary(data, rows);

  return (
    <Card>
      <div className="p-4">
        <SectionHeader
          title="Downstream impact"
          description={summary}
          action={
            <Button variant="secondary" size="sm" onClick={() => void refetch()}>
              Refresh
            </Button>
          }
        />
        <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="Impact search depth">
          <span className="text-2xs text-content-subtle">Max depth</span>
          {IMPACT_DEPTH_CHIPS.map((value) => (
            <Button
              key={value}
              variant={maxDepth === value ? "primary" : "secondary"}
              size="sm"
              aria-pressed={maxDepth === value}
              onClick={() => setMaxDepth(value)}
            >
              {value}
            </Button>
          ))}
        </div>
      </div>

      <div className="border-t border-line">
        {isPending ? (
          <div className="space-y-3 p-4" aria-busy="true" aria-label="Loading downstream impact">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : isError ? (
          <div className="p-4">
            <EmptyState
              title="Could not load downstream impact"
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
              title="Impact unavailable"
              description="This asset could not be resolved for a downstream impact query."
            />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-4">
            <EmptyState title="No downstream assets" description={impactEmptyDescription()} />
          </div>
        ) : (
          <ol className="divide-y divide-line">
            {rows.map((row) => (
              <ImpactRowView key={row.id} row={row} onOpen={selectAsset} />
            ))}
          </ol>
        )}
      </div>
    </Card>
  );
}
