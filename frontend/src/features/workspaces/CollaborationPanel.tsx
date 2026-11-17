import { useMemo, useState } from "react";
import {
  useComments,
  useCurrentUser,
  useOrganizations,
  usePresence,
  useProjects,
} from "../../hooks/useQueries";
import { errorMessage } from "../../lib/errors";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card, SectionHeader } from "../../ui/Card";
import { EmptyState, Skeleton } from "../../ui/Feedback";
import { formatRelative } from "../home/format";
import {
  buildCommentRows,
  buildPresenceRows,
  presenceSummary,
} from "./collaborationHelpers";

export function CollaborationPanel() {
  const projectsQuery = useProjects();
  const orgsQuery = useOrganizations();
  const userQuery = useCurrentUser();
  const [projectId, setProjectId] = useState<string | null>(null);
  const projects = projectsQuery.data ?? [];
  const selectedProjectId = projectId ?? projects[0]?.id ?? null;
  const selectedProject = projects.find((project) => project.id === selectedProjectId);

  const presenceQuery = usePresence(selectedProjectId ?? "");
  const commentsQuery = useComments(selectedProjectId ?? "");

  const presenceRows = useMemo(
    () => buildPresenceRows(presenceQuery.data ?? [], selectedProject, userQuery.data),
    [presenceQuery.data, selectedProject, userQuery.data],
  );
  const commentRows = useMemo(
    () => buildCommentRows(commentsQuery.data ?? [], userQuery.data),
    [commentsQuery.data, userQuery.data],
  );

  const org = orgsQuery.data?.[0];

  return (
    <div className="space-y-4">
      <Card>
        <div className="p-4">
          <SectionHeader
            title="Workspace"
            description={
              org
                ? `${org.name} · ${org.slug}`
                : "Organization-backed workspace for this studio."
            }
          />
        </div>
        <div className="grid gap-4 border-t border-line p-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-medium text-content-muted">Signed in as</p>
            {userQuery.isPending ? (
              <Skeleton className="h-12" />
            ) : userQuery.data ? (
              <div className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-full bg-accent-muted text-sm font-semibold text-accent">
                  {userQuery.data.display_name.charAt(0)}
                </span>
                <div>
                  <p className="text-sm font-medium text-content">{userQuery.data.display_name}</p>
                  <p className="text-xs text-content-muted">{userQuery.data.email}</p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-content-subtle">No session available.</p>
            )}
          </div>
          <label className="flex flex-col gap-1 text-xs text-content-muted">
            Project
            <select
              value={selectedProjectId ?? ""}
              onChange={(event) => setProjectId(event.target.value || null)}
              className="h-9 rounded-md border border-line bg-surface px-3 text-sm text-content"
            >
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {orgsQuery.isError ? (
          <div className="border-t border-line p-4 text-xs text-danger" role="alert">
            {errorMessage(orgsQuery.error)}
          </div>
        ) : null}
      </Card>

      <Card>
        <div className="p-4">
          <SectionHeader
            title="Presence & roles"
            description={presenceSummary(presenceRows)}
            action={
              <Button variant="secondary" size="sm" onClick={() => void presenceQuery.refetch()}>
                Refresh
              </Button>
            }
          />
        </div>
        {presenceQuery.isPending ? (
          <div className="space-y-2 border-t border-line p-4" aria-busy="true" aria-label="Loading presence">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : null}
        {presenceQuery.isError ? (
          <div className="border-t border-line p-4">
            <EmptyState
              title="Could not load presence"
              description={errorMessage(presenceQuery.error)}
              action={
                <Button variant="primary" size="sm" onClick={() => void presenceQuery.refetch()}>
                  Try again
                </Button>
              }
            />
          </div>
        ) : null}
        {presenceQuery.data ? (
          presenceRows.length === 0 ? (
            <div className="border-t border-line p-4">
              <EmptyState title="Nobody here yet" description="Teammates will appear when they open this project." />
            </div>
          ) : (
            <ul className="divide-y divide-line border-t border-line">
              {presenceRows.map((row) => (
                <li key={row.userId} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-content">{row.displayName}</p>
                    <p className="text-xs text-content-muted">
                      last seen {formatRelative(row.lastSeenAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge tone="info">{row.role}</Badge>
                    <Badge tone={row.stateTone}>{row.state}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          )
        ) : null}
      </Card>

      <Card>
        <div className="p-4">
          <SectionHeader
            title="Recent comments"
            description={`${commentRows.length} comment${commentRows.length === 1 ? "" : "s"} on this project.`}
            action={
              <Button variant="secondary" size="sm" onClick={() => void commentsQuery.refetch()}>
                Refresh
              </Button>
            }
          />
        </div>
        {commentsQuery.isPending ? (
          <div className="space-y-2 border-t border-line p-4" aria-busy="true" aria-label="Loading comments">
            {Array.from({ length: 2 }, (_, i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : null}
        {commentsQuery.isError ? (
          <div className="border-t border-line p-4">
            <EmptyState
              title="Could not load comments"
              description={errorMessage(commentsQuery.error)}
              action={
                <Button variant="primary" size="sm" onClick={() => void commentsQuery.refetch()}>
                  Try again
                </Button>
              }
            />
          </div>
        ) : null}
        {commentsQuery.data ? (
          commentRows.length === 0 ? (
            <div className="border-t border-line p-4">
              <EmptyState title="No comments" description="Project discussions will appear here." />
            </div>
          ) : (
            <ul className="divide-y divide-line border-t border-line">
              {commentRows.map((row) => (
                <li key={row.id} className="space-y-1 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-medium text-content">{row.authorLabel}</p>
                    {row.isAssetScoped ? <Badge tone="neutral">asset</Badge> : null}
                    <time className="ml-auto text-2xs text-content-subtle" dateTime={row.createdAt}>
                      {formatRelative(row.createdAt)}
                    </time>
                  </div>
                  <p className="text-sm text-content-muted">{row.body}</p>
                </li>
              ))}
            </ul>
          )
        ) : null}
      </Card>
    </div>
  );
}
