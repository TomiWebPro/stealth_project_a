import { describe, expect, it } from "vitest";
import type { PipelineKind, PipelineStats } from "../../lib/types";
import {
  hasPipelineStatsData,
  newestChainLabel,
  pipelineKindLabel,
  pipelineKindRows,
  pipelineKindTone,
  pipelineProjectRows,
  pipelineStatsCards,
  pipelineStatsGeneratedAtLabel,
  pipelineStatsRelativeLabel,
  shortProjectLabel,
} from "./pipelineStatsHelpers";

const populated: PipelineStats = {
  total_chains: 6,
  total_jobs: 12,
  total_assets: 9,
  by_kind: [
    { kind: "training", chains: 3, jobs: 7, assets: 4 },
    { kind: "shot", chains: 2, jobs: 3, assets: 3 },
    { kind: "splat", chains: 1, jobs: 2, assets: 2 },
  ],
  by_project: [
    { project_id: "aaaaaaaa-1111", chains: 4 },
    { project_id: "bbbbbbbb-2222", chains: 2 },
  ],
  newest_chain_at: "2026-01-01T00:00:00Z",
  generated_at: "2026-01-01T00:10:05Z",
};

const empty: PipelineStats = {
  total_chains: 0,
  total_jobs: 0,
  total_assets: 0,
  by_kind: [
    { kind: "training", chains: 0, jobs: 0, assets: 0 },
    { kind: "shot", chains: 0, jobs: 0, assets: 0 },
    { kind: "splat", chains: 0, jobs: 0, assets: 0 },
  ],
  by_project: [],
  newest_chain_at: null,
  generated_at: "2026-01-01T00:00:00Z",
};

describe("labels and tones", () => {
  it("uses friendly labels and stable tones for canonical kinds", () => {
    expect(pipelineKindLabel("training")).toBe("Training");
    expect(pipelineKindLabel("shot")).toBe("Shot");
    expect(pipelineKindLabel("splat")).toBe("Splat");
    expect(pipelineKindLabel("custom_kind")).toBe("Custom Kind");
    expect(pipelineKindTone("training")).toBe("warning");
    expect(pipelineKindTone("shot")).toBe("info");
    expect(pipelineKindTone("splat")).toBe("success");
    expect(pipelineKindTone("other")).toBe("neutral");
  });

  it("shortens long project ids and keeps short ones intact", () => {
    expect(shortProjectLabel("aaaaaaaa-1111-2222")).toBe("aaaaaaaa…");
    expect(shortProjectLabel("abc")).toBe("abc");
    expect(shortProjectLabel("")).toBe("");
  });
});

describe("pipelineStatsCards", () => {
  it("is zero-filled and render-safe without a snapshot", () => {
    const cards = pipelineStatsCards(undefined);
    expect(cards.map((card) => card.key)).toEqual(["chains", "jobs", "assets"]);
    expect(cards.map((card) => card.value)).toEqual(["0", "0", "0"]);
  });

  it("derives the three authoritative counters", () => {
    expect(pipelineStatsCards(populated).map((card) => card.value)).toEqual(["6", "12", "9"]);
  });
});

describe("pipelineKindRows", () => {
  it("is zero-filled in canonical order without a snapshot", () => {
    const rows = pipelineKindRows();
    expect(rows.map((row) => row.kind)).toEqual(["training", "shot", "splat"]);
    expect(rows.every((row) => row.chains === 0 && row.jobs === 0 && row.assets === 0)).toBe(true);
    expect(rows.every((row) => row.percent === 0 && row.fraction === 0)).toBe(true);
  });

  it("derives per-kind counts and chain shares", () => {
    const rows = pipelineKindRows(populated);
    expect(rows.map((row) => row.kind)).toEqual(["training", "shot", "splat"]);
    expect(rows.map((row) => row.chains)).toEqual([3, 2, 1]);
    expect(rows.map((row) => row.jobs)).toEqual([7, 3, 2]);
    expect(rows.map((row) => row.assets)).toEqual([4, 3, 2]);
    expect(rows[0]).toMatchObject({ percent: 50, fraction: 0.5, tone: "warning" });
    expect(rows[2]).toMatchObject({ percent: 17, fraction: 1 / 6 });
  });

  it("appends unknown kinds after the canonical three and ignores malformed rows", () => {
    const rows = pipelineKindRows({
      ...populated,
      by_kind: [
        { kind: "splat", chains: 1, jobs: 0, assets: 0 },
        { kind: "training", chains: Number.NaN, jobs: 0, assets: 0 },
        { kind: "extra" as PipelineKind, chains: 2, jobs: 1, assets: 1 },
      ],
    });
    expect(rows.map((row) => row.kind)).toEqual(["training", "shot", "splat", "extra"]);
    expect(rows[0]?.chains).toBe(0);
    expect(rows[3]?.chains).toBe(2);
  });

  it("keeps shares at zero when the chain total is zero", () => {
    const rows = pipelineKindRows({
      ...empty,
      by_kind: [{ kind: "shot", chains: 3, jobs: 1, assets: 1 }],
    });
    expect(rows.find((row) => row.kind === "shot")).toMatchObject({
      chains: 3,
      percent: 0,
      fraction: 0,
    });
  });
});

describe("pipelineProjectRows", () => {
  it("returns no rows without a snapshot or breakdown", () => {
    expect(pipelineProjectRows()).toEqual([]);
    expect(pipelineProjectRows(empty)).toEqual([]);
  });

  it("sorts count-descending, derives shares and labels, and respects the limit", () => {
    const rows = pipelineProjectRows(populated);
    expect(rows.map((row) => row.projectId)).toEqual(["aaaaaaaa-1111", "bbbbbbbb-2222"]);
    expect(rows.map((row) => row.label)).toEqual(["aaaaaaaa…", "bbbbbbbb…"]);
    expect(rows[0]).toMatchObject({ chains: 4, percent: 67, fraction: 4 / 6 });
    expect(pipelineProjectRows(populated, 1)).toHaveLength(1);
  });

  it("breaks count ties by project id and ignores malformed rows", () => {
    const rows = pipelineProjectRows({
      ...populated,
      by_project: [
        { project_id: "z-project", chains: 2 },
        { project_id: "a-project", chains: 2 },
        { project_id: "bad", chains: Number.NaN },
      ],
    });
    expect(rows.map((row) => row.projectId)).toEqual(["a-project", "z-project"]);
    expect(rows.every((row) => row.percent === 33 && row.fraction === 1 / 3)).toBe(true);
  });
});

describe("hasPipelineStatsData / relative labels", () => {
  it("detects empty snapshots and absent data", () => {
    expect(hasPipelineStatsData()).toBe(false);
    expect(hasPipelineStatsData(empty)).toBe(false);
    expect(hasPipelineStatsData(populated)).toBe(true);
    expect(hasPipelineStatsData({ ...empty, total_jobs: 2 })).toBe(true);
  });

  it("formats compact relative recency and generated-at labels", () => {
    const now = Date.parse("2026-01-01T00:10:05Z");
    expect(pipelineStatsGeneratedAtLabel(populated, now)).toBe("now");
    expect(newestChainLabel(populated, now)).toBe("10 minutes ago");
    expect(newestChainLabel(empty)).toBe("");
    expect(pipelineStatsRelativeLabel(null)).toBe("");
    expect(pipelineStatsRelativeLabel("not-a-date", now)).toBe("not-a-date");
    expect(pipelineStatsGeneratedAtLabel(undefined)).toBe("");
  });
});
