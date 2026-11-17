import { describe, expect, it } from "vitest";
import type { Asset, Project } from "../../lib/types";
import { buildExportRows, exportSummary } from "./exportHelpers";

const project: Project = {
  id: "p1",
  org_id: "o1",
  name: "Moon Shot",
  created_by: "u1",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

function asset(id: string, key: string, type: Asset["type"], version = 1): Asset {
  return {
    id,
    project_id: "p1",
    type,
    name: id,
    creator_id: "u1",
    version,
    storage: { key, size_bytes: 1, content_type: "application/octet-stream" },
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

describe("export helpers", () => {
  it("maps only published assets to engine paths", () => {
    const rows = buildExportRows(
      [
        asset("a1", "moonshot/Shots/s01_c01/Publish/hero_v002.png", "image", 2),
        asset("a2", "moonshot/Shots/s01_c01/Output/wip.png", "image"),
      ],
      project,
    );
    expect(rows.map((row) => row.assetId)).toEqual(["a1"]);
    expect(rows[0]?.targets[0]?.path).toBe("Content/Studio/moon_shot/Image/hero_v2");
    expect(rows[0]?.targets[1]?.path).toBe("//exports/moon_shot/Image/hero_v2");
  });

  it("marks incompatible targets as not ready", () => {
    const rows = buildExportRows(
      [asset("v1", "p/Shots/s01_c01/Publish/clip_v001.mp4", "video")],
      project,
    );
    expect(rows[0]?.targets.map((target) => target.ready)).toEqual([true, false]);
    expect(exportSummary(rows)).toContain("unreal");
  });

  it("reports an empty export set", () => {
    expect(buildExportRows([], project)).toEqual([]);
    expect(exportSummary([])).toBe("No published assets to export");
  });
});
