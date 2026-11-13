import type { Asset } from "../../lib/types";
import { Badge } from "../../ui/Badge";
import { Card, SectionHeader } from "../../ui/Card";
import { EmptyState } from "../../ui/Feedback";
import {
  assetParentsLabel,
  buildLineageStages,
  lineageChainSummary,
  provenanceSummary,
} from "./helpers";

interface LineageViewProps {
  readonly assets: readonly Asset[];
}

function AssetLineageCard({
  asset,
  byId,
}: {
  readonly asset: Asset;
  readonly byId: ReadonlyMap<string, Asset>;
}) {
  const preview = asset.preview_url ?? asset.thumbnail_url;
  return (
    <li className="rounded-md border border-line bg-surface-raised p-3">
      <div className="flex gap-3">
        {preview ? (
          <img
            src={preview}
            alt={asset.name}
            className="h-16 w-20 rounded object-cover"
            loading="lazy"
          />
        ) : (
          <div className="grid h-16 w-20 place-items-center rounded bg-surface-overlay text-2xs uppercase text-content-subtle">
            {asset.type}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-sm font-medium text-content" title={asset.name}>
              {asset.name}
            </p>
            <Badge tone="neutral">{asset.type}</Badge>
          </div>
          <p className="mt-1 text-xs text-content-muted">{provenanceSummary(asset)}</p>
          <p className="mt-1 text-xs text-content-subtle">
            Parents: {assetParentsLabel(asset, byId)}
          </p>
        </div>
      </div>
    </li>
  );
}

export function LineageView({ assets }: LineageViewProps) {
  const stages = buildLineageStages(assets);
  const byId = new Map(assets.map((a) => [a.id, a]));
  return (
    <Card>
      <div className="p-4">
        <SectionHeader
          title="Lineage"
          description={`Design → dataset → LoRA → frames → video. Chain: ${lineageChainSummary(stages)}`}
        />
      </div>
      {assets.length === 0 ? (
        <div className="border-t border-line p-4">
          <EmptyState title="No lineage" description="No assets available to derive lineage." />
        </div>
      ) : stages.length === 0 ? (
        <div className="border-t border-line p-4">
          <EmptyState
            title="No lineage stages"
            description="Assets do not form a recognizable pipeline chain."
          />
        </div>
      ) : (
        <div className="space-y-4 border-t border-line p-4">
          {stages.map((stage, index) => (
            <section key={stage.key} aria-label={`${stage.label} stage`}>
              <div className="mb-2 flex items-center gap-2">
                <Badge tone="info">{String(index + 1)}</Badge>
                <h3 className="text-sm font-semibold text-content">{stage.label}</h3>
                <span className="text-xs text-content-muted">({stage.assets.length})</span>
              </div>
              <ul className="grid gap-2 md:grid-cols-2">
                {stage.assets.map((asset) => (
                  <AssetLineageCard key={asset.id} asset={asset} byId={byId} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Card>
  );
}
