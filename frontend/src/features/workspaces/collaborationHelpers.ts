import type { Comment, Presence, PresenceState, Project, User } from "../../lib/types";
import type { BadgeTone } from "../../ui/Badge";

export type WorkspaceRole = "owner" | "member" | "viewer";

export interface PresenceRow {
  readonly userId: string;
  readonly displayName: string;
  readonly role: WorkspaceRole;
  readonly state: PresenceState;
  readonly stateTone: BadgeTone;
  readonly lastSeenAt: string;
  readonly isCurrentUser: boolean;
}

export interface CommentRow {
  readonly id: string;
  readonly authorLabel: string;
  readonly body: string;
  readonly createdAt: string;
  readonly isAssetScoped: boolean;
}

const STATE_TONE: Readonly<Record<PresenceState, BadgeTone>> = {
  online: "success",
  away: "warning",
  offline: "neutral",
};

/**
 * Roles are derived from project ownership because the contracts do not yet
 * expose membership records. The current user is the owner of projects they
 * created and a member elsewhere; presence-only users are viewers.
 */
export function deriveRole(
  userId: string,
  project: Project | undefined,
  currentUser: User | undefined,
): WorkspaceRole {
  if (project && project.created_by === userId) return "owner";
  if (currentUser && currentUser.id === userId) return "member";
  return "viewer";
}

export function shortUserLabel(userId: string, currentUser: User | undefined): string {
  if (currentUser && currentUser.id === userId) {
    return `${currentUser.display_name} (you)`;
  }
  return userId.slice(0, 8);
}

export function buildPresenceRows(
  presence: readonly Presence[],
  project: Project | undefined,
  currentUser: User | undefined,
): readonly PresenceRow[] {
  return presence.map((entry) => ({
    userId: entry.user_id,
    displayName: shortUserLabel(entry.user_id, currentUser),
    role: deriveRole(entry.user_id, project, currentUser),
    state: entry.state,
    stateTone: STATE_TONE[entry.state],
    lastSeenAt: entry.last_seen_at,
    isCurrentUser: currentUser?.id === entry.user_id,
  }));
}

export function presenceSummary(rows: readonly PresenceRow[]): string {
  if (rows.length === 0) return "No presence recorded";
  const online = rows.filter((row) => row.state === "online").length;
  const owners = rows.filter((row) => row.role === "owner").length;
  return `${online} online · ${owners} owner${owners === 1 ? "" : "s"} · ${rows.length} total`;
}

export function buildCommentRows(
  comments: readonly Comment[],
  currentUser: User | undefined,
): readonly CommentRow[] {
  return comments.map((comment) => ({
    id: comment.id,
    authorLabel: shortUserLabel(comment.author_id, currentUser),
    body: comment.body,
    createdAt: comment.created_at,
    isAssetScoped: Boolean(comment.asset_id),
  }));
}
