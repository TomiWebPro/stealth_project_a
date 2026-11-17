import { describe, expect, it } from "vitest";
import type { StorageStats } from "../../lib/types";
import { formatBytes, formatQuotaValue, storageUsage } from "./storageHelpers";

function stats(overrides: Partial<StorageStats> = {}): StorageStats {
  return {
    project_id: "project-1",
    quota: { used: 0, limit: 0, unit: "bytes" },
    object_count: 0,
    ...overrides,
  };
}

describe("formatBytes", () => {
  it("handles zero, invalid and sub-kilobyte values", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(-5)).toBe("0 B");
    expect(formatBytes(Number.NaN)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
  });

  it("scales to binary units with sensible precision", () => {
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(842_000_000)).toBe("803 MB");
    expect(formatBytes(5_000_000_000)).toBe("4.7 GB");
  });
});

describe("formatQuotaValue", () => {
  it("formats object-unit quotas as plain counts", () => {
    expect(formatQuotaValue(7, "objects")).toBe("7");
    expect(formatQuotaValue(1234, "objects")).toBe("1,234");
    expect(formatQuotaValue(-3, "objects")).toBe("0");
  });
});

describe("storageUsage", () => {
  it("derives a populated usage model with a healthy tone", () => {
    const usage = storageUsage(
      stats({
        quota: { used: 842_000_000, limit: 5_000_000_000, unit: "bytes" },
        object_count: 148,
      }),
    );
    expect(usage).toMatchObject({
      usedLabel: "803 MB",
      limitLabel: "4.7 GB",
      usedPercent: 17,
      objectCountLabel: "148 objects",
      hasObjects: true,
      isOverQuota: false,
      tone: "success",
      statusLabel: "Healthy",
    });
    expect(usage.usedFraction).toBeCloseTo(0.1684, 3);
    expect(usage.remainingLabel).toBe("3.9 GB");
  });

  it("reports an empty project with zero usage", () => {
    const usage = storageUsage(
      stats({ quota: { used: 0, limit: 5_000_000_000, unit: "bytes" }, object_count: 0 }),
    );
    expect(usage).toMatchObject({
      usedLabel: "0 B",
      usedPercent: 0,
      hasObjects: false,
      tone: "success",
      objectCountLabel: "0 objects",
    });
  });

  it("uses the neutral fallback when the payload has no quota", () => {
    const usage = storageUsage(stats());
    expect(usage).toMatchObject({
      usedFraction: 0,
      usedPercent: 0,
      hasObjects: false,
      isOverQuota: false,
      tone: "neutral",
      statusLabel: "No quota set",
    });
  });

  it("flags nearly-full and over-quota states with the right tone", () => {
    const nearFull = storageUsage(stats({ quota: { used: 800, limit: 1000, unit: "objects" } }));
    expect(nearFull).toMatchObject({ usedPercent: 80, tone: "warning", statusLabel: "Nearly full" });

    const over = storageUsage(stats({ quota: { used: 1200, limit: 1000, unit: "objects" } }));
    expect(over).toMatchObject({
      usedPercent: 100,
      usedFraction: 1,
      isOverQuota: true,
      tone: "danger",
      statusLabel: "Over quota",
      remainingLabel: "0",
    });
  });

  it("handles singular object counts and malformed numbers safely", () => {
    const single = storageUsage(
      stats({ quota: { used: 1, limit: 10, unit: "objects" }, object_count: 1 }),
    );
    expect(single.objectCountLabel).toBe("1 object");

    const malformed = storageUsage(
      stats({ quota: { used: Number.NaN, limit: Number.NaN }, object_count: undefined }),
    );
    expect(malformed).toMatchObject({ usedPercent: 0, hasObjects: false, tone: "neutral" });
  });
});
