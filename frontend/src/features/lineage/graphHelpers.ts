import type { Asset } from "../../lib/types";

export interface GraphNode {
  readonly id: string;
  readonly name: string;
  readonly type: Asset["type"];
  readonly stage: string;
  readonly depth: number;
  readonly parentIds: readonly string[];
  readonly childIds: readonly string[];
  readonly operationId: string | null;
  readonly prompt: string | null;
}

export interface GraphLayer {
  readonly depth: number;
  readonly label: string;
  readonly nodes: readonly GraphNode[];
}

const STAGE_BY_TYPE: Readonly<Partial<Record<Asset["type"], string>>> = {
  dataset: "Dataset",
  lora: "LoRA",
  video: "Video",
  splat: "Splat",
  scene: "Scene",
  resource: "Template",
};

function stageFor(asset: Asset): string {
  if (STAGE_BY_TYPE[asset.type]) return STAGE_BY_TYPE[asset.type] ?? asset.type;
  if (asset.type === "image") {
    const op = asset.provenance?.operation_id;
    if (op === "frame-generation" || op === "image-to-image" || typeof asset.metadata?.shot === "string") {
      return "Frames";
    }
    return "Design";
  }
  return asset.type;
}

/** Derive depth from parent edges (roots first) with a stable cycle guard. */
function computeDepths(assets: readonly Asset[]): ReadonlyMap<string, number> {
  const byId = new Map(assets.map((asset) => [asset.id, asset]));
  const depths = new Map<string, number>();
  const visiting = new Set<string>();

  function depthOf(id: string): number {
    const cached = depths.get(id);
    if (cached !== undefined) return cached;
    if (visiting.has(id)) return 0;
    visiting.add(id);
    const asset = byId.get(id);
    const parents = (asset?.parent_asset_ids ?? []).filter((parentId) => byId.has(parentId));
    const depth = parents.length === 0 ? 0 : Math.max(...parents.map(depthOf)) + 1;
    visiting.delete(id);
    depths.set(id, depth);
    return depth;
  }

  assets.forEach((asset) => depthOf(asset.id));
  return depths;
}

export function buildGraphLayers(assets: readonly Asset[]): readonly GraphLayer[] {
  if (assets.length === 0) return [];
  const depths = computeDepths(assets);
  const nodes: GraphNode[] = assets.map((asset) => ({
    id: asset.id,
    name: asset.name,
    type: asset.type,
    stage: stageFor(asset),
    depth: depths.get(asset.id) ?? 0,
    parentIds: (asset.parent_asset_ids ?? []).filter((id) => depths.has(id)),
    childIds: assets.filter((candidate) => candidate.parent_asset_ids?.includes(asset.id)).map((candidate) => candidate.id),
    operationId: asset.provenance?.operation_id ?? null,
    prompt: asset.provenance?.prompt ?? null,
  }));

  const maxDepth = Math.max(...nodes.map((node) => node.depth));
  const layers: GraphLayer[] = [];
  for (let depth = 0; depth <= maxDepth; depth += 1) {
    const members = nodes.filter((node) => node.depth === depth);
    if (members.length === 0) continue;
    layers.push({
      depth,
      label: `Level ${depth + 1} · ${Array.from(new Set(members.map((node) => node.stage))).join(", ")}`,
      nodes: members,
    });
  }
  return layers;
}

export function graphSummary(layers: readonly GraphLayer[]): string {
  const count = layers.reduce((sum, layer) => sum + layer.nodes.length, 0);
  if (count === 0) return "No graph nodes";
  return `${count} node${count === 1 ? "" : "s"} across ${layers.length} level${layers.length === 1 ? "" : "s"}`;
}
