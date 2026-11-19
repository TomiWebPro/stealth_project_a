import { describe, expect, it } from "vitest";
import type { CollaborationStats } from "../../lib/types";
import {
  collaborationProjectRows,
  collaborationRelativeLabel,
  collaborationStateRows,
  collaborationStatsCards,
  collaborationStatsGeneratedAtLabel,
  hasCollaborationStatsData,
  newestSignalLabel,
  shortProjectId,
} from "./collaborationStatsHelpers";

const NOW = Date.parse("2026-01-01T01:00:00Z");

const PROJECT_A = "11111111-1111-4111-8111-111111111111";
const PROJECT_B = "22222222-2222-4222-8222-222222222222";

const populated: CollaborationStats = {
  total_presence: 6,
  total_comments: 4,
  total_participants: 3,
  by_state: [
    { state: "online", count: 3 },
    { state: "away", count: 2 },
    { state: "offline", count: 1 },
  ],
  by_project: [
    { project_id: PROJECT_A, comments: 3, presence: 4 },
    { project_id: PROJECT_B, comments: 1, presence: 2 },
  ],
  newest_presence_at: "2026-01-01T00:30:00Z",
  newest_comment_at: "2026-01-01T00:45:00Z",
  generated_at: "2026-01-01T00:59:30Z",
};

const empty: CollaborationStats = {
  total_presence: 0,
  total_comments: 0,
  total_participants: 0,
  by_state: [
    { state: "online", count: 0 },
    { state: "away", count: 0 },
    { state: "offline", count: 0 },
  ],
  by_project: [],
  newest_presence_at: null,
  newest_comment_at: null,
  generated_at: "2026-01-01T00:00:00Z",
};

describe("collaboration stats formatters", () => {
  it("shortens long project ids and keeps short ones intact", () => {
    expect(shortProjectId(PROJECT_A)).toBe("11111111…");
    expect(shortProjectId("short")).toBe("short");
  });

  it("formats relative labels and treats invalid timestamps as raw values", () => {
    expect(collaborationRelativeLabel(null)).toBe("");
    expect(collaborationRelativeLabel(undefined)).toBe("");
    expect(collaborationRelativeLabel("2026-01-01T00:30:00Z", NOW)).toBe("30 minutes ago");
    expect(collaborationRelativeLabel("not-a-date", NOW)).toBe("not-a-date");
  });

  it("picks the newer of the two recency signals", () => {
    expect(newestSignalLabel(populated, NOW)).toBe("15 minutes ago");
    expect(newestSignalLabel({ ...populated, newest_comment_at: null }, NOW)).toBe(
      "30 minutes ago",
    );
    expect(newestSignalLabel({ ...populated, newest_presence_at: null }, NOW)).toBe(
      "15 minutes ago",
    );
    expect(newestSignalLabel(empty, NOW)).toBe("");
    expect(newestSignalLabel(undefined, NOW)).toBe("");
  });
});

describe("collaborationStatsCards", () => {
  it("derives the three counters plus the newest-activity recency in a stable order", () => {
    const cards = collaborationStatsCards(populated, NOW);
    expect(cards.map((card) => card.key)).toEqual([
      "presence",
      "comments",
      "participants",
      "latest",
    ]);
    expect(cards.map((card) => card.value)).toEqual(["6", "4", "3", "15 minutes ago"]);
  });

  it("zero-fills every counter when the snapshot is absent or empty", () => {
    expect(collaborationStatsCards(undefined, NOW).map((card) => card.value)).toEqual([
      "0",
      "0",
      "0",
      "—",
    ]);
    expect(collaborationStatsCards(empty, NOW)[3]?.value).toBe("—");
  });
});

describe("collaborationStateRows", () => {
  it("returns a complete zero-filled online/away/offline breakdown with shares", () => {
    const rows = collaborationStateRows(populated);
    expect(rows.map((row) => row.state)).toEqual(["online", "away", "offline"]);
    expect(rows[0]).toMatchObject({ label: "Online", count: 3, percent: 50, fraction: 0.5, tone: "success" });
    expect(rows[1]).toMatchObject({ label: "Away", count: 2, percent: 33, tone: "warning" });
    expect(rows[2]).toMatchObject({ label: "Offline", count: 1, tone: "neutral" });
  });

  it("ignores malformed entries and never divides by zero on empty snapshots", () => {
    const rows = collaborationStateRows({
      ...populated,
      by_state: [
        { state: "online", count: Number.NaN },
        { state: "away", count: 4 },
      ],
    });
    expect(rows[0]?.count).toBe(0);
    expect(rows[1]?.percent).toBe(100);
    expect(collaborationStateRows(undefined).every((row) => row.fraction === 0)).toBe(true);
    expect(collaborationStateRows(empty).every((row) => row.percent === 0)).toBe(true);
  });
});

describe("collaborationProjectRows", () => {
  it("derives per-project activity with friendly names and a short-id fallback", () => {
    const rows = collaborationProjectRows(populated, { [PROJECT_B]: "Effects Short" });
    expect(rows.map((row) => row.projectId)).toEqual([PROJECT_A, PROJECT_B]);
    expect(rows[0]).toMatchObject({
      label: "11111111…",
      comments: 3,
      presence: 4,
      activity: 7,
    });
    expect(rows[1]).toMatchObject({ label: "Effects Short", activity: 3 });
  });

  it("re-sorts unsafely ordered entries and zero-fills when absent", () => {
    const rows = collaborationProjectRows({
      ...populated,
      by_project: [
        { project_id: PROJECT_B, comments: 1, presence: 2 },
        { project_id: PROJECT_A, comments: 3, presence: 4 },
      ],
    });
    expect(rows.map((row) => row.projectId)).toEqual([PROJECT_A, PROJECT_B]);
    expect(collaborationProjectRows(undefined)).toEqual([]);
    expect(collaborationProjectRows(empty)).toEqual([]);
  });
});

describe("hasCollaborationStatsData and collaborationStatsGeneratedAtLabel", () => {
  it("detects empty snapshots across all three counters", () => {
    expect(hasCollaborationStatsData(populated)).toBe(true);
    expect(hasCollaborationStatsData(empty)).toBe(false);
    expect(hasCollaborationStatsData(undefined)).toBe(false);
    expect(hasCollaborationStatsData({ ...empty, total_comments: 3 })).toBe(true);
  });

  it("derives a generated-at footer label", () => {
    expect(collaborationStatsGeneratedAtLabel(populated, NOW)).toBe("30 seconds ago");
    expect(collaborationStatsGeneratedAtLabel(undefined, NOW)).toBe("");
  });
});
