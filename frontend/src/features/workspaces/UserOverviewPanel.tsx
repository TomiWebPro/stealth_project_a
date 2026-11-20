import { useState } from "react";
import { useCurrentUser, useUserOverview } from "../../hooks/useQueries";
import { errorMessage } from "../../lib/errors";
import { useUiStore } from "../../stores/uiStore";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card, SectionHeader } from "../../ui/Card";
import { EmptyState, Skeleton } from "../../ui/Feedback";
import {
  USER_OVERVIEW_RECENT_LIMITS,
  buildUserOverviewOptions,
  hasUserOverviewData,
  userOverviewGeneratedAtLabel,
  userOverviewIdentity,
  userOverviewMembershipRows,
  userOverviewRecentComments,
  userOverviewRecentProjects,
  userOverviewStatRows,
  userOverviewSummaryLabel,
  type UserOverviewCommentRow,
  type UserOverviewProjectRow,
} from "./userOverviewHelpers";

function StatGrid({ rows }: { readonly rows: ReturnType<typeof userOverviewStatRows> }) {
  return (
    <section aria-label="User snapshot" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {rows.map((row) => (
        <div key={row.key} className="rounded-md border border-line bg-surface-raised p-3">
          <p className="text-2xs font-semibold uppercase tracking-wider text-content-subtle">
            {row.label}
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-content">{row.value}</p>
          <p className="mt-0.5 text-2xs text-content-muted">{row.hint}</p>
        </div>
      ))}
    </section>
  );
}

function MembershipList({
  rows,
}: {
  readonly rows: ReturnType<typeof userOverviewMembershipRows>;
}) {
  if (rows.length === 0) return null;
  return (
    <section aria-label="Organization memberships" className="rounded-md border border-line p-4">
      <h3 className="mb-3 text-sm font-medium text-content">Organization memberships</h3>
      <ul className="divide-y divide-line">
        {rows.map((row) => (
          <li key={row.key} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
            <span className="min-w-0 flex-1 truncate text-xs font-medium text-content" title={row.orgName}>
              {row.orgName}
            </span>
            <Badge tone={row.roleTone}>{row.roleLabel}</Badge>
            {row.joinedLabel ? (
              <span className="text-2xs text-content-muted">Joined {row.joinedLabel}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function ProjectList({
  rows,
  onOpen,
}: {
  readonly rows: readonly UserOverviewProjectRow[];
  readonly onOpen: (row: UserOverviewProjectRow) => void;
}) {
  if (rows.length === 0) return null;
  return (
    <section aria-label="Newest authored projects" className="rounded-md border border-line p-4">
      <h3 className="mb-3 text-sm font-medium text-content">Newest authored projects</h3>
      <ul className="divide-y divide-line">
        {rows.map((row) => (
          <li key={row.key} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
            <span className="min-w-0 flex-1 truncate text-xs font-medium text-content" title={row.name}>
              {row.name}
            </span>
            <Badge tone={row.lifecycleTone}>{row.lifecycleLabel}</Badge>
            {row.updatedLabel ? (
              <span className="text-2xs text-content-muted">Updated {row.updatedLabel}</span>
            ) : null}
            {row.id ? (
              <Button variant="secondary" size="sm" onClick={() => onOpen(row)}>
                Open
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function CommentList({
  rows,
  onOpen,
  onOpenAsset,
}: {
  readonly rows: readonly UserOverviewCommentRow[];
  readonly onOpen: (row: UserOverviewCommentRow) => void;
  readonly onOpenAsset: (row: UserOverviewCommentRow) => void;
}) {
  if (rows.length === 0) return null;
  return (
    <section aria-label="Newest authored comments" className="rounded-md border border-line p-4">
      <h3 className="mb-3 text-sm font-medium text-content">Newest authored comments</h3>
      <ul className="divide-y divide-line">
        {rows.map((row) => (
          <li key={row.key} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
            <span className="min-w-0 flex-1 truncate text-xs text-content" title={row.bodyPreview}>
              {row.bodyPreview || "—"}
              {row.hasAsset ? (
                <span className="ml-2">
                  <Badge tone="accent">asset</Badge>
                </span>
              ) : null}
            </span>
            {row.createdLabel ? (
              <span className="text-2xs text-content-muted">{row.createdLabel}</span>
            ) : null}
            {row.hasAsset ? (
              <Button variant="secondary" size="sm" onClick={() => onOpenAsset(row)}>
                Asset
              </Button>
            ) : null}
            {row.projectId ? (
              <Button variant="secondary" size="sm" onClick={() => onOpen(row)}>
                Open
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

export interface UserOverviewPanelProps {
  readonly title?: string;
  readonly description?: string;
}

/**
 * Authoritative single-user profile overview (C262/C264/C265 follow-up), backed
 * by the `useCurrentUser` + `useUserOverview` query hooks so the same view works
 * in mock and live mode. Renders explicit session/loading/error/missing/empty/
 * populated states; every display value is derived in `userOverviewHelpers`.
 * Recent project/comment rows deep-link to their existing screens (asset links
 * scope the assets browser to the row's project first); no new route is added.
 */
export function UserOverviewPanel({
  title = "Your profile overview",
  description = "Compact authoritative snapshot: identity, memberships, whole-scope activity and recent work.",
}: UserOverviewPanelProps) {
  const [recentLimit, setRecentLimit] = useState(10);
  const navigate = useUiStore((s) => s.navigate);
  const setAssetsProjectId = useUiStore((s) => s.setAssetsProjectId);

  const session = useCurrentUser();
  const userId = session.data?.id ?? "";
  const { data, isPending, isError, error, refetch } = useUserOverview(
    userId,
    buildUserOverviewOptions(recentLimit),
  );

  const identity = userOverviewIdentity(data);
  const stats = userOverviewStatRows(data);
  const memberships = userOverviewMembershipRows(data);
  const projects = userOverviewRecentProjects(data);
  const comments = userOverviewRecentComments(data);
  const generatedAt = userOverviewGeneratedAtLabel(data);
  const summary = userOverviewSummaryLabel(data);

  const limitChips = (
    <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="Recent items to show">
      <span className="text-2xs text-content-subtle">Recent</span>
      {USER_OVERVIEW_RECENT_LIMITS.map((value) => (
        <Button
          key={value}
          variant={recentLimit === value ? "primary" : "secondary"}
          size="sm"
          aria-pressed={recentLimit === value}
          onClick={() => setRecentLimit(value)}
        >
          {value}
        </Button>
      ))}
    </div>
  );

  return (
    <Card>
      <div className="p-4">
        <SectionHeader title={title} description={description} action={limitChips} />
      </div>
      <div className="border-t border-line p-4">
        {session.isPending ? (
          <div className="space-y-6" aria-busy="true" aria-label="Loading session">
            <Skeleton className="h-12 w-1/2" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {Array.from({ length: 5 }, (_, index) => (
                <Skeleton key={index} className="h-20" />
              ))}
            </div>
          </div>
        ) : session.isError ? (
          <EmptyState
            title="Could not load your session"
            description={errorMessage(session.error)}
            action={
              <Button variant="primary" size="sm" onClick={() => void session.refetch()}>
                Try again
              </Button>
            }
          />
        ) : !session.data ? (
          <EmptyState
            title="No session available"
            description="Sign in to inspect your authoritative profile overview."
          />
        ) : isPending ? (
          <div className="space-y-6" aria-busy="true" aria-label="Loading user overview">
            <Skeleton className="h-12 w-1/2" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {Array.from({ length: 5 }, (_, index) => (
                <Skeleton key={index} className="h-20" />
              ))}
            </div>
            <Skeleton className="h-40" />
          </div>
        ) : isError ? (
          <EmptyState
            title="Could not load your profile overview"
            description={errorMessage(error)}
            action={
              <Button variant="primary" size="sm" onClick={() => void refetch()}>
                Try again
              </Button>
            }
          />
        ) : !data ? (
          <EmptyState
            title="Overview unavailable"
            description="The authoritative snapshot for this user is not available right now."
          />
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="grid size-10 place-items-center rounded-full bg-accent-muted text-base font-semibold text-accent">
                {identity.avatarInitial}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-content">{identity.displayName}</span>
                  {identity.email ? (
                    <span className="text-xs text-content-muted">{identity.email}</span>
                  ) : null}
                  <span className="font-mono text-2xs text-content-subtle" title={data.user_id}>
                    {identity.shortId}
                  </span>
                </div>
                {identity.createdLabel ? (
                  <p className="mt-0.5 text-2xs text-content-subtle">Member since {identity.createdLabel}</p>
                ) : null}
              </div>
            </div>

            <StatGrid rows={stats} />

            {!hasUserOverviewData(data) ? (
              <EmptyState
                title="No profile activity yet"
                description="Memberships, projects and comments you author will populate this snapshot."
              />
            ) : (
              <div className="space-y-4">
                <MembershipList rows={memberships} />
                <ProjectList
                  rows={projects}
                  onOpen={(row) => navigate("projects", { projectId: row.id })}
                />
                <CommentList
                  rows={comments}
                  onOpen={(row) => navigate("projects", { projectId: row.projectId })}
                  onOpenAsset={(row) => {
                    setAssetsProjectId(row.projectId);
                    navigate("assets", { assetId: row.assetId });
                  }}
                />
              </div>
            )}

            {generatedAt ? (
              <p className="text-2xs text-content-subtle">
                {summary} · Snapshot generated {generatedAt}.
              </p>
            ) : null}
          </div>
        )}
      </div>
    </Card>
  );
}
