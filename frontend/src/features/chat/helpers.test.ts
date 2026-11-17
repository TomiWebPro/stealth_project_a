import { describe, expect, it } from "vitest";
import type { Conversation, Message } from "../../lib/types";
import {
  buildConversationRows,
  buildMessageRows,
  conversationSummary,
  mergeMessages,
  sortConversations,
} from "./helpers";

function conversation(id: string, updatedAt: string, count: number): Conversation {
  return {
    id,
    project_id: "p1",
    title: `Conversation ${id}`,
    created_by: "u1",
    created_at: updatedAt,
    updated_at: updatedAt,
    message_count: count,
  };
}

function message(id: string, role: Message["role"], createdAt: string): Message {
  return {
    id,
    conversation_id: "c1",
    role,
    content: `content ${id}`,
    created_at: createdAt,
  };
}

describe("chat helpers", () => {
  it("sorts conversations newest first and derives rows with previews", () => {
    const older = conversation("a", "2026-01-01T00:00:00Z", 2);
    const newer = conversation("b", "2026-01-02T00:00:00Z", 5);
    expect(sortConversations([older, newer]).map((item) => item.id)).toEqual(["b", "a"]);
    const rows = buildConversationRows([older, newer], { a: "last of a" });
    expect(rows.map((row) => row.id)).toEqual(["b", "a"]);
    expect(rows[1]?.preview).toBe("last of a");
    expect(conversationSummary([older, newer])).toBe("2 conversations · 7 messages");
  });

  it("orders messages chronologically and flags streaming ones", () => {
    const rows = buildMessageRows([
      { ...message("2", "assistant", "2026-01-02T00:00:00Z"), status: "streaming" },
      message("1", "user", "2026-01-01T00:00:00Z"),
    ]);
    expect(rows.map((row) => row.id)).toEqual(["1", "2"]);
    expect(rows[0]?.isMine).toBe(true);
    expect(rows[1]?.isStreaming).toBe(true);
  });

  it("merges optimistic messages without duplicating authoritative ids", () => {
    const authoritative = [message("1", "user", "2026-01-01T00:00:00Z")];
    const optimistic = [
      message("1", "user", "2026-01-01T00:00:00Z"),
      message("local", "user", "2026-01-03T00:00:00Z"),
    ];
    expect(mergeMessages(authoritative, optimistic).map((msg) => msg.id)).toEqual(["1", "local"]);
  });
});
