import { describe, expect, it } from "vitest";
import type { ConversationStats } from "../../lib/types";
import {
  conversationRoleRows,
  conversationStatsCards,
  conversationStatsGeneratedAtLabel,
  conversationStatusRows,
  formatAverageMessages,
  hasConversationStatsData,
  humanizeLabel,
  statsRelativeLabel,
} from "./conversationStatsHelpers";

const populated: ConversationStats = {
  total_conversations: 4,
  total_messages: 10,
  by_role: [
    { role: "system", count: 1 },
    { role: "user", count: 4 },
    { role: "assistant", count: 4 },
    { role: "tool", count: 1 },
  ],
  by_status: [
    { status: "pending", count: 1 },
    { status: "streaming", count: 1 },
    { status: "complete", count: 7 },
    { status: "error", count: 1 },
  ],
  average_messages_per_conversation: 2.5,
  last_activity_at: "2026-01-01T00:00:00Z",
  generated_at: "2026-01-01T00:00:00Z",
};

const empty: ConversationStats = {
  total_conversations: 0,
  total_messages: 0,
  by_role: [],
  by_status: [],
  average_messages_per_conversation: 0,
  last_activity_at: null,
  generated_at: "2026-01-01T00:00:00Z",
};

describe("conversation stats formatters", () => {
  it("formats averages with safe fallbacks and up to three decimals", () => {
    expect(formatAverageMessages(2.5)).toBe("2.5");
    expect(formatAverageMessages(1.333)).toBe("1.333");
    expect(formatAverageMessages(0)).toBe("0");
    expect(formatAverageMessages(undefined)).toBe("—");
    expect(formatAverageMessages(null)).toBe("—");
    expect(formatAverageMessages(Number.NaN)).toBe("—");
  });

  it("capitalizes role/status tokens", () => {
    expect(humanizeLabel("assistant")).toBe("Assistant");
    expect(humanizeLabel("streaming")).toBe("Streaming");
    expect(humanizeLabel("")).toBe("");
  });

  it("formats compact relative labels with safe fallbacks", () => {
    const now = Date.parse("2026-01-01T00:10:05Z");
    expect(statsRelativeLabel("2026-01-01T00:10:00Z", now)).toBe("5s ago");
    expect(statsRelativeLabel("2026-01-01T00:00:00Z", now)).toBe("10m ago");
    expect(statsRelativeLabel("2025-12-30T00:00:00Z", now)).toBe("2d ago");
    expect(statsRelativeLabel("not-a-date", now)).toBe("not-a-date");
    expect(statsRelativeLabel(null, now)).toBe("");
    expect(statsRelativeLabel(undefined, now)).toBe("");
  });
});

describe("conversationStatsCards", () => {
  it("is zero-filled and render-safe without a snapshot", () => {
    const cards = conversationStatsCards(undefined);
    expect(cards.map((card) => card.key)).toEqual([
      "conversations",
      "messages",
      "average",
      "last_activity",
    ]);
    expect(cards.map((card) => card.value)).toEqual(["0", "0", "—", "—"]);
    expect(conversationStatsCards(empty).map((card) => card.value)).toEqual([
      "0",
      "0",
      "0",
      "—",
    ]);
  });

  it("derives the four authoritative counters", () => {
    const now = Date.parse("2026-01-01T00:00:00Z");
    const cards = conversationStatsCards(populated, now);
    expect(cards.map((card) => card.value)).toEqual(["4", "10", "2.5", "0s ago"]);
  });
});

describe("conversationRoleRows", () => {
  it("zero-fills every role in canonical order when absent or empty", () => {
    expect(conversationRoleRows().map((row) => [row.role, row.count, row.percent])).toEqual([
      ["system", 0, 0],
      ["user", 0, 0],
      ["assistant", 0, 0],
      ["tool", 0, 0],
    ]);
    expect(conversationRoleRows(empty).every((row) => row.fraction === 0)).toBe(true);
  });

  it("merges counts into canonical order with shares and tones", () => {
    const rows = conversationRoleRows({
      ...populated,
      by_role: [
        { role: "assistant", count: 3 },
        { role: "user", count: 1 },
      ],
    });
    expect(rows.map((row) => row.role)).toEqual(["system", "user", "assistant", "tool"]);
    const user = rows.find((row) => row.role === "user");
    const assistant = rows.find((row) => row.role === "assistant");
    expect(user).toMatchObject({ label: "User", count: 1, percent: 25, fraction: 0.25, tone: "accent" });
    expect(assistant).toMatchObject({
      label: "Assistant",
      count: 3,
      percent: 75,
      fraction: 0.75,
      tone: "info",
    });
    expect(rows.reduce((sum, row) => sum + row.percent, 0)).toBe(100);
  });

  it("ignores unknown or malformed role entries", () => {
    const rows = conversationRoleRows({
      ...populated,
      by_role: [
        { role: "system" as never, count: Number.NaN },
        { role: "tool", count: 2 },
      ],
    });
    expect(rows.find((row) => row.role === "tool")?.fraction).toBe(1);
    expect(rows.find((row) => row.role === "system")?.count).toBe(0);
  });
});

describe("conversationStatusRows", () => {
  it("zero-fills every status in canonical order when absent or empty", () => {
    expect(conversationStatusRows().map((row) => [row.status, row.count])).toEqual([
      ["pending", 0],
      ["streaming", 0],
      ["complete", 0],
      ["error", 0],
    ]);
    expect(conversationStatusRows(empty).every((row) => row.fraction === 0)).toBe(true);
  });

  it("merges counts into canonical order with shares and tones", () => {
    const rows = conversationStatusRows(populated);
    expect(rows.map((row) => row.status)).toEqual([
      "pending",
      "streaming",
      "complete",
      "error",
    ]);
    expect(rows[2]).toMatchObject({ label: "Complete", count: 7, percent: 70, tone: "success" });
    expect(rows[3]).toMatchObject({ label: "Error", count: 1, tone: "danger" });
    expect(rows.reduce((sum, row) => sum + row.percent, 0)).toBe(100);
  });
});

describe("hasConversationStatsData / generatedAt", () => {
  it("detects empty snapshots and absent data", () => {
    expect(hasConversationStatsData()).toBe(false);
    expect(hasConversationStatsData(empty)).toBe(false);
    expect(hasConversationStatsData(populated)).toBe(true);
    expect(hasConversationStatsData({ ...empty, total_messages: 1 })).toBe(true);
    expect(hasConversationStatsData({ ...empty, by_role: populated.by_role })).toBe(true);
  });

  it("formats a compact relative generated-at label", () => {
    const now = Date.parse("2026-01-01T00:10:05Z");
    expect(conversationStatsGeneratedAtLabel(populated, now)).toBe("10m ago");
    expect(conversationStatsGeneratedAtLabel(undefined, now)).toBe("");
  });
});
