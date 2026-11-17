import type { Asset, Project } from "../../lib/types";
import type { BadgeTone } from "../../ui/Badge";

export type ExportTarget = "unreal" | "blender";

export interface ExportRow {
  readonly assetId: string;
  readonly assetName: string;
  readonly assetType: Asset["type"];
  readonly sourceKey: string;
  readonly targets: readonly {
    readonly target: ExportTarget;
    readonly label: string;
    readonly path: string;
    readonly ready: boolean;
  }[];
}

const TARGET_LABEL: Readonly<Record<ExportTarget, string>> = {
  unreal: "Unreal Engine",
  blender: "Blender",
};

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "") || "asset";
}

function basename(key: string): string {
  const segment = key.split("/").pop() ?? key;
  return segment
    .replace(/\.[^.]+$/, "")
    .replace(/_v\d+$/i, "");
}

/**
 * Provisional UI convention (no backend export endpoint yet): published assets
 * map to engine-facing paths derived from the project slug and asset name.
 * Reversible and kept in one helper so a real convention can replace it.
 */
export function buildExportRows(
  assets: readonly Asset[],
  project: Project | undefined,
): readonly ExportRow[] {
  const projectSlug = slug(project?.name ?? "project");
  return assets
    .filter((asset) => asset.storage.key.includes("/Publish/"))
    .map((asset) => {
      const name = slug(basename(asset.storage.key));
      const typeFolder = asset.type === "video" ? "Video" : asset.type === "splat" ? "Splat" : "Image";
      const version = typeof asset.version === "number" ? asset.version : 1;
      return {
        assetId: asset.id,
        assetName: asset.name,
        assetType: asset.type,
        sourceKey: asset.storage.key,
        targets: [
          {
            target: "unreal" as const,
            label: TARGET_LABEL.unreal,
            path: `Content/Studio/${projectSlug}/${typeFolder}/${name}_v${version}`,
            ready: asset.type === "video" || asset.type === "image" || asset.type === "splat",
          },
          {
            target: "blender" as const,
            label: TARGET_LABEL.blender,
            path: `//exports/${projectSlug}/${typeFolder}/${name}_v${version}`,
            ready: asset.type === "image" || asset.type === "splat" || asset.type === "scene",
          },
        ],
      };
    });
}

export function exportSummary(rows: readonly ExportRow[]): string {
  if (rows.length === 0) return "No published assets to export";
  const targets = new Set(rows.flatMap((row) => row.targets.filter((target) => target.ready).map((target) => target.target)));
  return `${rows.length} published asset${rows.length === 1 ? "" : "s"} · ${Array.from(targets).sort().join(", ") || "no compatible targets"}`;
}

export function exportTone(ready: boolean): BadgeTone {
  return ready ? "success" : "neutral";
}
