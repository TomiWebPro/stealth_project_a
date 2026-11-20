import { describe, expect, it } from "vitest";

import { REFERENCE_NOW } from "./mock/data";
import type { Conversation, Message, Project } from "./types";
import {
  DEFAULT_MESSAGE_OVERVIEW_RECENT_LIMIT,
  deriveMessageOverview,
  messageOverviewQueryParams,
  validateMessageOverviewArgs,
} from "./messageOverview";
import type { MessageOverviewSeeds } from "./messageOverview";

const CONVERSATION_A = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const PROJECT_A = "11111111-1111-4111-8111-111111111111";
const CREATOR = "0b5c1e2a-0000-4000-8000-0000000000aa";
const UNKNOWN_ID = "00000000-0000-4000-8000-000000000000";

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

function seeds(overrides: Partial<MessageOverviewSeeds> = {}): MessageOverviewSeeds {
  return {
    conversations: [conversation(CONVERSATION_A)],
    messages: [],
    projects: [project(PROJECT_A)],
    now: REFERENCE_NOW,
    ...overrides,
  };
}

const CHRONOLOGICAL = [
  message("m1", { role: "user", created_at: "2026-01-01T00:00:00.000Z" }),
  message("m2", { role: "assistant", status: "streaming", operation_id: "dataset-prep", created_at: "2026-01-02T00:00:00.000Z" }),
  message("m3", { role: "assistant", status: "error", created_at: "2026-01-03T00:00:00.000Z" }),
];

describe("deriveMessageOverview", () => {
  it("projects one message's identity, context and 1-based chronological position", () => {
    const overview = deriveMessageOverview(
      CONVERSATION_A,
      "m2",
      seeds({
        projects: [project(PROJECT_A, { name: "Moonshot" })],
        conversations: [conversation(CONVERSATION_A, { title: "s01 plan" })],
        messages: CHRONOLOGICAL,
      }),
    );
    expect(overview.message_id).toBe("m2");
    expect(overview.conversation_id).toBe(CONVERSATION_A);
    expect(overview.conversation_title).toBe("s01 plan");
    expect(overview.project_id).toBe(PROJECT_A);
    expect(overview.project_name).toBe("Moonshot");
    expect(overview.role).toBe("assistant");
    expect(overview.status).toBe("streaming");
    expect(overview.operation_id).toBe("dataset-prep");
    expect(overview.position).toBe(2);
    expect(overview.generated_at).toBe(REFERENCE_NOW);
  });

  it("counts the whole conversation into zero-filled role/status buckets, excluding other conversations", () => {
    const overview = deriveMessageOverview(
      CONVERSATION_A,
      "m1",
      seeds({
        messages: [
          ...CHRONOLOGICAL,
          message("m4", { role: "tool", created_at: "2026-01-04T00:00:00.000Z" }),
          message("other", { conversation_id: "other-conversation" }),
        ],
      }),
    );
    expect(overview.counts.total).toBe(4);
    expect(overview.counts.by_role).toEqual([
      { role: "system", count: 0 },
      { role: "user", count: 1 },
      { role: "assistant", count: 2 },
      { role: "tool", count: 1 },
    ]);
    expect(overview.counts.by_status).toEqual([
      { status: "pending", count: 0 },
      { status: "streaming", count: 1 },
      { status: "complete", count: 2 },
      { status: "error", count: 1 },
    ]);
  });

  it("breaks created_at ties by id for a deterministic position", () => {
    const overview = deriveMessageOverview(
      CONVERSATION_A,
      "m2",
      seeds({
        messages: [
          message("m1", { created_at: "2026-01-01T00:00:00.000Z" }),
          message("m2", { created_at: "2026-01-01T00:00:00.000Z" }),
        ],
      }),
    );
    expect(overview.position).toBe(2);
  });

  it("emits newest-first siblings bounded by recent_limit without bounding counts", () => {
    const whole = deriveMessageOverview(CONVERSATION_A, "m1", seeds({ messages: CHRONOLOGICAL }));
    const limited = deriveMessageOverview(CONVERSATION_A, "m1", seeds({ messages: CHRONOLOGICAL }), {
      recentLimit: 2,
    });
    expect(whole.recent_siblings?.map((m) => m.id)).toEqual(["m3", "m2", "m1"]);
    expect(limited.recent_siblings?.map((m) => m.id)).toEqual(["m3", "m2"]);
    expect(limited.counts).toEqual(whole.counts);
    expect(limited.position).toBe(whole.position);
  });

  it("uses an Unknown project fallback for an unseeded project", () => {
    const overview = deriveMessageOverview(
      CONVERSATION_A,
      "m1",
      seeds({
        conversations: [conversation(CONVERSATION_A, { project_id: UNKNOWN_ID })],
        messages: [message("m1")],
        projects: [],
      }),
    );
    expect(overview.project_name).toBe("Unknown project");
  });

  it("throws conversation_not_found for an unknown conversation", () => {
    expect(() => deriveMessageOverview(UNKNOWN_ID, "m1", seeds())).toThrowError(
      expect.objectContaining({ status: 404, code: "conversation_not_found" }),
    );
  });

  it("throws message_not_found when the message is absent from the conversation", () => {
    expect(() => deriveMessageOverview(CONVERSATION_A, "missing", seeds({ messages: CHRONOLOGICAL }))).toThrowError(
      expect.objectContaining({ status: 404, code: "message_not_found" }),
    );
    // A message id that belongs to another conversation is never mistaken for one here.
    expect(() =>
      deriveMessageOverview(CONVERSATION_A, "other", seeds({ messages: [message("other", { conversation_id: "other-conversation" })] })),
    ).toThrowError(expect.objectContaining({ status: 404, code: "message_not_found" }));
  });
});

describe("validateMessageOverviewArgs", () => {
  it("accepts well-formed ids and a valid recent limit", () => {
    expect(() =>
      validateMessageOverviewArgs(CONVERSATION_A, CONVERSATION_A, {
        recentLimit: DEFAULT_MESSAGE_OVERVIEW_RECENT_LIMIT,
      }),
    ).not.toThrow();
    expect(() => validateMessageOverviewArgs(CONVERSATION_A, CONVERSATION_A)).not.toThrow();
  });

  it("rejects a malformed conversation id", () => {
    expect(() => validateMessageOverviewArgs("not-a-uuid", CONVERSATION_A)).toThrowError(
      expect.objectContaining({ status: 422, code: "validation_error" }),
    );
  });

  it("rejects a malformed message id", () => {
    expect(() => validateMessageOverviewArgs(CONVERSATION_A, "not-a-uuid")).toThrowError(
      expect.objectContaining({ status: 422, code: "validation_error" }),
    );
  });

  it("rejects an out-of-range recent limit", () => {
    for (const recentLimit of [0, 51, -1, 1.5]) {
      expect(() => validateMessageOverviewArgs(CONVERSATION_A, CONVERSATION_A, { recentLimit })).toThrowError(
        expect.objectContaining({ status: 422, code: "validation_error" }),
      );
    }
  });
});

describe("messageOverviewQueryParams", () => {
  it("maps the recent limit to the wire query param", () => {
    expect(messageOverviewQueryParams()).toEqual({ recent_limit: undefined });
    expect(messageOverviewQueryParams({ recentLimit: 3 })).toEqual({ recent_limit: 3 });
  });
});
