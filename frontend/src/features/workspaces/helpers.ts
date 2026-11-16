import type { Asset } from "../../lib/types";

export interface WorkflowTemplateCard {
  readonly id: string;
  readonly name: string;
  readonly asset: Asset;
  readonly storageKey: string;
  readonly projectId: string;
  readonly tags: readonly string[];
}

/** Resource-type assets rendered as workflow template cards (data only, never node JSON). */
export function buildWorkflowTemplateCards(assets: readonly Asset[]): readonly WorkflowTemplateCard[] {
  return assets
    .filter((asset) => asset.type === "resource")
    .map((asset) => ({
      id: asset.id,
      name: asset.name,
      asset,
      storageKey: asset.storage.key,
      projectId: asset.project_id,
      tags: asset.tags ?? [],
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function templateDescription(asset: Asset): string {
  const meta = asset.metadata ?? {};
  const desc = typeof meta.description === "string" ? meta.description : null;
  if (desc) return desc;
  return "Workflow template asset (metadata/data reference only).";
}
