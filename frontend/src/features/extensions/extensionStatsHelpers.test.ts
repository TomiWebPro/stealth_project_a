import { describe, expect, it } from "vitest";
import type { ExtensionStats } from "../../lib/types";
import {
  extensionPermissionRows,
  extensionStatsCards,
  extensionStatsGeneratedAtLabel,
  extensionStatusRows,
  extensionTrustRows,
  extensionTypeRows,
  hasExtensionStatsData,
  humanizeExtensionId,
} from "./extensionStatsHelpers";

const populated: ExtensionStats = {
  total_registered: 5,
  total_installed: 4,
  by_type: [
    { type: "capability", count: 2 },
    { type: "ui", count: 1 },
    { type: "provider", count: 1 },
    { type: "runtime", count: 0 },
    { type: "bundle", count: 1 },
  ],
  by_status: [
    { status: "installed", count: 1 },
    { status: "enabled", count: 2 },
    { status: "disabled", count: 1 },
    { status: "update_available", count: 0 },
  ],
  enabled: 2,
  signed: 3,
  verified: 2,
  total_permissions: 6,
  unique_permissions: 3,
  by_permission: [
    { permission: "jobs.submit", extensions: 3 },
    { permission: "ui.panel", extensions: 2 },
    { permission: "storage.read", extensions: 1 },
  ],
  total_capabilities: 8,
  generated_at: "2026-01-01T00:00:00Z",
};

const empty: ExtensionStats = {
  total_registered: 0,
  total_installed: 0,
  by_type: [],
  by_status: [],
  enabled: 0,
  signed: 0,
  verified: 0,
  total_permissions: 0,
  unique_permissions: 0,
  by_permission: [],
  total_capabilities: 0,
  generated_at: "2026-01-01T00:00:00Z",
};

describe("extension stats formatters", () => {
  it("humanizes hyphen/underscore identifiers", () => {
    expect(humanizeExtensionId("update_available")).toBe("Update Available");
    expect(humanizeExtensionId("jobs.submit")).toBe("Jobs.submit");
    expect(humanizeExtensionId("")).toBe("");
  });
});

describe("extensionStatsCards", () => {
  it("is zero-filled and render-safe without a snapshot", () => {
    const cards = extensionStatsCards(undefined);
    expect(cards.map((card) => card.key)).toEqual([
      "registered",
      "installed",
      "enabled",
      "permissions",
    ]);
    expect(cards.map((card) => card.value)).toEqual(["0", "0", "0", "0"]);
    expect(extensionStatsCards(empty).every((card) => card.value === "0")).toBe(true);
  });

  it("derives the four authoritative counters", () => {
    expect(extensionStatsCards(populated).map((card) => card.value)).toEqual([
      "5",
      "4",
      "2",
      "3",
    ]);
  });
});

describe("extensionTypeRows", () => {
  it("zero-fills every canonical type", () => {
    expect(extensionTypeRows().map((row) => [row.type, row.count, row.percent])).toEqual([
      ["capability", 0, 0],
      ["ui", 0, 0],
      ["provider", 0, 0],
      ["runtime", 0, 0],
      ["bundle", 0, 0],
    ]);
    expect(extensionTypeRows(empty).every((row) => row.fraction === 0)).toBe(true);
  });

  it("merges counts in canonical order with labels, shares and tones", () => {
    const rows = extensionTypeRows(populated);
    expect(rows.map((row) => row.type)).toEqual([
      "capability",
      "ui",
      "provider",
      "runtime",
      "bundle",
    ]);
    expect(rows[0]).toMatchObject({ label: "Capability", count: 2, percent: 40, tone: "accent" });
    expect(rows[1]).toMatchObject({ label: "UI", count: 1, tone: "info" });
    expect(rows[3]).toMatchObject({ count: 0, fraction: 0 });
  });

  it("ignores unknown or malformed type entries", () => {
    const rows = extensionTypeRows({
      ...populated,
      by_type: [
        { type: "mystery" as never, count: 9 },
        { type: "ui", count: Number.NaN },
      ],
    });
    expect(rows.every((row) => row.count === 0)).toBe(true);
    expect(rows.every((row) => row.fraction === 0)).toBe(true);
  });
});

describe("extensionStatusRows", () => {
  it("zero-fills every canonical status", () => {
    expect(extensionStatusRows().map((row) => [row.status, row.count])).toEqual([
      ["installed", 0],
      ["enabled", 0],
      ["disabled", 0],
      ["update_available", 0],
    ]);
    expect(extensionStatusRows(empty).every((row) => row.percent === 0)).toBe(true);
  });

  it("merges counts in canonical order with shares and tones", () => {
    const rows = extensionStatusRows(populated);
    expect(rows.map((row) => row.status)).toEqual([
      "installed",
      "enabled",
      "disabled",
      "update_available",
    ]);
    expect(rows[0]).toMatchObject({ label: "Installed", count: 1, tone: "info" });
    expect(rows[1]).toMatchObject({ count: 2, percent: 50, fraction: 0.5, tone: "success" });
    expect(rows[2]).toMatchObject({ tone: "neutral" });
    expect(rows[3]).toMatchObject({ label: "Update Available", tone: "warning" });
  });

  it("tolerates malformed status entries", () => {
    const rows = extensionStatusRows({
      ...populated,
      by_status: [{ status: "enabled", count: Number.NaN }],
    });
    expect(rows.every((row) => row.count === 0)).toBe(true);
  });
});

describe("extensionPermissionRows", () => {
  it("returns no rows without a snapshot", () => {
    expect(extensionPermissionRows()).toEqual([]);
    expect(extensionPermissionRows(empty)).toEqual([]);
  });

  it("sorts busiest first and derives shares of registered manifests", () => {
    const rows = extensionPermissionRows(populated);
    expect(rows.map((row) => row.permission)).toEqual([
      "jobs.submit",
      "ui.panel",
      "storage.read",
    ]);
    expect(rows[0]).toMatchObject({ extensions: 3, percent: 60, fraction: 0.6 });
    expect(rows[2]).toMatchObject({ extensions: 1, percent: 20 });
  });

  it("breaks count ties by name and tolerates malformed rows", () => {
    const rows = extensionPermissionRows({
      ...populated,
      by_permission: [
        { permission: "z.perm", extensions: 2 },
        { permission: "a.perm", extensions: 2 },
        { permission: "bad", extensions: Number.NaN },
      ],
    });
    expect(rows.map((row) => row.permission)).toEqual(["a.perm", "z.perm"]);
  });
});

describe("extensionTrustRows", () => {
  it("is zero-filled and neutral without a snapshot", () => {
    expect(extensionTrustRows().map((row) => [row.key, row.count, row.tone])).toEqual([
      ["signed", 0, "neutral"],
      ["verified", 0, "neutral"],
    ]);
    expect(extensionTrustRows(empty).every((row) => row.fraction === 0)).toBe(true);
  });

  it("derives trust-flag shares and tones from installed extensions", () => {
    const rows = extensionTrustRows(populated);
    expect(rows[0]).toMatchObject({ count: 3, percent: 75, fraction: 0.75, tone: "warning" });
    expect(rows[1]).toMatchObject({ count: 2, percent: 50, tone: "warning" });
  });

  it("marks full coverage as success", () => {
    const rows = extensionTrustRows({
      ...populated,
      signed: 4,
      verified: 4,
    });
    expect(rows.every((row) => row.tone === "success" && row.percent === 100)).toBe(true);
  });
});

describe("hasExtensionStatsData / generatedAt", () => {
  it("detects empty snapshots and absent data", () => {
    expect(hasExtensionStatsData()).toBe(false);
    expect(hasExtensionStatsData(empty)).toBe(false);
    expect(hasExtensionStatsData(populated)).toBe(true);
    expect(hasExtensionStatsData({ ...empty, total_capabilities: 2 })).toBe(true);
    expect(hasExtensionStatsData({ ...empty, by_permission: populated.by_permission })).toBe(true);
  });

  it("formats a compact relative generated-at label", () => {
    const now = Date.parse("2026-01-01T00:10:05Z");
    expect(extensionStatsGeneratedAtLabel(populated, now)).toBe("10 minutes ago");
    expect(
      extensionStatsGeneratedAtLabel({ ...populated, generated_at: "2026-01-01T00:09:45Z" }, now),
    ).toBe("20 seconds ago");
    expect(extensionStatsGeneratedAtLabel({ ...populated, generated_at: "not-a-date" }, now)).toBe(
      "not-a-date",
    );
    expect(extensionStatsGeneratedAtLabel(undefined)).toBe("");
  });
});
