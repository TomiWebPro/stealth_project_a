import { describe, expect, it } from "vitest";

import { ApiError } from "../api/client";
import { REFERENCE_NOW } from "./mock/data";
import type { Conversation, Message, Project } from "./types";
import {
  DEFAULT_CONVERSATION_OVERVIEW_RECENT_LIMIT,
  conversationOverviewQueryParams,
  deriveConversationOverview,
  validateConversationOverviewArgs,
} from "./conversationOverview";
import type { ConversationOverviewSeeds } from "./conversationOverview";

const CONVERSATION_A = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const PROJECT_A = "11111111-1111-4111-8111-111111111111";
const CREATOR = "0b5c1e2a-0000-4000-8000-0000000000aa";

function project(id: string, overrides: Partial<Project> = {}): Project {
  return {
    id,
    org_id: "0b5c1e2a-0000-4000-8000-00000000000a",
    name: `project-${id}`,
    created_by: CREATOR,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function conversation(id: string, overrides: Partial<Conversation> = {}): Conversation {
  return {
    id,
    project_id: PROJECT_A,
    title: `conversation-${id}`,
    created_by: CREATOR,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-02T00:00:00.000Z",
    message_count: 0,
    ...overrides,
  };
}

function message(id: string, overrides: Partial<Message> = {}): Message {
  return {
    id,
    conversation_id: CONVERSATION_A,
    role: "user",
    content: `message-${id}`,
    status: "complete",
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function seeds(overrides: Partial<ConversationOverviewSeeds> = {}): ConversationOverviewSeeds {
  return {
    conversations: [conversation(CONVERSATION_A)],
    messages: [],
    projects: [project(PROJECT_A)],
    now: REFERENCE_NOW,
    ...overrides,
  };
}

describe("deriveConversationOverview", () => {
  it("zero-fills counts and the recent-message list for a conversation with no messages", () => {
    const overview = deriveConversationOverview(CONVERSATION_A, seeds());
    expect(overview).toEqual({
      conversation_id: CONVERSATION_A,
      project_id: PROJECT_A,
      project_name: `project-${PROJECT_A}`,
      title: `conversation-${CONVERSATION_A}`,
      created_by: CREATOR,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-02T00:00:00.000Z",
      message_count: 0,
      last_message_role: null,
      last_message_excerpt: null,
      counts: {
        total: 0,
        by_role: [
          { role: "system", count: 0 },
          { role: "user", count: 0 },
          { role: "assistant", count: 0 },
          { role: "tool", count: 0 },
        ],
        by_status: [
          { status: "pending", count: 0 },
          { status: "streaming", count: 0 },
          { status: "complete", count: 0 },
          { status: "error", count: 0 },
        ],
      },
      recent_messages: [],
      generated_at: REFERENCE_NOW,
    });
  });

  it("derives identity, the last-message preview and zero-filled role/status counts", () => {
    const overview = deriveConversationOverview(
      CONVERSATION_A,
      seeds({
        projects: [project(PROJECT_A, { name: "Moonshot" })],
        conversations: [conversation(CONVERSATION_A, { title: "Shot review", message_count: 4 })],
        messages: [
          message("m1", { role: "system", status: undefined, created_at: "2026-01-01T00:00:00.000Z" }),
          message("m2", { role: "user", created_at: "2026-01-02T00:00:00.000Z" }),
          message("m3", { role: "assistant", created_at: "2026-01-03T00:00:00.000Z" }),
          message("m4", { role: "assistant", status: "error", created_at: "2026-01-04T00:00:00.000Z" }),
          message("other", { conversation_id: "other-conversation" }),
        ],
      }),
    );
    expect(overview.title).toBe("Shot review");
    expect(overview.project_name).toBe("Moonshot");
    expect(overview.message_count).toBe(4);
    expect(overview.last_message_role).toBe("assistant");
    expect(overview.last_message_excerpt).toBe("message-m4");
    expect(overview.counts.total).toBe(4);
    expect(overview.counts.by_role).toEqual([
      { role: "system", count: 1 },
      { role: "user", count: 1 },
      { role: "assistant", count: 2 },
      { role: "tool", count: 0 },
    ]);
    expect(overview.counts.by_status).toEqual([
      { status: "pending", count: 0 },
      { status: "streaming", count: 0 },
      { status: "complete", count: 2 },
      { status: "error", count: 1 },
    ]);
  });

  it("falls back to 'Unknown project' when the parent project is missing", () => {
    const overview = deriveConversationOverview(CONVERSATION_A, seeds({ projects: [] }));
    expect(overview.project_name).toBe("Unknown project");
  });

  it("returns recent messages newest-first with an id tie-break and bounds them", () => {
    const overview = deriveConversationOverview(
      CONVERSATION_A,
      seeds({
        conversations: [conversation(CONVERSATION_A, { message_count: 4 })],
        messages: [
          message("a", { created_at: "2026-01-01T00:00:00.000Z" }),
          message("b", { created_at: "2026-01-02T00:00:00.000Z" }),
          message("c", { created_at: "2026-01-03T00:00:00.000Z" }),
          // Same timestamp as "c" but a larger id sorts ahead of it.
          message("d", { created_at: "2026-01-03T00:00:00.000Z" }),
        ],
      }),
      { recentLimit: 2 },
    );
    expect(overview.counts.total).toBe(4); // whole stream, not the page
    expect(overview.recent_messages?.map((item) => item.id)).toEqual(["d", "c"]);
  });

  it("defaults the recent limit to five", () => {
    const messages = Array.from({ length: 7 }, (_, index) =>
      message(`m${index}`, { created_at: `2026-01-0${index + 1}T00:00:00.000Z` }),
    );
    const overview = deriveConversationOverview(CONVERSATION_A, seeds({ messages }));
    expect(overview.recent_messages).toHaveLength(DEFAULT_CONVERSATION_OVERVIEW_RECENT_LIMIT);
  });

  it("normalizes the excerpt preview with the conversation-feed rule", () => {
    const overview = deriveConversationOverview(
      CONVERSATION_A,
      seeds({
        messages: [message("m1", { content: "  line one\n  line two  " })],
      }),
    );
    expect(overview.last_message_excerpt).toBe("line one line two");
  });

  it("rejects an unknown conversation with a 404", () => {
    expect(() => deriveConversationOverview(CONVERSATION_A, seeds({ conversations: [] }))).toThrow(
      expect.objectContaining({ status: 404, code: "not_found" }),
    );
  });
});

describe("validateConversationOverviewArgs", () => {
  it("accepts a well-formed id and an in-range recent limit", () => {
    expect(() => validateConversationOverviewArgs(CONVERSATION_A, { recentLimit: 50 })).not.toThrow();
    expect(() => validateConversationOverviewArgs(CONVERSATION_A)).not.toThrow();
  });

  it("mirrors the router 422 envelope for a malformed id or out-of-range limit", () => {
    for (const bad of [
      () => validateConversationOverviewArgs("not-a-uuid"),
      () => validateConversationOverviewArgs(CONVERSATION_A, { recentLimit: 0 }),
      () => validateConversationOverviewArgs(CONVERSATION_A, { recentLimit: 51 }),
    ]) {
      try {
        bad();
        throw new Error("expected a validation error");
      } catch (cause) {
        expect(cause).toBeInstanceOf(ApiError);
        expect(cause).toMatchObject({ status: 422, code: "validation_error" });
      }
    }
  });
});

describe("conversationOverviewQueryParams", () => {
  it("maps the recent limit to the wire query parameter", () => {
    expect(conversationOverviewQueryParams()).toEqual({ recent_limit: undefined });
    expect(conversationOverviewQueryParams({ recentLimit: 3 })).toEqual({ recent_limit: 3 });
  });
});
