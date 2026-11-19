import { describe, expect, it } from "vitest";
import type { AssetStats } from "../../lib/types";
import {
  assetStatsCards,
  assetStatsGeneratedAtLabel,
  assetStatsRelativeLabel,
  assetStatusRows,
  assetStatusLabel,
  assetStatusTone,
  assetTypeLabel,
  assetTypeRows,
  formatBytes,
  hasAssetStatsData,
} from "./assetStatsHelpers";

const populated: AssetStats = {
  total: 6,
  by_type: [
    { type: "image", count: 3 },
    { type: "video", count: 2 },
    { type: "lora", count: 1 },
  ],
  by_status: [
    { status: "ready", count: 4 },
    { status: "processing", count: 2 },
  ],
  total_size_bytes: 2 * 1024 * 1024 + 512 * 1024,
  total_versions: 9,
  newest_asset_at: "2026-01-01T00:00:00Z",
  generated_at: "2026-01-01T00:00:00Z",
};

const empty: AssetStats = {
  total: 0,
  by_type: [],
  by_status: [],
  total_size_bytes: 0,
  total_versions: 0,
  newest_asset_at: null,
  generated_at: "2026-01-01T00:00:00Z",
};

describe("asset stats formatters", () => {
  it("formats byte counts with binary units and safe fallbacks", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(2 * 1024 * 1024)).toBe("2.0 MB");
    expect(formatBytes(3 * 1024 * 1024 * 1024)).toBe("3.0 GB");
    expect(formatBytes(null)).toBe("—");
    expect(formatBytes(undefined)).toBe("—");
    expect(formatBytes(-1)).toBe("—");
    expect(formatBytes(Number.NaN)).toBe("—");
  });

  it("labels asset types and statuses with readable text", () => {
    expect(assetTypeLabel("model3d")).toBe("Model 3D");
    expect(assetTypeLabel("lora")).toBe("LoRA");
    expect(assetStatusLabel("processing")).toBe("Processing");
    expect(assetStatusTone("ready")).toBe("success");
    expect(assetStatusTone("failed")).toBe("danger");
    expect(assetStatusTone("deleted")).toBe("neutral");
  });

  it("formats compact relative labels with safe fallbacks", () => {
    const now = Date.parse("2026-01-01T00:10:05Z");
    expect(assetStatsRelativeLabel("2026-01-01T00:09:45Z", now)).toBe("20s ago");
    expect(assetStatsRelativeLabel("2026-01-01T00:00:00Z", now)).toBe("10m ago");
    expect(assetStatsRelativeLabel("2025-12-30T00:00:00Z", now)).toBe("2d ago");
    expect(assetStatsRelativeLabel("not-a-date", now)).toBe("not-a-date");
    expect(assetStatsRelativeLabel(null, now)).toBe("");
    expect(assetStatsRelativeLabel(undefined, now)).toBe("");
  });
});

describe("assetStatsCards", () => {
  it("is zero-filled and render-safe without a snapshot", () => {
    const cards = assetStatsCards(undefined, Date.parse("2026-01-01T00:00:00Z"));
    expect(cards.map((card) => card.key)).toEqual(["total", "bytes", "versions", "newest"]);
    expect(cards.map((card) => card.value)).toEqual(["0", "—", "0", "—"]);
  });

  it("derives the four authoritative counters", () => {
    const now = Date.parse("2026-01-01T00:10:00Z");
    expect(assetStatsCards(populated, now).map((card) => card.value)).toEqual([
      "6",
      "2.5 MB",
      "9",
      "10m ago",
    ]);
  });
});

describe("assetTypeRows", () => {
  it("zero-fills every asset type when the snapshot is absent or empty", () => {
    expect(assetTypeRows().every((row) => row.count === 0 && row.fraction === 0)).toBe(true);
    expect(assetTypeRows().map((row) => row.type)).toEqual([
      "image",
      "video",
      "audio",
      "model3d",
      "splat",
      "texture",
      "dataset",
      "lora",
      "scene",
      "resource",
    ]);
    expect(assetTypeRows(empty).every((row) => row.percent === 0)).toBe(true);
  });

  it("merges counts into the canonical order with shares and tones", () => {
    const rows = assetTypeRows(populated);
    const image = rows.find((row) => row.type === "image");
    const video = rows.find((row) => row.type === "video");
    expect(image).toMatchObject({ label: "Image", count: 3, percent: 50, fraction: 0.5 });
    expect(video).toMatchObject({ label: "Video", count: 2, percent: 33, tone: "accent" });
    expect(rows.find((row) => row.type === "lora")).toMatchObject({ label: "LoRA", count: 1 });
    expect(rows.reduce((sum, row) => sum + row.count, 0)).toBe(6);
  });

  it("ignores unknown or malformed type entries", () => {
    const rows = assetTypeRows({
      ...populated,
      by_type: [
        { type: "image", count: Number.NaN },
        { type: "video", count: 4 },
      ],
    });
    expect(rows.find((row) => row.type === "video")?.fraction).toBe(1);
    expect(rows.find((row) => row.type === "image")?.count).toBe(0);
  });
});

describe("assetStatusRows", () => {
  it("zero-fills every lifecycle status when the snapshot is absent or empty", () => {
    expect(assetStatusRows().map((row) => [row.status, row.count, row.percent])).toEqual([
      ["pending", 0, 0],
      ["processing", 0, 0],
      ["ready", 0, 0],
      ["failed", 0, 0],
      ["deleted", 0, 0],
    ]);
    expect(assetStatusRows(empty).every((row) => row.fraction === 0)).toBe(true);
  });

  it("merges counts into the canonical order with shares and tones", () => {
    const rows = assetStatusRows(populated);
    const ready = rows.find((row) => row.status === "ready");
    const processing = rows.find((row) => row.status === "processing");
    expect(ready).toMatchObject({ label: "Ready", count: 4, percent: 67, tone: "success" });
    expect(processing).toMatchObject({ label: "Processing", count: 2, percent: 33, tone: "info" });
    expect(rows.reduce((sum, row) => sum + row.count, 0)).toBe(6);
  });

  it("ignores unknown or malformed status entries", () => {
    const rows = assetStatusRows({
      ...populated,
      by_status: [
        { status: "ready", count: Number.NaN },
        { status: "failed", count: 3 },
      ],
    });
    expect(rows.find((row) => row.status === "failed")?.fraction).toBe(1);
    expect(rows.find((row) => row.status === "ready")?.count).toBe(0);
  });
});

describe("hasAssetStatsData / generatedAt", () => {
  it("detects empty snapshots and absent data", () => {
    expect(hasAssetStatsData()).toBe(false);
    expect(hasAssetStatsData(empty)).toBe(false);
    expect(hasAssetStatsData(populated)).toBe(true);
    expect(hasAssetStatsData({ ...empty, by_type: populated.by_type })).toBe(true);
  });

  it("formats a compact relative generated-at label", () => {
    const now = Date.parse("2026-01-01T00:10:05Z");
    expect(assetStatsGeneratedAtLabel(populated, now)).toBe("10m ago");
    expect(assetStatsGeneratedAtLabel({ ...populated, generated_at: "bad" }, now)).toBe("bad");
    expect(assetStatsGeneratedAtLabel(undefined)).toBe("");
  });
});
