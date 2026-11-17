import { useMemo } from "react";
import type { Asset } from "../../lib/types";
import { Badge } from "../../ui/Badge";
import { Card, SectionHeader } from "../../ui/Card";
import { EmptyState } from "../../ui/Feedback";
import { buildGraphLayers, graphSummary } from "./graphHelpers";

interface LineageGraphProps {
  readonly assets: readonly Asset[];
}

export function LineageGraph({ assets }: LineageGraphProps) {
  const layers = useMemo(() => buildGraphLayers(assets), [assets]);

  return (
    <Card>
      <div className="p-4">
        <SectionHeader
          title="Lineage graph"
          description={`Dependency graph derived from asset parent/child provenance. ${graphSummary(layers)}. The authoritative activity feed is shown separately.`}
        />
      </div>
      {layers.length === 0 ? (
        <div className="border-t border-line p-4">
          <EmptyState
            title="No lineage edges"
            description="Assets with parent_asset_ids will appear as connected graph nodes."
          />
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto border-t border-line p-4">
          {layers.map((layer, index) => (
            <section
              key={layer.depth}
              aria-label={layer.label}
              className="min-w-52 flex-1 rounded-md border border-line bg-surface-raised p-3"
            >
              <div className="mb-3 flex items-center gap-2">
                <Badge tone="info">{String(index + 1)}</Badge>
                <h3 className="truncate text-xs font-semibold text-content" title={layer.label}>
                  {layer.label}
                </h3>
              </div>
              <ul className="space-y-2">
                {layer.nodes.map((node) => (
                  <li key={node.id} className="rounded border border-line bg-surface p-2">
                    <p className="truncate text-xs font-medium text-content" title={node.name}>
                      {node.name}
                    </p>
                    <p className="mt-1 text-2xs text-content-subtle">
                      {node.parentIds.length} parents · {node.childIds.length} children
                    </p>
                    {node.operationId ? (
                      <p className="mt-1 truncate text-2xs text-info" title={node.operationId}>
                        {node.operationId}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Card>
  );
}
