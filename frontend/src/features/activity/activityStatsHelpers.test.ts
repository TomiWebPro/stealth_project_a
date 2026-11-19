import { describe, expect, it } from "vitest";
import type { ActivityStats } from "../../lib/types";
import {
  activityKindRows,
  activityProjectRows,
  activityRelativeLabel,
  activityStatsCards,
  activityStatsGeneratedAtLabel,
  hasActivityStatsData,
  newestEventLabel,
  shortActivityProjectId,
} from "./activityStatsHelpers";

const NOW = Date.parse("2026-01-01T01:00:00Z");

const PROJECT_A = "11111111-1111-4111-8111-111111111111";
const PROJECT_B = "22222222-2222-4222-8222-222222222222";

const populated: ActivityStats = {
  total_events: 10,
  total_participants: 3,
  by_kind: [
    { kind: "asset", count: 4 },
    { kind: "publish", count: 3 },
    { kind: "job", count: 2 },
    { kind: "comment", count: 1 },
  ],
  by_project: [
    { project_id: PROJECT_A, events: 7, participants: 2 },
    { project_id: PROJECT_B, events: 3, participants: 1 },
  ],
  newest_event_at: "2026-01-01T00:45:00Z",
  generated_at: "2026-01-01T00:59:30Z",
};

const empty: ActivityStats = {
  total_events: 0,
  total_participants: 0,
  by_kind: [
    { kind: "asset", count: 0 },
    { kind: "publish", count: 0 },
    { kind: "job", count: 0 },
    { kind: "comment", count: 0 },
  ],
  by_project: [],
  newest_event_at: null,
  generated_at: "2026-01-01T00:00:00Z",
};

describe("activity stats formatters", () => {
  it("shortens long project ids and keeps short ones intact", () => {
    expect(shortActivityProjectId(PROJECT_A)).toBe("11111111…");
    expect(shortActivityProjectId("short")).toBe("short");
  });

  it("formats relative labels and treats missing or invalid timestamps safely", () => {
    expect(activityRelativeLabel(null)).toBe("");
    expect(activityRelativeLabel(undefined)).toBe("");
    expect(activityRelativeLabel("2026-01-01T00:30:00Z", NOW)).toBe("30 minutes ago");
    expect(activityRelativeLabel("not-a-date", NOW)).toBe("not-a-date");
  });

  it("derives the newest-event label from the snapshot", () => {
    expect(newestEventLabel(populated, NOW)).toBe("15 minutes ago");
    expect(newestEventLabel(empty, NOW)).toBe("");
    expect(newestEventLabel(undefined, NOW)).toBe("");
  });
});

describe("activityStatsCards", () => {
  it("derives the counters, active projects and newest event in a stable order", () => {
    const cards = activityStatsCards(populated, NOW);
    expect(cards.map((card) => card.key)).toEqual([
      "events",
      "participants",
      "latest",
      "projects",
    ]);
    expect(cards.map((card) => card.value)).toEqual(["10", "3", "15 minutes ago", "2"]);
  });

  it("zero-fills every counter when the snapshot is absent or empty", () => {
    expect(activityStatsCards(undefined, NOW).map((card) => card.value)).toEqual([
      "0",
      "0",
      "—",
      "0",
    ]);
    expect(activityStatsCards(empty, NOW)[2]?.value).toBe("—");
  });
});

describe("activityKindRows", () => {
  it("returns a complete zero-filled asset/publish/job/comment breakdown with shares", () => {
    const rows = activityKindRows(populated);
    expect(rows.map((row) => row.kind)).toEqual(["asset", "publish", "job", "comment"]);
    expect(rows[0]).toMatchObject({ label: "Asset", count: 4, percent: 40, fraction: 0.4 });
    expect(rows[1]).toMatchObject({ label: "Publish", count: 3, percent: 30 });
    expect(rows[2]).toMatchObject({ label: "Job", count: 2, percent: 20 });
    expect(rows[3]).toMatchObject({ label: "Comment", count: 1, percent: 10 });
  });

  it("ignores malformed entries and never divides by zero on empty snapshots", () => {
    const rows = activityKindRows({
      ...populated,
      by_kind: [
        { kind: "asset", count: Number.NaN },
        { kind: "publish", count: 4 },
      ],
    });
    expect(rows[0]?.count).toBe(0);
    expect(rows[1]?.percent).toBe(100);
    expect(activityKindRows(undefined).every((row) => row.fraction === 0)).toBe(true);
    expect(activityKindRows(empty).every((row) => row.percent === 0)).toBe(true);
  });
});

describe("activityProjectRows", () => {
  it("derives per-project activity with friendly names and a short-id fallback", () => {
    const rows = activityProjectRows(populated, { [PROJECT_B]: "Effects Short" });
    expect(rows.map((row) => row.projectId)).toEqual([PROJECT_A, PROJECT_B]);
    expect(rows[0]).toMatchObject({
      label: "11111111…",
      events: 7,
      participants: 2,
    });
    expect(rows[1]).toMatchObject({ label: "Effects Short", events: 3, participants: 1 });
  });

  it("re-sorts unsafely ordered entries and zero-fills when absent", () => {
    const rows = activityProjectRows({
      ...populated,
      by_project: [
        { project_id: PROJECT_B, events: 3, participants: 1 },
        { project_id: PROJECT_A, events: 7, participants: 2 },
      ],
    });
    expect(rows.map((row) => row.projectId)).toEqual([PROJECT_A, PROJECT_B]);
    expect(activityProjectRows(undefined)).toEqual([]);
    expect(activityProjectRows(empty)).toEqual([]);
  });
});

describe("hasActivityStatsData and activityStatsGeneratedAtLabel", () => {
  it("detects empty snapshots across both authoritative counters", () => {
    expect(hasActivityStatsData(populated)).toBe(true);
    expect(hasActivityStatsData(empty)).toBe(false);
    expect(hasActivityStatsData(undefined)).toBe(false);
    expect(hasActivityStatsData({ ...empty, total_events: 3 })).toBe(true);
    expect(hasActivityStatsData({ ...empty, total_participants: 2 })).toBe(true);
  });

  it("derives a generated-at footer label", () => {
    expect(activityStatsGeneratedAtLabel(populated, NOW)).toBe("30 seconds ago");
    expect(activityStatsGeneratedAtLabel(undefined, NOW)).toBe("");
  });
});
