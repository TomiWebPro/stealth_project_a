import { useMemo } from "react";
import type { Asset, Job } from "../../lib/types";
import { PageHeader } from "../../layout/AppLayout";
import { Badge } from "../../ui/Badge";
import { Card, SectionHeader } from "../../ui/Card";
import { EmptyState } from "../../ui/Feedback";
import { formatRelative } from "../home/format";
import {
  auditTrailSummary,
  buildAuditTrail,
  buildGraphLayers,
  graphSummary,
} from "./graphHelpers";

interface LineageGraphProps {
  readonly assets: readonly Asset[];
  readonly jobs: readonly Job[];
}

export function LineageGraph({ assets, jobs }: LineageGraphProps) {
  const layers = useMemo(() => buildGraphLayers(assets), [assets]);
  const events = useMemo(() => buildAuditTrail(assets, jobs), [assets, jobs]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lineage graph & audit trail"
        description="Parent/child edges derived from asset provenance and a chronological activity log."
      />

      <Card>
        <div className="p-4">
          <SectionHeader title="Dependency graph" description={graphSummary(layers)} />
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

      <Card>
        <div className="p-4">
          <SectionHeader title="Audit trail" description={auditTrailSummary(events)} />
        </div>
        {events.length === 0 ? (
          <div className="border-t border-line p-4">
            <EmptyState title="No audit events" description="Asset creation, publishing and jobs are recorded here." />
          </div>
        ) : (
          <ol className="divide-y divide-line border-t border-line">
            {events.map((event) => (
              <li key={event.id} className="flex items-start gap-3 px-4 py-3">
                <Badge tone={event.tone}>{event.kind}</Badge>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-content" title={event.label}>
                    {event.label}
                  </p>
                  <p className="truncate text-xs text-content-muted" title={event.detail}>
                    {event.detail}
                  </p>
                </div>
                <time className="shrink-0 text-2xs text-content-subtle" dateTime={event.timestamp}>
                  {formatRelative(event.timestamp)}
                </time>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}
