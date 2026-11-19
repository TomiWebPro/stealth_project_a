import { describe, expect, it } from "vitest";
import type { ConversationFeed, ConversationFeedItem } from "../../lib/types";
import {
  CONVERSATION_FEED_LIMITS,
  buildConversationFeedOptions,
  conversationFeedEmptyDescription,
  conversationFeedGeneratedAtLabel,
  conversationFeedMessageLabel,
  conversationFeedRoleLabel,
  conversationFeedRoleTone,
  conversationFeedRows,
  conversationFeedSummary,
} from "./conversationFeedHelpers";

const NOW = Date.parse("2026-01-01T01:00:00Z");

function item(overrides: Partial<ConversationFeedItem> = {}): ConversationFeedItem {
  return {
    conversation_id: "conv-aaaa-1111",
    project_id: "proj-aaaa-2222",
    project_name: "A Short Film",
    title: "Shot 01 lookdev",
    message_count: 3,
    last_message_role: "assistant",
    last_message_excerpt: "  Here is the latest frame.  ",
    created_at: "2026-01-01T00:30:00Z",
    updated_at: "2026-01-01T00:45:00Z",
    ...overrides,
  };
}

function feed(items: readonly ConversationFeedItem[]): ConversationFeed {
  return { items: [...items], total: items.length, generated_at: "2026-01-01T00:59:00Z" };
}

describe("conversationFeedMessageLabel", () => {
  it("pluralizes counts correctly", () => {
    expect(conversationFeedMessageLabel(0)).toBe("0 messages");
    expect(conversationFeedMessageLabel(1)).toBe("1 message");
    expect(conversationFeedMessageLabel(12)).toBe("12 messages");
  });
});

describe("conversationFeedRoleLabel / conversationFeedRoleTone", () => {
  it("labels and tones each known role", () => {
    expect(conversationFeedRoleLabel("user")).toBe("User");
    expect(conversationFeedRoleLabel("assistant")).toBe("Assistant");
    expect(conversationFeedRoleLabel("system")).toBe("System");
    expect(conversationFeedRoleLabel("tool")).toBe("Tool");
    expect(conversationFeedRoleTone("user")).toBe("accent");
    expect(conversationFeedRoleTone("assistant")).toBe("info");
    expect(conversationFeedRoleTone("system")).toBe("neutral");
    expect(conversationFeedRoleTone("tool")).toBe("warning");
  });

  it("uses an explicit empty label and neutral tone for absent roles", () => {
    expect(conversationFeedRoleLabel(undefined)).toBe("No messages");
    expect(conversationFeedRoleLabel(null)).toBe("No messages");
    expect(conversationFeedRoleTone(undefined)).toBe("neutral");
    expect(conversationFeedRoleTone(null)).toBe("neutral");
  });
});

describe("buildConversationFeedOptions", () => {
  it("omits the project scope when unscoped", () => {
    expect(buildConversationFeedOptions(undefined, 25)).toEqual({ limit: 25 });
  });

  it("includes the project scope when provided", () => {
    expect(buildConversationFeedOptions("proj-aaaa-2222", 10)).toEqual({
      projectId: "proj-aaaa-2222",
      limit: 10,
    });
  });

  it("offers the canonical page sizes", () => {
    expect(CONVERSATION_FEED_LIMITS).toEqual([10, 25, 50]);
  });
});

describe("conversationFeedRows", () => {
  it("returns an empty list for an unset or failed feed", () => {
    expect(conversationFeedRows(undefined, NOW)).toEqual([]);
    expect(conversationFeedRows({ total: 3, generated_at: "2026-01-01T00:59:00Z" }, NOW)).toEqual([]);
  });

  it("derives render-ready rows while preserving newest-first order", () => {
    const rows = conversationFeedRows(
      feed([
        item(),
        item({
          conversation_id: "conv-bbbb-2222",
          project_id: "proj-bbbb-3333",
          project_name: "Trailer",
          title: "Music cue",
          message_count: 1,
          last_message_role: null,
          last_message_excerpt: null,
          updated_at: "2026-01-01T00:20:00Z",
        }),
      ]),
      NOW,
    );

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.conversationId)).toEqual(["conv-aaaa-1111", "conv-bbbb-2222"]);
    expect(rows[0]).toMatchObject({
      id: "conv-aaaa-1111",
      projectId: "proj-aaaa-2222",
      projectName: "A Short Film",
      title: "Shot 01 lookdev",
      messageCount: 3,
      messageLabel: "3 messages",
      roleLabel: "Assistant",
      roleTone: "info",
      excerpt: "Here is the latest frame.",
      hasPreview: true,
      timestamp: "2026-01-01T00:45:00Z",
      relativeTime: "15 minutes ago",
    });
  });

  it("falls back for conversations without a last-message preview", () => {
    const [row] = conversationFeedRows(
      feed([
        item({
          last_message_role: null,
          last_message_excerpt: "   ",
        }),
      ]),
      NOW,
    );
    expect(row).toMatchObject({
      roleLabel: "No messages",
      roleTone: "neutral",
      excerpt: "No messages yet",
      hasPreview: false,
    });
  });
});

describe("conversationFeedSummary", () => {
  it("uses the whole-scope total and the newest conversation title", () => {
    const rows = conversationFeedRows(feed([item()]), NOW);
    expect(conversationFeedSummary(rows, 42)).toBe("42 conversations · latest: Shot 01 lookdev");
  });

  it("falls back to the visible row count and handles a single row", () => {
    const rows = conversationFeedRows(feed([item()]), NOW);
    expect(conversationFeedSummary(rows)).toBe("1 conversation · latest: Shot 01 lookdev");
  });

  it("reports an empty summary when there are no rows", () => {
    expect(conversationFeedSummary([])).toBe("No conversations");
  });
});

describe("conversationFeedGeneratedAtLabel", () => {
  it("formats a generated-at timestamp relative to now", () => {
    expect(conversationFeedGeneratedAtLabel(feed([]), NOW)).toBe("1 minute ago");
  });

  it("returns an empty label when the feed is missing", () => {
    expect(conversationFeedGeneratedAtLabel(undefined, NOW)).toBe("");
  });
});

describe("conversationFeedEmptyDescription", () => {
  it("is scope-aware", () => {
    expect(conversationFeedEmptyDescription(true)).toContain("this project");
    expect(conversationFeedEmptyDescription(false)).toContain("workspaces");
  });
});
