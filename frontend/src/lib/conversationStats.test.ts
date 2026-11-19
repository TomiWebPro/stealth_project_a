import { describe, expect, it } from "vitest";

import type { Conversation, Message } from "./types";
import {
  MESSAGE_ROLES,
  MESSAGE_STATUSES,
  conversationStatsQueryParams,
  deriveConversationStats,
  validateConversationStatsArgs,
} from "./conversationStats";
import { CONVERSATIONS, MESSAGES, PROJECTS, REFERENCE_NOW } from "./mock/data";

const filmId = PROJECTS.find((project) => project.name.startsWith("Moonshot"))?.id ?? "";

function conversation(id: string, overrides: Partial<Conversation> = {}): Conversation {
  return {
    id,
    project_id: filmId,
    title: "Thread",
    created_by: "0b5c1e2a-0000-4000-8000-0000000000aa",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:01:00.000Z",
    ...overrides,
  };
}

function message(
  id: string,
  conversationId: string,
  overrides: Partial<Message> = {},
): Message {
  return {
    id,
    conversation_id: conversationId,
    role: "user",
    content: "hello",
    status: "complete",
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function roles(stats: ReturnType<typeof deriveConversationStats>): Record<string, number> {
  return Object.fromEntries(
    (stats.by_role ?? []).map((entry) => [entry.role as string, entry.count]),
  );
}

function statuses(stats: ReturnType<typeof deriveConversationStats>): Record<string, number> {
  return Object.fromEntries(
    (stats.by_status ?? []).map((entry) => [entry.status as string, entry.count]),
  );
}

describe("deriveConversationStats", () => {
  it("zero-fills every role and status in canonical order for an empty scope", () => {
    const stats = deriveConversationStats([], [], REFERENCE_NOW);
    expect(stats.by_role).toEqual(MESSAGE_ROLES.map((role) => ({ role, count: 0 })));
    expect(stats.by_status).toEqual(MESSAGE_STATUSES.map((status) => ({ status, count: 0 })));
    expect(stats).toEqual({
      total_conversations: 0,
      total_messages: 0,
      by_role: MESSAGE_ROLES.map((role) => ({ role, count: 0 })),
      by_status: MESSAGE_STATUSES.map((status) => ({ status, count: 0 })),
      average_messages_per_conversation: 0.0,
      last_activity_at: null,
      generated_at: REFERENCE_NOW,
    });
  });

  it("counts only messages whose conversation is in scope", () => {
    const stats = deriveConversationStats(
      [conversation("c1"), conversation("c2")],
      [
        message("m1", "c1", { role: "user" }),
        message("m2", "c1", { role: "assistant", status: "streaming" }),
        message("m3", "c2", { role: "tool", status: "error" }),
        message("m4", "orphan", { role: "user" }), // not in any scoped conversation
      ],
      REFERENCE_NOW,
    );
    expect(stats.total_conversations).toBe(2);
    expect(stats.total_messages).toBe(3);
    expect(roles(stats)).toMatchObject({ user: 1, assistant: 1, tool: 1, system: 0 });
    expect(statuses(stats)).toMatchObject({
      complete: 1,
      streaming: 1,
      error: 1,
      pending: 0,
    });
    expect(stats.average_messages_per_conversation).toBe(1.5);
  });

  it("uses the newest conversation updated_at as last activity", () => {
    const stats = deriveConversationStats(
      [
        conversation("c1", { updated_at: "2026-01-01T00:01:00.000Z" }),
        conversation("c2", { updated_at: "2026-01-02T00:00:00.000Z" }),
      ],
      [],
      REFERENCE_NOW,
    );
    expect(stats.last_activity_at).toBe("2026-01-02T00:00:00.000Z");
  });

  it("rounds the average to three decimals like the backend", () => {
    const stats = deriveConversationStats(
      [conversation("c1"), conversation("c2"), conversation("c3")],
      [message("m1", "c1"), message("m2", "c1"), message("m3", "c2")],
      REFERENCE_NOW,
    );
    expect(stats.average_messages_per_conversation).toBe(1.0);
  });

  it("ignores a missing message status without affecting the totals", () => {
    const stats = deriveConversationStats(
      [conversation("c1")],
      [message("m1", "c1", { status: undefined }), message("m2", "c1", { role: "user" })],
      REFERENCE_NOW,
    );
    expect(stats.total_messages).toBe(2);
    expect((stats.by_status ?? []).reduce((sum, entry) => sum + entry.count, 0)).toBe(1);
  });

  it("mirrors the backend snapshot over the authoritative seeds", () => {
    const stats = deriveConversationStats(CONVERSATIONS, MESSAGES, REFERENCE_NOW);
    expect(stats.total_conversations).toBe(CONVERSATIONS.length);
    expect(stats.total_messages).toBe(MESSAGES.length);
    expect(stats.generated_at).toBe(REFERENCE_NOW);
    expect((stats.by_role ?? []).reduce((sum, entry) => sum + entry.count, 0)).toBe(
      MESSAGES.length,
    );
    expect((stats.by_status ?? []).reduce((sum, entry) => sum + entry.count, 0)).toBe(
      MESSAGES.length,
    );
  });

  it("scopes both conversations and messages to one project", () => {
    const stats = deriveConversationStats(CONVERSATIONS, MESSAGES, REFERENCE_NOW, {
      projectId: filmId,
    });
    const scopedConversations = CONVERSATIONS.filter((item) => item.project_id === filmId);
    const ids = new Set(scopedConversations.map((item) => item.id));
    expect(stats.total_conversations).toBe(scopedConversations.length);
    expect(stats.total_messages).toBe(
      MESSAGES.filter((item) => ids.has(item.conversation_id)).length,
    );
    expect(stats.last_activity_at).toBe(
      scopedConversations.reduce<string | null>(
        (latest, item) =>
          latest === null || item.updated_at.localeCompare(latest) > 0
            ? item.updated_at
            : latest,
        null,
      ),
    );
  });
});

describe("validateConversationStatsArgs", () => {
  it("rejects a malformed project id with a 422 envelope", () => {
    expect(() => validateConversationStatsArgs({ projectId: "not-a-uuid" })).toThrowError(
      expect.objectContaining({
        status: 422,
        code: "validation_error",
        details: [expect.objectContaining({ field: "project_id" })],
      }),
    );
  });

  it("accepts a valid uuid or an omitted scope", () => {
    expect(() => validateConversationStatsArgs()).not.toThrow();
    expect(() => validateConversationStatsArgs({ projectId: filmId })).not.toThrow();
  });
});

describe("conversationStatsQueryParams", () => {
  it("maps the project scope to the authoritative query string", () => {
    expect(conversationStatsQueryParams()).toEqual({ project_id: undefined });
    expect(conversationStatsQueryParams({ projectId: "p1" })).toEqual({ project_id: "p1" });
  });
});
