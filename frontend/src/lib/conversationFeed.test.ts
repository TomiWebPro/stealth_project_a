import { describe, expect, it } from "vitest";

import {
  conversationFeedQueryParams,
  deriveConversationFeed,
  UNKNOWN_CONVERSATION_PROJECT_NAME,
  validateConversationFeedArgs,
} from "./conversationFeed";
import type { Conversation, Message, Project } from "./types";

const NOW = "2026-03-18T10:30:00.000Z";
const P1 = "0b5c1e2a-1000-4000-8000-000000000001";
const P2 = "0b5c1e2a-1000-4000-8000-000000000002";
const C1 = "0b5c1e2a-5000-4000-8000-000000000001";
const C2 = "0b5c1e2a-5000-4000-8000-000000000002";
const C3 = "0b5c1e2a-5000-4000-8000-000000000003";

const PROJECTS: readonly Project[] = [
  { id: P1, name: "Moonshot", org_id: "org", created_by: "user", created_at: NOW, updated_at: NOW },
  { id: P2, name: "Brand Film", org_id: "org", created_by: "user", created_at: NOW, updated_at: NOW },
];

function conversation(id: string, projectId: string, updatedAt: string, count: number): Conversation {
  return {
    id,
    project_id: projectId,
    title: `Conversation ${id.slice(-1)}`,
    created_by: "user",
    created_at: NOW,
    updated_at: updatedAt,
    message_count: count,
  };
}

function message(id: string, conversationId: string, role: Message["role"], content: string, at: string): Message {
  return { id, conversation_id: conversationId, role, content, created_at: at };
}

const CONVERSATIONS: readonly Conversation[] = [
  conversation(C1, P1, "2026-03-18T08:00:00.000Z", 3),
  conversation(C2, P2, "2026-03-18T09:00:00.000Z", 1),
  conversation(C3, P2, "2026-03-18T08:00:00.000Z", 0),
];

const MESSAGES: readonly Message[] = [
  message("0b5c1e2a-5100-4000-8000-000000000001", C1, "user", "Plan the shots.", "2026-03-18T07:00:00.000Z"),
  message("0b5c1e2a-5100-4000-8000-000000000002", C1, "assistant", "  Sure,\n let's  go. ", "2026-03-18T07:01:00.000Z"),
  message("0b5c1e2a-5100-4000-8000-000000000003", C2, "assistant", "Done.", "2026-03-18T08:30:00.000Z"),
];

describe("deriveConversationFeed", () => {
  it("returns an empty feed when there are no conversations", () => {
    expect(deriveConversationFeed([], MESSAGES, PROJECTS, NOW)).toEqual({
      items: [],
      total: 0,
      generated_at: NOW,
    });
  });

  it("orders newest-first with a conversation-id tie-break and joins project names", () => {
    const feed = deriveConversationFeed([...CONVERSATIONS].reverse(), MESSAGES, PROJECTS, NOW);

    expect(feed.total).toBe(3);
    expect(feed.generated_at).toBe(NOW);
    expect((feed.items ?? []).map((item) => item.conversation_id)).toEqual([C2, C3, C1]);
    expect((feed.items ?? [])[0]).toMatchObject({
      conversation_id: C2,
      project_id: P2,
      project_name: "Brand Film",
      title: "Conversation 2",
      message_count: 1,
      last_message_role: "assistant",
      last_message_excerpt: "Done.",
    });
    expect(deriveConversationFeed(CONVERSATIONS, MESSAGES, PROJECTS, NOW)).toEqual(feed);
  });

  it("breaks updated-at ties by descending conversation id", () => {
    const tied = [
      conversation(C1, P1, "2026-03-18T08:00:00.000Z", 0),
      conversation(C2, P1, "2026-03-18T08:00:00.000Z", 0),
    ];
    expect(
      deriveConversationFeed(tied, [], PROJECTS, NOW).items?.map((item) => item.conversation_id),
    ).toEqual([C2, C1]);
  });

  it("normalizes and truncates the newest message excerpt with a deterministic tie-break", () => {
    const tiedMessages = [
      message("0b5c1e2a-5100-4000-8000-000000000009", C1, "user", "second", "2026-03-18T07:01:00.000Z"),
      message("0b5c1e2a-5100-4000-8000-000000000008", C1, "assistant", "first", "2026-03-18T07:01:00.000Z"),
    ];
    const feed = deriveConversationFeed([CONVERSATIONS[0]!], tiedMessages, PROJECTS, NOW);
    expect((feed.items ?? [])[0]?.last_message_role).toBe("user");
    expect((feed.items ?? [])[0]?.last_message_excerpt).toBe("second");

    const normalized = deriveConversationFeed(
      [CONVERSATIONS[0]!],
      [MESSAGES[1]!],
      PROJECTS,
      NOW,
    );
    expect((normalized.items ?? [])[0]?.last_message_excerpt).toBe("Sure, let's go.");

    const long = "x".repeat(170);
    const truncated = deriveConversationFeed(
      [CONVERSATIONS[0]!],
      [message("0b5c1e2a-5100-4000-8000-000000000010", C1, "assistant", long, NOW)],
      PROJECTS,
      NOW,
    );
    expect((truncated.items ?? [])[0]?.last_message_excerpt).toBe("x".repeat(160) + "…");
  });

  it("uses null preview fields for an empty conversation and the fallback for a missing project", () => {
    const orphan = conversation(C1, "00000000-0000-4000-8000-000000000000", NOW, 0);
    const feed = deriveConversationFeed([orphan], [], PROJECTS, NOW);
    expect((feed.items ?? [])[0]).toMatchObject({
      project_name: UNKNOWN_CONVERSATION_PROJECT_NAME,
      last_message_role: null,
      last_message_excerpt: null,
    });
  });

  it("scopes to one project and counts the whole feed before the limit page", () => {
    const scoped = deriveConversationFeed(CONVERSATIONS, MESSAGES, PROJECTS, NOW, { projectId: P2 });
    expect(scoped.total).toBe(2);
    expect((scoped.items ?? []).map((item) => item.project_id)).toEqual([P2, P2]);

    const empty = deriveConversationFeed(CONVERSATIONS, MESSAGES, PROJECTS, NOW, {
      projectId: "00000000-0000-4000-8000-000000000000",
    });
    expect(empty).toEqual({ items: [], total: 0, generated_at: NOW });

    const paged = deriveConversationFeed(CONVERSATIONS, MESSAGES, PROJECTS, NOW, { limit: 2 });
    expect(paged.total).toBe(3);
    expect((paged.items ?? []).map((item) => item.conversation_id)).toEqual([C2, C3]);
  });
});

describe("conversation feed query helpers", () => {
  it("mirrors router validation for a malformed project id or limit", () => {
    expect(() => validateConversationFeedArgs()).not.toThrow();
    expect(() => validateConversationFeedArgs({ projectId: P1, limit: 10 })).not.toThrow();
    for (const bad of [{ projectId: "not-a-uuid" }, { limit: 0 }, { limit: 201 }, { limit: 1.5 }]) {
      try {
        validateConversationFeedArgs(bad);
        throw new Error("expected validation to fail");
      } catch (cause) {
        expect(cause).toMatchObject({ status: 422, code: "validation_error" });
      }
    }
  });

  it("maps the scope and page onto the live query string", () => {
    expect(conversationFeedQueryParams()).toEqual({ project_id: undefined, limit: undefined });
    expect(conversationFeedQueryParams({ projectId: P1, limit: 5 })).toEqual({
      project_id: P1,
      limit: 5,
    });
  });
});
