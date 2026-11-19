import { describe, expect, it } from "vitest";
import type { ConversationOverview, Message } from "../../lib/types";
import {
  conversationOverviewExcerpt,
  conversationOverviewGeneratedAtLabel,
  conversationOverviewIdentity,
  conversationOverviewMessageCount,
  conversationOverviewRecentMessages,
  conversationOverviewRelativeLabel,
  conversationOverviewRoleRows,
  conversationOverviewStatRows,
  conversationOverviewStatusRows,
  conversationOverviewSummaryLabel,
  hasConversationOverviewData,
} from "./conversationOverviewHelpers";

const NOW = Date.parse("2026-01-01T01:00:00Z");

function message(overrides: Partial<Message> = {}): Message {
  return {
    id: "msg-aaaa-1111",
    conversation_id: "conv-aaaa-2222",
    role: "assistant",
    content: "Here is your shot list.",
    status: "complete",
    created_at: "2026-01-01T00:40:00Z",
    ...overrides,
  };
}

function overview(overrides: Partial<ConversationOverview> = {}): ConversationOverview {
  return {
    conversation_id: "conv-aaaa-2222",
    project_id: "proj-aaaa-3333",
    project_name: "A Short Film",
    title: "Shot planning",
    created_by: "user-aaaa-4444",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:50:00Z",
    message_count: 3,
    last_message_role: "assistant",
    last_message_excerpt: "Here is your shot list.",
    counts: {
      total: 3,
      by_role: [
        { role: "user", count: 2 },
        { role: "assistant", count: 1 },
      ],
      by_status: [{ status: "complete", count: 3 }],
    },
    recent_messages: [message()],
    generated_at: "2026-01-01T00:59:30Z",
    ...overrides,
  };
}

function emptyOverview(): ConversationOverview {
  return overview({
    message_count: 0,
    last_message_role: null,
    last_message_excerpt: null,
    counts: { total: 0, by_role: [], by_status: [] },
    recent_messages: [],
  });
}

describe("conversationOverview formatters", () => {
  it("formats relative labels defensively", () => {
    expect(conversationOverviewRelativeLabel(null)).toBe("");
    expect(conversationOverviewRelativeLabel(undefined)).toBe("");
    expect(conversationOverviewRelativeLabel("2026-01-01T00:30:00Z", NOW)).toBe("30 minutes ago");
    expect(conversationOverviewRelativeLabel("not-a-date", NOW)).toBe("not-a-date");
  });

  it("formats the generated-at footer label", () => {
    expect(conversationOverviewGeneratedAtLabel(overview(), NOW)).toBe("30 seconds ago");
    expect(conversationOverviewGeneratedAtLabel(undefined)).toBe("");
  });

  it("prefers counts.total over the denormalized message_count", () => {
    expect(conversationOverviewMessageCount(overview())).toBe(3);
    expect(conversationOverviewMessageCount(overview({ counts: { total: 7 }, message_count: 3 }))).toBe(7);
    expect(conversationOverviewMessageCount(overview({ counts: {} as ConversationOverview["counts"], message_count: 2 }))).toBe(2);
    expect(conversationOverviewMessageCount(undefined)).toBe(0);
    expect(conversationOverviewMessageCount(overview({ counts: { total: -1 }, message_count: -2 }))).toBe(0);
  });

  it("trims the excerpt with an explicit empty fallback", () => {
    expect(conversationOverviewExcerpt("  hello  ")).toBe("hello");
    expect(conversationOverviewExcerpt(null)).toBe("No messages yet");
    expect(conversationOverviewExcerpt("   ")).toBe("No messages yet");
  });
});

describe("conversationOverviewIdentity", () => {
  it("derives identity, preview and recency for a populated snapshot", () => {
    expect(conversationOverviewIdentity(overview(), NOW)).toEqual({
      title: "Shot planning",
      projectLabel: "A Short Film",
      lastMessageRole: "assistant",
      roleLabel: "Assistant",
      roleTone: "info",
      excerpt: "Here is your shot list.",
      hasPreview: true,
      messageLabel: "3 messages",
      createdLabel: "1 hour ago",
      updatedLabel: "10 minutes ago",
    });
  });

  it("uses an explicit empty-label when there is no last message", () => {
    const identity = conversationOverviewIdentity(emptyOverview(), NOW);
    expect(identity.roleLabel).toBe("No messages");
    expect(identity.roleTone).toBe("neutral");
    expect(identity.hasPreview).toBe(false);
    expect(identity.excerpt).toBe("No messages yet");
  });

  it("is defensive for a missing snapshot", () => {
    expect(conversationOverviewIdentity(undefined, NOW)).toEqual({
      title: "Untitled conversation",
      projectLabel: "",
      lastMessageRole: undefined,
      roleLabel: "No messages",
      roleTone: "neutral",
      excerpt: "No messages yet",
      hasPreview: false,
      messageLabel: "0 messages",
      createdLabel: "",
      updatedLabel: "",
    });
  });
});

describe("conversationOverviewStatRows", () => {
  it("derives the three headline counters in a stable order", () => {
    const rows = conversationOverviewStatRows(overview(), NOW);
    expect(rows.map((row) => row.key)).toEqual(["messages", "last_role", "updated"]);
    expect(rows.map((row) => row.value)).toEqual(["3", "Assistant", "10 minutes ago"]);
    expect(rows.every((row) => row.label && row.hint)).toBe(true);
  });

  it("zero-fills every counter when the snapshot is absent", () => {
    const rows = conversationOverviewStatRows(undefined, NOW);
    expect(rows.map((row) => row.value)).toEqual(["0", "—", "—"]);
  });
});

describe("conversationOverview breakdown rows", () => {
  it("mirrors the canonical zero-filled role distribution", () => {
    const rows = conversationOverviewRoleRows(overview());
    expect(rows.map((row) => row.role)).toEqual(["system", "user", "assistant", "tool"]);
    expect(rows.map((row) => row.count)).toEqual([0, 2, 1, 0]);
    expect(rows.find((row) => row.role === "user")).toMatchObject({ percent: 67, tone: "accent" });
    expect(rows.find((row) => row.role === "assistant")).toMatchObject({ percent: 33, tone: "info" });
  });

  it("mirrors the canonical zero-filled status distribution", () => {
    const rows = conversationOverviewStatusRows(overview());
    expect(rows.map((row) => row.status)).toEqual(["pending", "streaming", "complete", "error"]);
    expect(rows.find((row) => row.status === "complete")).toMatchObject({ count: 3, percent: 100, tone: "success" });
  });

  it("is entirely zero-filled when the snapshot or counts are absent", () => {
    expect(conversationOverviewRoleRows(undefined).every((row) => row.count === 0)).toBe(true);
    expect(conversationOverviewStatusRows(undefined).every((row) => row.count === 0)).toBe(true);
    expect(conversationOverviewRoleRows(overview({ counts: {} as ConversationOverview["counts"] })).every((row) => row.count === 0)).toBe(true);
  });
});

describe("conversationOverviewRecentMessages", () => {
  it("projects recent messages into render-safe rows", () => {
    const rows = conversationOverviewRecentMessages(overview(), NOW);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      id: "msg-aaaa-1111",
      roleLabel: "Assistant",
      roleTone: "info",
      statusLabel: "Complete",
      content: "Here is your shot list.",
      timestamp: "2026-01-01T00:40:00Z",
      relativeTime: "20 minutes ago",
    });
  });

  it("handles missing status, blank content and an absent snapshot", () => {
    const rows = conversationOverviewRecentMessages(
      overview({ recent_messages: [message({ status: undefined, content: "  " })] }),
      NOW,
    );
    expect(rows[0]!.statusLabel).toBe("—");
    expect(rows[0]!.content).toBe("—");
    expect(conversationOverviewRecentMessages(undefined)).toEqual([]);
    expect(conversationOverviewRecentMessages(overview({ recent_messages: undefined }))).toEqual([]);
  });
});

describe("hasConversationOverviewData", () => {
  it("is false for a missing or entirely empty snapshot", () => {
    expect(hasConversationOverviewData(undefined)).toBe(false);
    expect(hasConversationOverviewData(emptyOverview())).toBe(false);
  });

  it("is true when a count or a recent message is present", () => {
    expect(hasConversationOverviewData(overview())).toBe(true);
    expect(hasConversationOverviewData(overview({
      counts: {} as ConversationOverview["counts"],
      recent_messages: [],
      message_count: 4,
    }))).toBe(true);
    expect(hasConversationOverviewData(overview({
      counts: { total: 0 },
      recent_messages: [message()],
    }))).toBe(true);
  });
});

describe("conversationOverviewSummaryLabel", () => {
  it("summarizes the message total and last-message excerpt", () => {
    expect(conversationOverviewSummaryLabel(overview())).toBe(
      "3 messages · Here is your shot list.",
    );
    expect(conversationOverviewSummaryLabel(emptyOverview())).toBe("0 messages");
    expect(conversationOverviewSummaryLabel(undefined)).toBe("");
  });
});
