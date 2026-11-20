import { describe, expect, it } from "vitest";
import type { Message, MessageOverview } from "../../lib/types";
import {
  MESSAGE_OVERVIEW_LIMITS,
  MESSAGE_OVERVIEW_RECENT_LIMIT,
  buildMessageOverviewOptions,
  hasMessageOverviewData,
  messageOverviewActiveOption,
  messageOverviewContentPreview,
  messageOverviewCount,
  messageOverviewEmptyDescription,
  messageOverviewGeneratedAtLabel,
  messageOverviewIdentity,
  messageOverviewPickerOptions,
  messageOverviewPositionLabel,
  messageOverviewRecentSiblings,
  messageOverviewRelativeLabel,
  messageOverviewRoleRows,
  messageOverviewShortId,
  messageOverviewStatRows,
  messageOverviewStatusLabel,
  messageOverviewStatusRows,
  messageOverviewStatusTone,
  messageOverviewSummaryLabel,
} from "./messageOverviewHelpers";

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

function overview(overrides: Partial<MessageOverview> = {}): MessageOverview {
  return {
    message_id: "msg-aaaa-1111",
    conversation_id: "conv-aaaa-2222",
    conversation_title: "Shot planning",
    project_id: "proj-aaaa-3333",
    project_name: "A Short Film",
    role: "user",
    content: "  Give me   a shot list\nfor scene one.  ",
    status: "complete",
    position: 2,
    attachments: [{ asset_id: "asset-aaaa-5555", role: "reference" }],
    operation_id: "op-text-to-image",
    created_at: "2026-01-01T00:40:00Z",
    counts: {
      total: 3,
      by_role: [
        { role: "user", count: 2 },
        { role: "assistant", count: 1 },
      ],
      by_status: [{ status: "complete", count: 3 }],
    },
    recent_siblings: [
      message({ id: "msg-bbbb-9999", role: "assistant", content: "Done.", created_at: "2026-01-01T00:50:00Z" }),
      message(),
    ],
    generated_at: "2026-01-01T00:59:30Z",
    ...overrides,
  };
}

describe("messageOverviewOptions", () => {
  it("builds the bounded query options with the default and explicit limits", () => {
    expect(buildMessageOverviewOptions()).toEqual({ recentLimit: MESSAGE_OVERVIEW_RECENT_LIMIT });
    expect(buildMessageOverviewOptions(10)).toEqual({ recentLimit: 10 });
    expect(MESSAGE_OVERVIEW_LIMITS).toContain(MESSAGE_OVERVIEW_RECENT_LIMIT);
  });
});

describe("messageOverview formatters", () => {
  it("formats relative labels defensively", () => {
    expect(messageOverviewRelativeLabel(null)).toBe("");
    expect(messageOverviewRelativeLabel(undefined)).toBe("");
    expect(messageOverviewRelativeLabel("2026-01-01T00:30:00Z", NOW)).toBe("30 minutes ago");
    expect(messageOverviewRelativeLabel("not-a-date", NOW)).toBe("not-a-date");
  });

  it("formats the generated-at footer label", () => {
    expect(messageOverviewGeneratedAtLabel(overview(), NOW)).toBe("30 seconds ago");
    expect(messageOverviewGeneratedAtLabel(undefined)).toBe("");
  });

  it("zero-fills the whole-conversation count and tolerates malformed values", () => {
    expect(messageOverviewCount(overview())).toBe(3);
    expect(messageOverviewCount(undefined)).toBe(0);
    expect(messageOverviewCount(overview({ counts: { total: -1 } }))).toBe(0);
    expect(messageOverviewCount(overview({ counts: { total: Number.NaN } }))).toBe(0);
  });

  it("normalizes content previews and short ids", () => {
    expect(messageOverviewContentPreview(overview().content)).toBe("Give me a shot list for scene one.");
    expect(messageOverviewContentPreview(null)).toBe("No content");
    expect(messageOverviewContentPreview("x".repeat(200), 10)).toBe("xxxxxxxxxx…");
    expect(messageOverviewShortId(null)).toBe("");
    expect(messageOverviewShortId("short")).toBe("short");
    expect(messageOverviewShortId("abcdefghijklmnop", "Operation")).toBe("Operation abcdefgh…");
  });

  it("formats status and position labels defensively", () => {
    expect(messageOverviewStatusLabel("error")).toBe("Error");
    expect(messageOverviewStatusLabel(null)).toBe("—");
    expect(messageOverviewStatusTone("error")).toBe("danger");
    expect(messageOverviewStatusTone("complete")).toBe("success");
    expect(messageOverviewStatusTone(undefined)).toBe("neutral");
    expect(messageOverviewPositionLabel(2)).toBe("#2");
    expect(messageOverviewPositionLabel(0)).toBe("—");
    expect(messageOverviewPositionLabel(null)).toBe("—");
  });
});

describe("messageOverviewIdentity", () => {
  it("derives identity, badges and recency from the snapshot", () => {
    const identity = messageOverviewIdentity(overview(), NOW);
    expect(identity.conversationTitle).toBe("Shot planning");
    expect(identity.projectLabel).toBe("A Short Film");
    expect(identity.roleLabel).toBe("User");
    expect(identity.roleTone).toBe("accent");
    expect(identity.statusLabel).toBe("Complete");
    expect(identity.statusTone).toBe("success");
    expect(identity.positionLabel).toBe("#2");
    expect(identity.contentPreview).toBe("Give me a shot list for scene one.");
    expect(identity.createdLabel).toBe("20 minutes ago");
    expect(identity.operationLabel).toBe("Operation op-text-…");
    expect(identity.attachmentLabel).toBe("1 attachment");
  });

  it("returns render-safe fallbacks for a missing snapshot", () => {
    const identity = messageOverviewIdentity(undefined);
    expect(identity.conversationTitle).toBe("Untitled conversation");
    expect(identity.projectLabel).toBe("");
    expect(identity.contentPreview).toBe("No content");
    expect(identity.attachmentLabel).toBe("");
    expect(identity.positionLabel).toBe("—");
  });

  it("pluralizes attachments", () => {
    const identity = messageOverviewIdentity(
      overview({ attachments: [{ asset_id: "a" }, { asset_id: "b" }] }),
    );
    expect(identity.attachmentLabel).toBe("2 attachments");
  });
});

describe("messageOverviewStatRows", () => {
  it("derives four stable, zero-filled stat cards", () => {
    const rows = messageOverviewStatRows(overview(), NOW);
    expect(rows.map((row) => row.key)).toEqual(["messages", "position", "created", "attachments"]);
    expect(rows[0]?.value).toBe("3");
    expect(rows[1]?.value).toBe("#2");
    expect(rows[2]?.value).toBe("20 minutes ago");
    expect(rows[3]?.value).toBe("1");
  });

  it("stays zero-filled for a missing snapshot", () => {
    const rows = messageOverviewStatRows(undefined);
    expect(rows.every((row) => ["0", "—"].includes(row.value))).toBe(true);
  });
});

describe("messageOverview breakdowns", () => {
  it("derives zero-filled role and status distributions shared with stats", () => {
    const roles = messageOverviewRoleRows(overview());
    const statuses = messageOverviewStatusRows(overview());
    expect(roles).toHaveLength(4);
    expect(statuses).toHaveLength(4);
    expect(roles.find((row) => row.role === "user")?.count).toBe(2);
    expect(roles.find((row) => row.role === "assistant")?.count).toBe(1);
    expect(statuses.find((row) => row.status === "complete")?.count).toBe(3);
    expect(roles.reduce((sum, row) => sum + row.count, 0)).toBe(3);
    expect(roles.find((row) => row.role === "user")?.percent).toBe(67);
  });

  it("is all-zero for a missing snapshot", () => {
    expect(messageOverviewRoleRows(undefined).every((row) => row.count === 0)).toBe(true);
    expect(messageOverviewStatusRows(undefined).every((row) => row.count === 0)).toBe(true);
  });
});

describe("messageOverviewRecentSiblings", () => {
  it("projects newest siblings and marks the selected message", () => {
    const rows = messageOverviewRecentSiblings(overview(), NOW);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.isCurrent).toBe(false);
    expect(rows[0]?.contentPreview).toBe("Done.");
    expect(rows[1]?.isCurrent).toBe(true);
    expect(rows[1]?.relativeTime).toBe("20 minutes ago");
  });

  it("returns an empty list for a missing snapshot", () => {
    expect(messageOverviewRecentSiblings(undefined)).toEqual([]);
  });
});

describe("messageOverview data detection and summary", () => {
  it("detects populated vs empty snapshots", () => {
    expect(hasMessageOverviewData(overview())).toBe(true);
    expect(hasMessageOverviewData(overview({ counts: { total: 0 }, recent_siblings: [] }))).toBe(false);
    expect(hasMessageOverviewData(undefined)).toBe(false);
  });

  it("builds a one-line summary", () => {
    expect(messageOverviewSummaryLabel(overview())).toBe("3 messages · selected #2");
    expect(messageOverviewSummaryLabel(overview({ counts: { total: 1 }, position: 1 }))).toBe(
      "1 message · selected #1",
    );
    expect(messageOverviewSummaryLabel(undefined)).toBe("");
  });

  it("provides scope-aware empty copy", () => {
    expect(messageOverviewEmptyDescription(true)).toContain("conversation");
    expect(messageOverviewEmptyDescription(false)).toContain("conversation");
  });
});

describe("messageOverviewPickerOptions", () => {
  it("orders options chronologically with 1-based labels", () => {
    const messages = [
      message({ id: "msg-late", created_at: "2026-01-01T00:50:00Z", content: "Later" }),
      message({ id: "msg-early", created_at: "2026-01-01T00:10:00Z", content: "Earlier" }),
      message({ id: "msg-mid", created_at: "2026-01-01T00:30:00Z", content: "Middle" }),
    ];
    const options = messageOverviewPickerOptions(messages);
    expect(options.map((option) => option.messageId)).toEqual(["msg-early", "msg-mid", "msg-late"]);
    expect(options[0]?.label).toContain("#1");
    expect(options[2]?.label).toContain("#3");
  });

  it("resolves the active option with a first-row fallback", () => {
    const options = messageOverviewPickerOptions([message()]);
    expect(messageOverviewActiveOption(options, "msg-aaaa-1111")?.messageId).toBe("msg-aaaa-1111");
    expect(messageOverviewActiveOption(options, "missing")?.messageId).toBe("msg-aaaa-1111");
    expect(messageOverviewActiveOption([], "missing")).toBeUndefined();
  });

  it("handles undefined message lists", () => {
    expect(messageOverviewPickerOptions(undefined)).toEqual([]);
  });
});
