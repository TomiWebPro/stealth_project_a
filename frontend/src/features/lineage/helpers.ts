import type { Asset } from "../../lib/types";

export interface LineageStage {
  readonly key: string;
  readonly label: string;
  readonly assets: readonly Asset[];
}

export function buildLineageStages(assets: readonly Asset[]): readonly LineageStage[] {
  const used = new Set<string>();
  const stages: LineageStage[] = [];

  const dataset = assets.filter((a) => a.type === "dataset");
  dataset.forEach((a) => used.add(a.id));
  if (dataset.length > 0) stages.push({ key: "dataset", label: "Dataset", assets: dataset });

  const lora = assets.filter((a) => a.type === "lora");
  lora.forEach((a) => used.add(a.id));
  if (lora.length > 0) stages.push({ key: "lora", label: "LoRA", assets: lora });

  const frameImages = assets.filter(
    (a) =>
      a.type === "image" &&
      (a.provenance?.operation_id === "frame-generation" ||
        a.provenance?.operation_id === "image-to-image" ||
        (typeof a.metadata?.shot === "string" && (a.parent_asset_ids?.length ?? 0) > 0)),
  );
  frameImages.forEach((a) => used.add(a.id));

  const video = assets.filter((a) => a.type === "video");
  video.forEach((a) => used.add(a.id));
  if (frameImages.length > 0) stages.push({ key: "frames", label: "Frames", assets: frameImages });
  if (video.length > 0) stages.push({ key: "video", label: "Video", assets: video });

  const design = assets.filter((a) => a.type === "image" && !used.has(a.id));
  if (design.length > 0) stages.unshift({ key: "design", label: "Design", assets: design });

  const remaining = assets.filter((a) => !used.has(a.id));
  if (remaining.length > 0) stages.push({ key: "other", label: "Other", assets: remaining });

  return stages;
}

export function assetParentsLabel(asset: Asset, byId: ReadonlyMap<string, Asset>): string {
  const parents = asset.parent_asset_ids ?? [];
  if (parents.length === 0) return "No parents";
  return parents.map((id) => byId.get(id)?.name ?? id.slice(0, 8)).join(", ");
}

export function provenanceSummary(asset: Asset): string {
  const p = asset.provenance;
  if (!p) return "No provenance";
  const parts: string[] = [];
  if (p.operation_id) parts.push(p.operation_id);
  if (p.provider_id) parts.push(`via ${p.provider_id}`);
  if (p.prompt) parts.push(`"${p.prompt}"`);
  return parts.length > 0 ? parts.join(" · ") : "Provenance recorded";
}

export function lineageChainSummary(stages: readonly LineageStage[]): string {
  if (stages.length === 0) return "No lineage data";
  return stages.map((s) => s.label).join(" → ");
}
