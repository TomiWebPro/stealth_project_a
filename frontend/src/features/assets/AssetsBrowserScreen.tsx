import { useMemo, useState } from "react";
import { useAssetsByProject, useProjects } from "../../hooks/useQueries";
import { errorMessage } from "../../lib/errors";
import type { Asset, AssetType } from "../../lib/types";
import { PageHeader } from "../../layout/AppLayout";
import { useUiStore } from "../../stores/uiStore";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card, SectionHeader } from "../../ui/Card";
import { EmptyState, Skeleton } from "../../ui/Feedback";
import {
  ASSET_TYPES,
  assetPreviewUrl,
  assetStorageLabel,
  assetTypeTone,
  filterAssets,
  formatAssetMeta,
  groupAssetsByShot,
  isPublishAsset,
  shotGroupSummary,
} from "./helpers";
import { AssetDetailPanel } from "./AssetDetailPanel";
import { AssetStatsPanel } from "./AssetStatsPanel";
import { VersionStatsPanel } from "./VersionStatsPanel";
import { VersionPanel } from "./VersionPanel";
import { TagFacetPanel } from "../tags/TagFacetPanel";

type ViewMode = "grid" | "list";

interface AssetItemProps {
  readonly asset: Asset;
  readonly onSelect: (assetId: string) => void;
}

function AssetGridItem({ asset, onSelect }: AssetItemProps) {
  const preview = assetPreviewUrl(asset);
  return (
    <li className="overflow-hidden rounded-md border border-line bg-surface-raised">
      <div className="aspect-4/3 bg-surface-overlay">
        {preview ? (
          <img src={preview} alt={asset.name} loading="lazy" className="size-full object-cover" />
        ) : (
          <div className="grid size-full place-items-center text-2xs uppercase tracking-wider text-content-subtle">
            {asset.type}
          </div>
        )}
      </div>
      <div className="space-y-1 p-2">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-xs font-medium text-content" title={asset.name}>
            {asset.name}
          </p>
          <Badge tone={assetTypeTone(asset.type)}>{asset.type}</Badge>
        </div>
        <p className="truncate text-2xs text-content-muted" title={assetStorageLabel(asset)}>
          {assetStorageLabel(asset)}
        </p>
        <div className="flex flex-wrap items-center gap-1">
          {isPublishAsset(asset) ? <Badge tone="success">Publish</Badge> : <Badge tone="neutral">Output</Badge>}
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => onSelect(asset.id)}>
            Details
          </Button>
        </div>
      </div>
    </li>
  );
}

function AssetListItem({ asset, onSelect }: AssetItemProps) {
  const preview = assetPreviewUrl(asset);
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <div className="h-12 w-16 shrink-0 overflow-hidden rounded bg-surface-overlay">
        {preview ? (
          <img src={preview} alt={asset.name} className="size-full object-cover" loading="lazy" />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-content">{asset.name}</p>
        <p className="truncate text-xs text-content-muted">{formatAssetMeta(asset)}</p>
        <p className="truncate text-2xs text-content-subtle">{assetStorageLabel(asset)}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {isPublishAsset(asset) ? <Badge tone="success">Publish</Badge> : <Badge tone="neutral">Output</Badge>}
        <Badge tone={assetTypeTone(asset.type)}>{asset.type}</Badge>
        <Button variant="ghost" size="sm" onClick={() => onSelect(asset.id)}>
          Details
        </Button>
      </div>
    </li>
  );
}

function AssetsContent({ projectId }: { readonly projectId: string }) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<AssetType | "all">("all");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const selectedAssetId = useUiStore((state) => state.selectedAssetId);
  const setSelectedAssetId = useUiStore((state) => state.selectAsset);
  const { data, isPending, isError, error, refetch } = useAssetsByProject(projectId);

  const filtered = useMemo(
    () => (data ? filterAssets(data, search, typeFilter) : []),
    [data, search, typeFilter],
  );
  const shotGroups = useMemo(() => groupAssetsByShot(filtered), [filtered]);

  if (isPending) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading assets">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <Card className="p-6">
        <EmptyState
          title="Could not load assets"
          description={errorMessage(error)}
          action={
            <Button variant="primary" size="sm" onClick={() => void refetch()}>
              Try again
            </Button>
          }
        />
      </Card>
    );
  }

  const assets = data ?? [];
  const selectedAsset = assets.find((asset) => asset.id === selectedAssetId) ?? null;
  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-48 flex-1 flex-col gap-1 text-xs text-content-muted">
            Search
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, type, tag, or path"
              className="h-9 rounded-md border border-line bg-surface px-3 text-sm text-content"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-content-muted">
            Type
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as AssetType | "all")}
              className="h-9 rounded-md border border-line bg-surface px-3 text-sm text-content"
            >
              <option value="all">All types</option>
              {ASSET_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-2">
            <Button
              variant={viewMode === "grid" ? "primary" : "secondary"}
              size="sm"
              onClick={() => setViewMode("grid")}
            >
              Grid
            </Button>
            <Button
              variant={viewMode === "list" ? "primary" : "secondary"}
              size="sm"
              onClick={() => setViewMode("list")}
            >
              List
            </Button>
          </div>
        </div>
      </Card>

      <TagFacetPanel projectId={projectId} onSelectTag={setSearch} />

      <AssetStatsPanel
        projectId={projectId}
        title="Project asset stats"
        description="Authoritative inventory metrics scoped to this project."
      />

      <VersionStatsPanel
        projectId={projectId}
        title="Project version stats"
        description="Authoritative asset version metrics scoped to this project."
      />

      <Card>
        <div className="p-4">
          <SectionHeader
            title="Assets"
            description={`${filtered.length} of ${assets.length} shown`}
            action={
              <Button variant="secondary" size="sm" onClick={() => void refetch()}>
                Refresh
              </Button>
            }
          />
        </div>
        {assets.length === 0 ? (
          <div className="border-t border-line p-4">
            <EmptyState
              title="No assets in this project"
              description="Assets will appear here once generated or imported."
            />
          </div>
        ) : filtered.length === 0 ? (
          <div className="border-t border-line p-4">
            <EmptyState
              title="No matching assets"
              description="Try adjusting search or type filters."
            />
          </div>
        ) : viewMode === "grid" ? (
          <ul className="grid grid-cols-2 gap-3 border-t border-line p-4 sm:grid-cols-3 lg:grid-cols-4">
            {filtered.map((asset) => (
              <AssetGridItem key={asset.id} asset={asset} onSelect={setSelectedAssetId} />
            ))}
          </ul>
        ) : (
          <ul className="divide-y divide-line border-t border-line">
            {filtered.map((asset) => (
              <AssetListItem key={asset.id} asset={asset} onSelect={setSelectedAssetId} />
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <div className="p-4">
          <SectionHeader
            title="Shot/sequence browser"
            description={`${shotGroupSummary(shotGroups)} grouped by metadata.sequence/shot (s01_c01 style).`}
          />
        </div>
        {shotGroups.length === 0 ? (
          <div className="border-t border-line p-4">
            <EmptyState
              title="No shot-tagged assets"
              description="Assets with metadata.sequence or metadata.shot will appear grouped here."
            />
          </div>
        ) : (
          <div className="space-y-4 border-t border-line p-4">
            {shotGroups.map((group) => (
              <section key={group.key} aria-label={`Shot group ${group.label}`}>
                <div className="mb-2 flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-content">{group.label}</h3>
                  <Badge tone="info">{String(group.assets.length)}</Badge>
                </div>
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {group.assets.map((asset) => (
                    <AssetGridItem key={asset.id} asset={asset} onSelect={setSelectedAssetId} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </Card>

      {selectedAsset ? (
        <AssetDetailPanel key={selectedAsset.id} asset={selectedAsset} assets={assets} />
      ) : (
        <Card className="p-4">
          <EmptyState
            title="No asset selected"
            description="Choose an asset above to view its details and edit metadata."
          />
        </Card>
      )}

      <VersionPanel assets={filtered} />
    </div>
  );
}

export function AssetsBrowserScreen() {
  const projectsQuery = useProjects();
  const assetsProjectId = useUiStore((s) => s.assetsProjectId);
  const setAssetsProjectId = useUiStore((s) => s.setAssetsProjectId);
  const projects = projectsQuery.data ?? [];
  const selectedId = assetsProjectId ?? projects[0]?.id ?? null;

  return (
    <div>
      <PageHeader
        title="Assets"
        description="Browse project assets with grid/list views, search, and filters."
      />
      {projectsQuery.isPending ? <Skeleton className="h-40" /> : null}
      {projectsQuery.isError ? (
        <Card className="p-6">
          <EmptyState
            title="Could not load projects"
            description={errorMessage(projectsQuery.error)}
            action={
              <Button variant="primary" size="sm" onClick={() => void projectsQuery.refetch()}>
                Try again
              </Button>
            }
          />
        </Card>
      ) : null}
      {projectsQuery.data ? (
        projects.length === 0 ? (
          <Card className="p-6">
            <EmptyState title="No projects" description="Create or seed a project to browse assets." />
          </Card>
        ) : (
          <div className="space-y-4">
            <Card className="p-4">
              <label className="flex max-w-md flex-col gap-1 text-xs text-content-muted">
                Project
                <select
                  value={selectedId ?? ""}
                  onChange={(e) => setAssetsProjectId(e.target.value || null)}
                  className="h-9 rounded-md border border-line bg-surface px-3 text-sm text-content"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.archived ? " (Archived)" : ""}
                    </option>
                  ))}
                </select>
              </label>
            </Card>
            {selectedId ? <AssetsContent projectId={selectedId} /> : null}
          </div>
        )
      ) : null}
    </div>
  );
}
