import { useMemo, useState } from "react";
import type { Asset, Project } from "../../lib/types";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card, SectionHeader } from "../../ui/Card";
import { EmptyState } from "../../ui/Feedback";
import { exportSummary, exportTone, type ExportTarget } from "./exportHelpers";
import { buildExportRows } from "./exportHelpers";

interface ExportPanelProps {
  readonly assets: readonly Asset[];
  readonly project: Project | undefined;
}

const TARGET_FILTERS: readonly { readonly id: ExportTarget | "all"; readonly label: string }[] = [
  { id: "all", label: "All" },
  { id: "unreal", label: "Unreal" },
  { id: "blender", label: "Blender" },
];

export function ExportPanel({ assets, project }: ExportPanelProps) {
  const rows = useMemo(() => buildExportRows(assets, project), [assets, project]);
  const [filter, setFilter] = useState<ExportTarget | "all">("all");

  return (
    <Card>
      <div className="p-4">
        <SectionHeader
          title="Engine export paths"
          description={`${exportSummary(rows)}. Paths are provisional UI conventions until an export endpoint lands.`}
          action={
            <div className="flex gap-1">
              {TARGET_FILTERS.map((item) => (
                <Button
                  key={item.id}
                  variant={filter === item.id ? "primary" : "ghost"}
                  size="sm"
                  onClick={() => setFilter(item.id)}
                >
                  {item.label}
                </Button>
              ))}
            </div>
          }
        />
      </div>
      {rows.length === 0 ? (
        <div className="border-t border-line p-4">
          <EmptyState
            title="Nothing to export yet"
            description="Publish an asset first; published deliverables are the export source."
          />
        </div>
      ) : (
        <ul className="divide-y divide-line border-t border-line">
          {rows.map((row) => (
            <li key={row.assetId} className="space-y-2 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-medium text-content" title={row.assetName}>
                  {row.assetName}
                </p>
                <Badge tone="neutral">{row.assetType}</Badge>
              </div>
              <p className="truncate font-mono text-2xs text-content-subtle" title={row.sourceKey}>
                source: {row.sourceKey}
              </p>
              <ul className="space-y-1">
                {row.targets
                  .filter((target) => filter === "all" || target.target === filter)
                  .map((target) => (
                    <li key={target.target} className="flex items-center gap-2">
                      <Badge tone={exportTone(target.ready)}>{target.ready ? "ready" : "n/a"}</Badge>
                      <span className="w-24 shrink-0 text-xs text-content-muted">{target.label}</span>
                      <code className="truncate text-2xs text-content" title={target.path}>
                        {target.path}
                      </code>
                    </li>
                  ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
