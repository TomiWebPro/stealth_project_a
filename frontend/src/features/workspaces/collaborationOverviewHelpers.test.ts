import { describe, expect, it } from "vitest";
import type {
  CollaborationFeed,
  CollaborationFeedItem,
  CollaborationOverview,
} from "../../lib/types";
import {
  COLLABORATION_OVERVIEW_LIMITS,
  COLLABORATION_OVERVIEW_PICKER_LIMIT,
  COLLABORATION_OVERVIEW_RECENT_LIMIT,
  buildCollaborationOverviewOptions,
  buildCollaborationOverviewPickerOptions,
  collaborationOverviewActiveOption,
  collaborationOverviewEmptyDescription,
  collaborationOverviewGeneratedAtLabel,
  collaborationOverviewIdentity,
  collaborationOverviewPickerOptions,
  collaborationOverviewProjectComments,
  collaborationOverviewProjectParticipants,
  collaborationOverviewProjectPresence,
  collaborationOverviewProjectSignals,
  collaborationOverviewRecentSignals,
  collaborationOverviewRelativeLabel,
  collaborationOverviewSignalDetail,
  collaborationOverviewSignalLabel,
  collaborationOverviewSignalTone,
  collaborationOverviewStateLabel,
  collaborationOverviewStateRows,
  collaborationOverviewStateTone,
  collaborationOverviewStatRows,
  collaborationOverviewSummaryLabel,
  collaborationOverviewWorkspaceSignals,
  hasCollaborationOverviewData,
} from "./collaborationOverviewHelpers";

const NOW = Date.parse("2026-01-01T01:00:00Z");
const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const PRESENCE_USER = "22222222-2222-4222-8222-222222222222";
const COMMENT_ID = "33333333-3333-4333-8333-333333333333";
const PRESENCE_KEY = `presence:${PROJECT_ID}:${PRESENCE_USER}`;
const COMMENT_KEY = `comment:${PROJECT_ID}:${COMMENT_ID}`;

function presenceItem(overrides: Partial<CollaborationFeedItem> = {}): CollaborationFeedItem {
  return {
    signal_id: PRESENCE_USER,
    signal: "presence",
    project_id: PROJECT_ID,
    project_name: "A Short Film",
    actor_id: PRESENCE_USER,
    state: "online",
    body: null,
    asset_id: null,
    occurred_at: "2026-01-01T00:59:00Z",
    ...overrides,
  };
}

function commentItem(overrides: Partial<CollaborationFeedItem> = {}): CollaborationFeedItem {
  return {
    signal_id: COMMENT_ID,
    signal: "comment",
    project_id: PROJECT_ID,
    project_name: "A Short Film",
    actor_id: PRESENCE_USER,
    state: null,
    body: "  Nice   shot  composition ",
    asset_id: "44444444-4444-4444-8444-444444444444",
    occurred_at: "2026-01-01T00:58:00Z",
    ...overrides,
  };
}

function overview(overrides: Partial<CollaborationOverview> = {}): CollaborationOverview {
  return {
    signal_id: PRESENCE_USER,
    signal: "presence",
    project_id: PROJECT_ID,
    project_name: "A Short Film",
    actor_id: PRESENCE_USER,
    state: "online",
    body: null,
    asset_id: null,
    occurred_at: "2026-01-01T00:59:00Z",
    counts: {
      project_signals: 4,
      project_presence: 2,
      project_comments: 2,
      project_participants: 2,
      workspace_signals: 40,
      by_state: [
        { state: "online", count: 1 },
        { state: "away", count: 1 },
        { state: "offline", count: 0 },
      ],
    },
    recent_signals: [presenceItem(), commentItem()],
    generated_at: "2026-01-01T00:59:30Z",
    ...overrides,
  };
}

function feed(): CollaborationFeed {
  return { items: [presenceItem(), commentItem()], total: 2, generated_at: "2026-01-01T01:00:00Z" };
}

describe("query option builders", () => {
  it("defaults to the canonical recent bound", () => {
    expect(buildCollaborationOverviewOptions()).toEqual({
      recentLimit: COLLABORATION_OVERVIEW_RECENT_LIMIT,
    });
  });

  it("passes through an explicit page bound", () => {
    expect(buildCollaborationOverviewOptions(10)).toEqual({ recentLimit: 10 });
  });

  it("exposes the three offered page-size chips", () => {
    expect(COLLABORATION_OVERVIEW_LIMITS).toEqual([5, 10, 25]);
  });

  it("builds an unbounded workspace picker or a project-scoped one", () => {
    expect(buildCollaborationOverviewPickerOptions()).toEqual({
      limit: COLLABORATION_OVERVIEW_PICKER_LIMIT,
    });
    expect(buildCollaborationOverviewPickerOptions(PROJECT_ID)).toEqual({
      limit: COLLABORATION_OVERVIEW_PICKER_LIMIT,
      projectId: PROJECT_ID,
    });
  });
});

describe("count helpers", () => {
  it("reads each authoritative count bucket", () => {
    expect(collaborationOverviewProjectSignals(overview())).toBe(4);
    expect(collaborationOverviewProjectPresence(overview())).toBe(2);
    expect(collaborationOverviewProjectComments(overview())).toBe(2);
    expect(collaborationOverviewProjectParticipants(overview())).toBe(2);
    expect(collaborationOverviewWorkspaceSignals(overview())).toBe(40);
  });

  it("zero-fills absent, negative and non-finite counts", () => {
    expect(collaborationOverviewProjectSignals()).toBe(0);
    expect(collaborationOverviewProjectPresence(overview({ counts: {} as never }))).toBe(0);
    expect(collaborationOverviewWorkspaceSignals(overview({ counts: { workspace_signals: -2 } as never }))).toBe(0);
    expect(collaborationOverviewProjectParticipants(overview({ counts: { project_participants: Number.NaN } as never }))).toBe(0);
  });
});

describe("labels, tones and details", () => {
  it("formats relative and generated-at labels against the given clock", () => {
    expect(collaborationOverviewRelativeLabel("2026-01-01T00:59:00Z", NOW)).toBe("1 minute ago");
    expect(collaborationOverviewGeneratedAtLabel(overview(), NOW)).toBe("30 seconds ago");
    expect(collaborationOverviewRelativeLabel()).toBe("");
    expect(collaborationOverviewGeneratedAtLabel()).toBe("");
  });

  it("reuses canonical signal/state labels and tones with safe fallbacks", () => {
    expect(collaborationOverviewSignalLabel("presence")).toBe("Presence");
    expect(collaborationOverviewSignalLabel()).toBe("Signal");
    expect(collaborationOverviewSignalTone("comment")).toBe("accent");
    expect(collaborationOverviewSignalTone()).toBe("neutral");
    expect(collaborationOverviewStateLabel("away")).toBe("Away");
    expect(collaborationOverviewStateLabel()).toBe("");
    expect(collaborationOverviewStateTone("offline")).toBe("neutral");
    expect(collaborationOverviewStateTone()).toBe("neutral");
  });

  it("renders a state label for presence and a normalized body preview for comments", () => {
    expect(collaborationOverviewSignalDetail("presence", "online", null)).toBe("Online");
    expect(collaborationOverviewSignalDetail("comment", null, "  Nice   shot  composition ")).toBe(
      "Nice shot composition",
    );
    expect(collaborationOverviewSignalDetail()).toBe("");
  });
});

describe("collaborationOverviewIdentity", () => {
  it("derives the presence header identity from the snapshot", () => {
    expect(collaborationOverviewIdentity(overview(), NOW)).toEqual({
      signalLabel: "Presence",
      signalTone: "info",
      hasState: true,
      stateLabel: "Online",
      stateTone: "success",
      detail: "Online",
      projectLabel: "A Short Film",
      actorLabel: "Actor 22222222…",
      relativeTime: "1 minute ago",
    });
  });

  it("uses the body preview for a comment signal", () => {
    const comment = overview({ signal: "comment", state: null, body: "  Ready for review " });
    const identity = collaborationOverviewIdentity(comment, NOW);
    expect(identity.signalLabel).toBe("Comment");
    expect(identity.hasState).toBe(false);
    expect(identity.detail).toBe("Ready for review");
  });

  it("zero-fills an absent snapshot", () => {
    expect(collaborationOverviewIdentity(undefined, NOW)).toEqual({
      signalLabel: "Signal",
      signalTone: "neutral",
      hasState: false,
      stateLabel: "",
      stateTone: "neutral",
      detail: "",
      projectLabel: "",
      actorLabel: "Actor",
      relativeTime: "",
    });
  });
});

describe("collaborationOverviewStatRows", () => {
  it("exposes the four headline counters in a stable order", () => {
    const rows = collaborationOverviewStatRows(overview());
    expect(rows.map((row) => row.key)).toEqual([
      "project-signals",
      "participants",
      "workspace-signals",
      "page",
    ]);
    expect(rows.map((row) => row.value)).toEqual(["4", "2", "40", "2"]);
  });

  it("zero-fills an absent snapshot", () => {
    expect(collaborationOverviewStatRows().every((row) => row.value === "0")).toBe(true);
  });
});

describe("collaborationOverviewStateRows", () => {
  it("returns the canonical zero-filled three-state breakdown with shares", () => {
    const rows = collaborationOverviewStateRows(overview());
    expect(rows.map((row) => row.state)).toEqual(["online", "away", "offline"]);
    expect(rows.map((row) => row.count)).toEqual([1, 1, 0]);
    expect(rows.map((row) => row.percent)).toEqual([50, 50, 0]);
    expect(rows[0]?.fraction).toBeCloseTo(0.5);
    expect(rows[0]?.label).toBe("Online");
  });

  it("keeps every share at zero when no presence is present", () => {
    const rows = collaborationOverviewStateRows(overview({ counts: {} as never }));
    expect(rows.every((row) => row.fraction === 0 && row.percent === 0)).toBe(true);
  });
});

describe("collaborationOverviewRecentSignals", () => {
  it("derives sibling rows and highlights the selected signal", () => {
    const rows = collaborationOverviewRecentSignals(overview(), NOW);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.id).toBe(PRESENCE_KEY);
    expect(rows[0]?.isCurrent).toBe(true);
    expect(rows[0]?.signalLabel).toBe("Presence");
    expect(rows[0]?.stateLabel).toBe("Online");
    expect(rows[0]?.relativeTime).toBe("1 minute ago");
    expect(rows[1]?.id).toBe(COMMENT_KEY);
    expect(rows[1]?.isCurrent).toBe(false);
    expect(rows[1]?.detail).toBe("Nice shot composition");
  });

  it("returns no rows for an absent snapshot", () => {
    expect(collaborationOverviewRecentSignals()).toEqual([]);
  });
});

describe("data detection and summaries", () => {
  it("detects missing, empty and populated snapshots", () => {
    expect(hasCollaborationOverviewData()).toBe(false);
    expect(
      hasCollaborationOverviewData(overview({ counts: {} as never, recent_signals: [] })),
    ).toBe(false);
    expect(hasCollaborationOverviewData(overview())).toBe(true);
  });

  it("builds a one-line summary and scope-aware empty copy", () => {
    expect(collaborationOverviewSummaryLabel(overview())).toBe("4 signals · 2 participants");
    expect(collaborationOverviewSummaryLabel()).toBe("");
    expect(collaborationOverviewEmptyDescription(true)).toContain("this project");
    expect(collaborationOverviewEmptyDescription(false)).toContain("teammates");
  });
});

describe("signal picker", () => {
  it("derives options in feed order from the composite signal key", () => {
    const options = collaborationOverviewPickerOptions(feed(), NOW);
    expect(options.map((option) => option.value)).toEqual([PRESENCE_KEY, COMMENT_KEY]);
    expect(options.every((option) => option.signalKey === option.value)).toBe(true);
    expect(options[0]?.label).toContain("Presence");
    expect(options[0]?.label).toContain("1 minute ago");
    expect(options[1]?.label).toContain("Nice shot composition");
    expect(collaborationOverviewPickerOptions(undefined)).toEqual([]);
  });

  it("resolves the selected option and falls back to the first row", () => {
    const options = collaborationOverviewPickerOptions(feed(), NOW);
    expect(collaborationOverviewActiveOption(options, COMMENT_KEY)?.signalKey).toBe(COMMENT_KEY);
    expect(collaborationOverviewActiveOption(options, "missing")?.signalKey).toBe(PRESENCE_KEY);
    expect(collaborationOverviewActiveOption([], "missing")).toBeUndefined();
  });
});
