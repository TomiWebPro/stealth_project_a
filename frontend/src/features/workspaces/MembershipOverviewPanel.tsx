import { useState } from "react";
import {
  useCurrentUser,
  useMembershipOverview,
  useOrganizations,
} from "../../hooks/useQueries";
import { errorMessage } from "../../lib/errors";
import { useUiStore } from "../../stores/uiStore";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card, SectionHeader } from "../../ui/Card";
import { EmptyState, Skeleton } from "../../ui/Feedback";
import {
  MEMBERSHIP_OVERVIEW_RECENT_LIMITS,
  buildMembershipOverviewOptions,
  hasMembershipOverviewData,
  membershipOverviewGeneratedAtLabel,
  membershipOverviewIdentity,
  membershipOverviewRecentComments,
  membershipOverviewRecentProjects,
  membershipOverviewStatRows,
  membershipOverviewSummaryLabel,
  type MembershipOverviewCommentRow,
  type MembershipOverviewProjectRow,
} from "./membershipOverviewHelpers";

function StatGrid({ rows }: { readonly rows: ReturnType<typeof membershipOverviewStatRows> }) {
  return (
    <section aria-label="Membership snapshot" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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

function ProjectList({
  rows,
  onOpen,
}: {
  readonly rows: readonly MembershipOverviewProjectRow[];
  readonly onOpen: (row: MembershipOverviewProjectRow) => void;
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
  readonly rows: readonly MembershipOverviewCommentRow[];
  readonly onOpen: (row: MembershipOverviewCommentRow) => void;
  readonly onOpenAsset: (row: MembershipOverviewCommentRow) => void;
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

export interface MembershipOverviewPanelProps {
  readonly title?: string;
  readonly description?: string;
}

/**
 * Authoritative single-membership overview (C266/C268/C269 follow-up), backed
 * by the `useMembershipOverview` query hook so the same view works in mock and
 * live mode. An organization picker scopes the snapshot to the selected org and
 * the signed-in user. Renders explicit session/org/loading/error/missing/empty/
 * populated states; every display value is derived in `membershipOverviewHelpers`.
 * Recent project/comment rows deep-link to their existing screens (asset links
 * scope the assets browser to the row's project first); no new route is added.
 */
export function MembershipOverviewPanel({
  title = "Your membership overview",
  description = "Compact authoritative snapshot: role, organization-scoped activity and recent work.",
}: MembershipOverviewPanelProps) {
  const [recentLimit, setRecentLimit] = useState(5);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const navigate = useUiStore((s) => s.navigate);
  const setAssetsProjectId = useUiStore((s) => s.setAssetsProjectId);

  const session = useCurrentUser();
  const orgsQuery = useOrganizations();
  const organizations = orgsQuery.data ?? [];
  const userId = session.data?.id ?? "";
  const orgId = selectedOrgId ?? organizations[0]?.id ?? "";

  const { data, isPending, isError, error, refetch } = useMembershipOverview(
    orgId,
    userId,
    buildMembershipOverviewOptions(recentLimit),
  );

  const identity = membershipOverviewIdentity(data);
  const stats = membershipOverviewStatRows(data);
  const projects = membershipOverviewRecentProjects(data);
  const comments = membershipOverviewRecentComments(data);
  const generatedAt = membershipOverviewGeneratedAtLabel(data);
  const summary = membershipOverviewSummaryLabel(data);

  const orgPicker = (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Membership scope">
      <label htmlFor="membership-org" className="text-2xs text-content-subtle">
        Organization
      </label>
      <select
        id="membership-org"
        value={orgId}
        onChange={(event) => setSelectedOrgId(event.target.value || null)}
        className="h-8 rounded-md border border-line bg-surface px-2 text-xs text-content"
      >
        {organizations.map((org) => (
          <option key={org.id} value={org.id}>
            {org.name}
          </option>
        ))}
      </select>
    </div>
  );

  const limitChips = (
    <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="Recent items to show">
      <span className="text-2xs text-content-subtle">Recent</span>
      {MEMBERSHIP_OVERVIEW_RECENT_LIMITS.map((value) => (
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
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Array.from({ length: 4 }, (_, index) => (
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
            description="Sign in to inspect your authoritative membership overview."
          />
        ) : orgsQuery.isPending ? (
          <div className="space-y-6" aria-busy="true" aria-label="Loading organizations">
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="h-40" />
          </div>
        ) : orgsQuery.isError ? (
          <EmptyState
            title="Could not load organizations"
            description={errorMessage(orgsQuery.error)}
            action={
              <Button variant="primary" size="sm" onClick={() => void orgsQuery.refetch()}>
                Try again
              </Button>
            }
          />
        ) : organizations.length === 0 ? (
          <EmptyState
            title="No organizations"
            description="Join an organization to inspect an authoritative membership overview."
          />
        ) : isPending ? (
          <div className="space-y-6" aria-busy="true" aria-label="Loading membership overview">
            {orgPicker}
            <Skeleton className="h-12 w-1/2" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} className="h-20" />
              ))}
            </div>
            <Skeleton className="h-40" />
          </div>
        ) : isError ? (
          <div className="space-y-4">
            {orgPicker}
            <EmptyState
              title="Could not load your membership overview"
              description={errorMessage(error)}
              action={
                <Button variant="primary" size="sm" onClick={() => void refetch()}>
                  Try again
                </Button>
              }
            />
          </div>
        ) : !data ? (
          <div className="space-y-4">
            {orgPicker}
            <EmptyState
              title="Overview unavailable"
              description="The authoritative membership snapshot for this organization is not available right now."
            />
          </div>
        ) : (
          <div className="space-y-6">
            {orgPicker}

            <div className="flex flex-wrap items-center gap-3">
              <span className="grid size-10 place-items-center rounded-full bg-accent-muted text-base font-semibold text-accent">
                {identity.avatarInitial}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-content">{identity.displayName}</span>
                  <Badge tone={identity.roleTone}>{identity.roleLabel}</Badge>
                  {identity.email ? (
                    <span className="text-xs text-content-muted">{identity.email}</span>
                  ) : null}
                  <span className="font-mono text-2xs text-content-subtle" title={data.user_id}>
                    {identity.shortId}
                  </span>
                </div>
                <p className="mt-0.5 text-2xs text-content-subtle">
                  {identity.orgName}
                  {identity.orgSlug ? ` · ${identity.orgSlug}` : ""}
                  {identity.joinedLabel ? ` · Joined ${identity.joinedLabel}` : ""}
                </p>
              </div>
            </div>

            <StatGrid rows={stats} />

            {!hasMembershipOverviewData(data) ? (
              <EmptyState
                title="No membership activity yet"
                description="Projects, conversations and comments in this organization will populate this snapshot."
              />
            ) : (
              <div className="space-y-4">
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
