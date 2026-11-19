import { describe, expect, it } from "vitest";
import type { CollaborationFeed, CollaborationFeedItem } from "../../lib/types";
import {
  COLLABORATION_FEED_LIMITS,
  COLLABORATION_FEED_SIGNAL_FILTERS,
  buildCollaborationFeedOptions,
  collaborationBodyPreview,
  collaborationFeedEmptyDescription,
  collaborationFeedGeneratedAtLabel,
  collaborationFeedRows,
  collaborationFeedSummary,
  collaborationSignalChipLabel,
  collaborationSignalTone,
  presenceStateLabel,
  presenceStateTone,
  shortCollaborationId,
} from "./collaborationFeedHelpers";

const NOW = Date.parse("2026-01-01T01:00:00Z");

const presenceSignal: CollaborationFeedItem = {
  signal_id: "user-aaaa-1111",
  signal: "presence",
  project_id: "proj-bbbb-2222",
  project_name: "A Short Film",
  actor_id: "user-aaaa-1111",
  state: "online",
  body: null,
  asset_id: null,
  occurred_at: "2026-01-01T00:45:00Z",
};

const commentSignal: CollaborationFeedItem = {
  signal_id: "comment-cccc-3333",
  signal: "comment",
  project_id: "proj-dddd-4444",
  project_name: "Unknown project",
  actor_id: "user-eeee-5555",
  state: null,
  body: "  Ready for the  first  review pass.  ",
  asset_id: "asset-ffff-6666",
  occurred_at: "2026-01-01T00:30:00Z",
};

const populated: CollaborationFeed = {
  items: [presenceSignal, commentSignal],
  total: 9,
  generated_at: "2026-01-01T00:59:30Z",
};

const empty: CollaborationFeed = { items: [], total: 0, generated_at: "2026-01-01T00:00:00Z" };

describe("collaboration feed display helpers", () => {
  it("builds hook options with optional project/signal scope and bounded page size", () => {
    expect(buildCollaborationFeedOptions(undefined, undefined, 25)).toEqual({ limit: 25 });
    expect(buildCollaborationFeedOptions("proj-bbbb-2222", "comment", 10)).toEqual({
      projectId: "proj-bbbb-2222",
      signal: "comment",
      limit: 10,
    });
    expect(COLLABORATION_FEED_LIMITS).toEqual([10, 25, 50]);
    expect(COLLABORATION_FEED_SIGNAL_FILTERS).toEqual([undefined, "presence", "comment"]);
  });

  it("derives readable chip labels and badge tones with safe fallbacks", () => {
    expect(collaborationSignalChipLabel(undefined)).toBe("All");
    expect(collaborationSignalChipLabel("presence")).toBe("Presence");
    expect(collaborationSignalTone("presence")).toBe("info");
    expect(collaborationSignalTone("comment")).toBe("accent");
    expect(presenceStateLabel("away")).toBe("Away");
    expect(presenceStateTone("online")).toBe("success");
    expect(presenceStateTone("offline")).toBe("neutral");
    expect(collaborationSignalTone("bogus" as never)).toBe("neutral");
  });

  it("maps a canonical feed to render-ready rows in wire order", () => {
    const rows = collaborationFeedRows(populated, NOW);
    expect(rows.map((row) => row.id)).toEqual([
      "presence:user-aaaa-1111:proj-bbbb-2222",
      "comment:comment-cccc-3333:proj-dddd-4444",
    ]);
    expect(rows[0]).toMatchObject({
      signal: "presence",
      signalLabel: "Presence",
      signalTone: "info",
      projectId: "proj-bbbb-2222",
      projectName: "A Short Film",
      actorLabel: "Actor user-aaa…",
      state: "online",
      hasState: true,
      stateLabel: "Online",
      stateTone: "success",
      hasBody: false,
      bodyPreview: "No comment text",
      hasAsset: false,
      assetId: null,
      relativeTime: "15 minutes ago",
      timestamp: "2026-01-01T00:45:00Z",
    });
    expect(rows[1]).toMatchObject({
      signal: "comment",
      signalLabel: "Comment",
      signalTone: "accent",
      projectName: "Unknown project",
      hasState: false,
      state: null,
      bodyPreview: "Ready for the first review pass.",
      hasBody: true,
      hasAsset: true,
      assetLabel: "Asset asset-ff…",
      relativeTime: "30 minutes ago",
    });
  });

  it("returns no rows for a missing or empty feed", () => {
    expect(collaborationFeedRows(undefined, NOW)).toEqual([]);
    expect(collaborationFeedRows(empty, NOW)).toEqual([]);
  });

  it("derives the header summary from visible rows and the untruncated total", () => {
    expect(collaborationFeedSummary(collaborationFeedRows(populated, NOW), 9)).toBe(
      "9 signals · latest in A Short Film",
    );
    expect(collaborationFeedSummary(collaborationFeedRows(populated, NOW))).toBe(
      "2 signals · latest in A Short Film",
    );
    expect(collaborationFeedSummary([], 0)).toBe("No signals");
    expect(
      collaborationFeedSummary(
        collaborationFeedRows({ ...populated, items: [presenceSignal] }, NOW),
        3,
      ),
    ).toBe("3 signals · latest in A Short Film");
  });

  it("formats the generated-at footer and tolerates missing feeds", () => {
    expect(collaborationFeedGeneratedAtLabel(populated, NOW)).toBe("30 seconds ago");
    expect(collaborationFeedGeneratedAtLabel(empty, NOW)).toBe("1 hour ago");
    expect(collaborationFeedGeneratedAtLabel(undefined, NOW)).toBe("");
  });

  it("derives scope- and filter-aware empty-state copy", () => {
    expect(collaborationFeedEmptyDescription(false, false)).toContain("teammates");
    expect(collaborationFeedEmptyDescription(true, false)).toContain("this project");
    expect(collaborationFeedEmptyDescription(true, true)).toContain("filter");
  });

  it("normalizes whitespace and bounds long comment bodies", () => {
    expect(collaborationBodyPreview("  a\t b\n c  ")).toBe("a b c");
    expect(collaborationBodyPreview(null)).toBe("No comment text");
    expect(collaborationBodyPreview("")).toBe("No comment text");
    expect(collaborationBodyPreview("x".repeat(300), 20)).toHaveLength(20);
    expect(collaborationBodyPreview("x".repeat(300), 20).endsWith("…")).toBe(true);
  });

  it("derives compact labels for opaque ids with stable fallbacks", () => {
    expect(shortCollaborationId("abcdef1234567890", "Actor")).toBe("Actor abcdef12…");
    expect(shortCollaborationId("tiny", "Asset")).toBe("Asset tiny");
    expect(shortCollaborationId("  ", "Actor")).toBe("Actor");
  });

  it("stays render-safe for absent state, body and asset references", () => {
    const rows = collaborationFeedRows({
      ...populated,
      items: [
        { ...presenceSignal, state: undefined as unknown as null },
        { ...commentSignal, body: undefined as unknown as string, asset_id: undefined as unknown as null },
      ],
    });
    expect(rows[0]?.hasState).toBe(false);
    expect(rows[0]?.stateLabel).toBe("");
    expect(rows[1]?.hasBody).toBe(false);
    expect(rows[1]?.hasAsset).toBe(false);
    expect(rows[1]?.bodyPreview).toBe("No comment text");
  });
});
