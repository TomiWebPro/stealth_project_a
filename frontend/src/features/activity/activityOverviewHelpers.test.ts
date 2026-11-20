import { describe, expect, it } from "vitest";
import type {
  ActivityEvent,
  ActivityFeed,
  ActivityOverview,
} from "../../lib/types";
import {
  ACTIVITY_OVERVIEW_LIMITS,
  ACTIVITY_OVERVIEW_PICKER_LIMIT,
  ACTIVITY_OVERVIEW_RECENT_LIMIT,
  activityOverviewActiveOption,
  activityOverviewEmptyDescription,
  activityOverviewGeneratedAtLabel,
  activityOverviewIdentity,
  activityOverviewKindLabel,
  activityOverviewKindRows,
  activityOverviewKindTone,
  activityOverviewParticipants,
  activityOverviewPickerOptions,
  activityOverviewProjectEvents,
  activityOverviewRecentEvents,
  activityOverviewRelativeLabel,
  activityOverviewStatRows,
  activityOverviewSummaryLabel,
  activityOverviewTone,
  activityOverviewWorkspaceEvents,
  buildActivityOverviewOptions,
  buildActivityPickerOptions,
  hasActivityOverviewData,
} from "./activityOverviewHelpers";

const NOW = Date.parse("2026-01-01T01:00:00Z");
const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const EVENT_ID = "asset-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER_ID = "comment-bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function event(overrides: Partial<ActivityEvent> = {}): ActivityEvent {
  return {
    id: EVENT_ID,
    kind: "asset",
    project_id: PROJECT_ID,
    actor_id: "22222222-2222-4222-8222-222222222222",
    label: "Added hero character",
    detail: "Registered in Assets/Char",
    timestamp: "2026-01-01T00:59:00Z",
    tone: "success",
    ...overrides,
  };
}

function overview(overrides: Partial<ActivityOverview> = {}): ActivityOverview {
  return {
    id: EVENT_ID,
    kind: "asset",
    project_id: PROJECT_ID,
    project_name: "A Short Film",
    actor_id: "22222222-2222-4222-8222-222222222222",
    label: "Added hero character",
    detail: "Registered in Assets/Char",
    timestamp: "2026-01-01T00:59:00Z",
    tone: "success",
    counts: {
      total_events: 4,
      total_participants: 2,
      workspace_events: 40,
      by_kind: [
        { kind: "asset", count: 2 },
        { kind: "comment", count: 1 },
        { kind: "job", count: 1 },
      ],
    },
    recent_events: [event(), event({ id: OTHER_ID, kind: "comment", tone: "info" })],
    generated_at: "2026-01-01T00:59:30Z",
    ...overrides,
  };
}

function feed(): ActivityFeed {
  return {
    events: [event(), event({ id: OTHER_ID, kind: "comment", label: "Commented on shot" })],
    total: 2,
  };
}

describe("query option builders", () => {
  it("defaults to the canonical recent bound", () => {
    expect(buildActivityOverviewOptions()).toEqual({ recentLimit: ACTIVITY_OVERVIEW_RECENT_LIMIT });
  });

  it("passes through an explicit page bound", () => {
    expect(buildActivityOverviewOptions(10)).toEqual({ recentLimit: 10 });
  });

  it("exposes the three offered page-size chips", () => {
    expect(ACTIVITY_OVERVIEW_LIMITS).toEqual([5, 10, 25]);
  });

  it("builds an unbounded workspace picker or a project-scoped one", () => {
    expect(buildActivityPickerOptions()).toEqual({ limit: ACTIVITY_OVERVIEW_PICKER_LIMIT });
    expect(buildActivityPickerOptions(PROJECT_ID)).toEqual({
      limit: ACTIVITY_OVERVIEW_PICKER_LIMIT,
      projectId: PROJECT_ID,
    });
  });
});

describe("count helpers", () => {
  it("reads each authoritative count bucket", () => {
    expect(activityOverviewProjectEvents(overview())).toBe(4);
    expect(activityOverviewParticipants(overview())).toBe(2);
    expect(activityOverviewWorkspaceEvents(overview())).toBe(40);
  });

  it("zero-fills absent, negative and non-finite counts", () => {
    expect(activityOverviewProjectEvents()).toBe(0);
    expect(activityOverviewParticipants(overview({ counts: {} as never }))).toBe(0);
    expect(activityOverviewWorkspaceEvents(overview({ counts: { workspace_events: -2 } as never }))).toBe(0);
    expect(activityOverviewProjectEvents(overview({ counts: { total_events: Number.NaN } as never }))).toBe(0);
  });
});

describe("labels and tones", () => {
  it("formats relative and generated-at labels against the given clock", () => {
    expect(activityOverviewRelativeLabel("2026-01-01T00:59:00Z", NOW)).toBe("1 minute ago");
    expect(activityOverviewGeneratedAtLabel(overview(), NOW)).toBe("30 seconds ago");
  });

  it("returns an empty label for absent timestamps", () => {
    expect(activityOverviewRelativeLabel()).toBe("");
    expect(activityOverviewGeneratedAtLabel()).toBe("");
  });

  it("maps kinds, severities and unknown values to render-safe labels/tones", () => {
    expect(activityOverviewKindLabel("publish")).toBe("Publish");
    expect(activityOverviewKindLabel()).toBe("Event");
    expect(activityOverviewKindTone("comment")).toBe("info");
    expect(activityOverviewKindTone()).toBe("neutral");
    expect(activityOverviewTone("danger")).toBe("danger");
    expect(activityOverviewTone()).toBe("neutral");
  });
});

describe("activityOverviewIdentity", () => {
  it("derives the header identity from the snapshot", () => {
    expect(activityOverviewIdentity(overview(), NOW)).toEqual({
      kindLabel: "Asset",
      kindTone: "accent",
      tone: "success",
      label: "Added hero character",
      detail: "Registered in Assets/Char",
      projectLabel: "A Short Film",
      actorLabel: "22222222-2222-4222-8222-222222222222",
      relativeTime: "1 minute ago",
    });
  });

  it("zero-fills an absent snapshot", () => {
    expect(activityOverviewIdentity(undefined, NOW)).toEqual({
      kindLabel: "Event",
      kindTone: "neutral",
      tone: "neutral",
      label: "—",
      detail: "",
      projectLabel: "",
      actorLabel: "",
      relativeTime: "",
    });
  });
});

describe("activityOverviewStatRows", () => {
  it("exposes the four headline counters in a stable order", () => {
    const rows = activityOverviewStatRows(overview());
    expect(rows.map((row) => row.key)).toEqual([
      "project-events",
      "participants",
      "workspace-events",
      "page",
    ]);
    expect(rows.map((row) => row.value)).toEqual(["4", "2", "40", "2"]);
  });

  it("zero-fills an absent snapshot", () => {
    expect(activityOverviewStatRows().every((row) => row.value === "0")).toBe(true);
  });
});

describe("activityOverviewKindRows", () => {
  it("returns a zero-filled canonical four-kind breakdown with shares", () => {
    const rows = activityOverviewKindRows(overview());
    expect(rows.map((row) => row.kind)).toEqual(["asset", "publish", "job", "comment"]);
    expect(rows.map((row) => row.count)).toEqual([2, 0, 1, 1]);
    expect(rows.reduce((sum, row) => sum + row.count, 0)).toBe(4);
    expect(rows.map((row) => row.percent)).toEqual([50, 0, 25, 25]);
    expect(rows[0]?.fraction).toBeCloseTo(0.5);
    expect(rows[0]?.label).toBe("Asset");
  });

  it("keeps every share at zero when no events are present", () => {
    expect(activityOverviewKindRows().every((row) => row.fraction === 0 && row.percent === 0)).toBe(
      true,
    );
  });
});

describe("activityOverviewRecentEvents", () => {
  it("derives sibling rows and highlights the selected event", () => {
    const rows = activityOverviewRecentEvents(overview(), NOW);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.id).toBe(EVENT_ID);
    expect(rows[0]?.isCurrent).toBe(true);
    expect(rows[0]?.kindLabel).toBe("Asset");
    expect(rows[0]?.tone).toBe("success");
    expect(rows[0]?.relativeTime).toBe("1 minute ago");
    expect(rows[1]?.id).toBe(OTHER_ID);
    expect(rows[1]?.isCurrent).toBe(false);
    expect(rows[1]?.kindTone).toBe("info");
  });

  it("returns no rows for an absent snapshot", () => {
    expect(activityOverviewRecentEvents()).toEqual([]);
  });
});

describe("data detection and summaries", () => {
  it("detects missing, empty and populated snapshots", () => {
    expect(hasActivityOverviewData()).toBe(false);
    expect(
      hasActivityOverviewData(overview({ counts: {} as never, recent_events: [] })),
    ).toBe(false);
    expect(hasActivityOverviewData(overview())).toBe(true);
  });

  it("builds a one-line summary and scope-aware empty copy", () => {
    expect(activityOverviewSummaryLabel(overview())).toBe("4 events · 2 participants");
    expect(activityOverviewSummaryLabel()).toBe("");
    expect(activityOverviewEmptyDescription(true)).toContain("this project");
    expect(activityOverviewEmptyDescription(false)).toContain("studio works");
  });
});

describe("event picker", () => {
  it("derives picker options in feed order from the event id", () => {
    const options = activityOverviewPickerOptions(feed(), NOW);
    expect(options.map((option) => option.value)).toEqual([EVENT_ID, OTHER_ID]);
    expect(options.every((option) => option.eventId === option.value)).toBe(true);
    expect(options[0]?.label).toContain("Asset");
    expect(options[0]?.label).toContain("1 minute ago");
    expect(activityOverviewPickerOptions(undefined)).toEqual([]);
  });

  it("resolves the selected option and falls back to the first row", () => {
    const options = activityOverviewPickerOptions(feed(), NOW);
    expect(activityOverviewActiveOption(options, OTHER_ID)?.eventId).toBe(OTHER_ID);
    expect(activityOverviewActiveOption(options, "missing")?.eventId).toBe(EVENT_ID);
    expect(activityOverviewActiveOption([], "missing")).toBeUndefined();
  });
});
