import { describe, expect, it } from "vitest";
import type { Comment, Presence, Project, User } from "../../lib/types";
import {
  buildCommentRows,
  buildPresenceRows,
  deriveRole,
  presenceSummary,
} from "./collaborationHelpers";

const user: User = {
  id: "u1",
  email: "director@studio.local",
  display_name: "Avery Director",
  created_at: "2026-01-01T00:00:00Z",
};

const project: Project = {
  id: "p1",
  org_id: "o1",
  name: "Moonshot",
  created_by: "u1",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("collaboration helpers", () => {
  it("derives roles from project ownership and session identity", () => {
    expect(deriveRole("u1", project, user)).toBe("owner");
    expect(deriveRole("u2", project, user)).toBe("viewer");
    expect(deriveRole("u2", { ...project, created_by: "u2" }, user)).toBe("owner");
    expect(deriveRole("u1", undefined, user)).toBe("member");
  });

  it("builds presence rows with a friendly label and tone", () => {
    const presence: Presence[] = [
      { user_id: "u1", project_id: "p1", state: "online", last_seen_at: "2026-01-01T00:00:00Z" },
      { user_id: "abcdefgh-1234", project_id: "p1", state: "away", last_seen_at: "2026-01-01T00:00:00Z" },
    ];
    const rows = buildPresenceRows(presence, project, user);
    expect(rows[0]).toMatchObject({ displayName: "Avery Director (you)", role: "owner", stateTone: "success", isCurrentUser: true });
    expect(rows[1]?.displayName).toBe("abcdefgh");
    expect(presenceSummary(rows)).toBe("1 online · 1 owner · 2 total");
  });

  it("marks asset-scoped comments", () => {
    const comments: Comment[] = [
      { id: "c1", project_id: "p1", author_id: "u1", body: "Looks good", created_at: "2026-01-01T00:00:00Z" },
      { id: "c2", project_id: "p1", asset_id: "a1", author_id: "u2", body: "Revise", created_at: "2026-01-01T00:00:00Z" },
    ];
    const rows = buildCommentRows(comments, user);
    expect(rows.map((row) => row.isAssetScoped)).toEqual([false, true]);
  });
});
