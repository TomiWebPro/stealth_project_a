import { useState } from "react";
import { useOrganizationOverview } from "../../hooks/useQueries";
import { errorMessage } from "../../lib/errors";
import type { Organization } from "../../lib/types";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card, SectionHeader } from "../../ui/Card";
import { EmptyState, Skeleton } from "../../ui/Feedback";
import { ProgressBar } from "../../ui/ProgressBar";
import {
  hasOrganizationOverviewData,
  organizationOverviewGeneratedAtLabel,
  organizationOverviewIdentity,
  organizationOverviewOptionLabel,
  organizationOverviewRecentMembers,
  organizationOverviewRecentProjects,
  organizationOverviewRoleRows,
  organizationOverviewStatRows,
  organizationOverviewSummaryLabel,
} from "./organizationOverviewHelpers";

function StatGrid({
  rows,
}: {
  readonly rows: ReturnType<typeof organizationOverviewStatRows>;
}) {
  return (
    <section aria-label="Organization snapshot" className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {rows.map((row) => (
        <div key={row.key} className="rounded-md border border-line bg-surface-raised p-3">
          <p className="text-2xs font-semibold uppercase tracking-wider text-content-subtle">
            {row.label}
          </p>
          <p className="mt-1 truncate text-xl font-semibold tabular-nums text-content" title={row.value}>
            {row.value}
          </p>
          <p className="mt-0.5 text-2xs text-content-muted">{row.hint}</p>
        </div>
      ))}
    </section>
  );
}

function RoleDistribution({
  rows,
}: {
  readonly rows: ReturnType<typeof organizationOverviewRoleRows>;
}) {
  return (
    <section aria-label="Membership roles" className="rounded-md border border-line p-4">
      <h3 className="mb-3 text-sm font-medium text-content">Membership roles</h3>
      <ul className="space-y-3">
        {rows.map((row) => (
          <li key={row.role}>
            <div className="mb-1 flex items-center justify-between gap-2 text-xs">
              <Badge tone={row.tone}>{row.label}</Badge>
              <span className="tabular-nums text-content-muted">
                {row.count} · {row.percent}%
              </span>
            </div>
            <ProgressBar value={row.fraction} label={`${row.label} member share`} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function RecentMembers({
  rows,
}: {
  readonly rows: ReturnType<typeof organizationOverviewRecentMembers>;
}) {
  if (rows.length === 0) return null;
  return (
    <section aria-label="Newest members" className="rounded-md border border-line p-4">
      <h3 className="mb-3 text-sm font-medium text-content">Newest members</h3>
      <ul className="divide-y divide-line">
        {rows.map((row) => (
          <li key={row.key} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
            <span className="min-w-0 flex-1">
              <span className="text-xs font-medium text-content" title={row.label}>
                {row.label}
              </span>
              {row.email && row.email !== row.label ? (
                <span className="ml-2 text-2xs text-content-subtle" title={row.email}>
                  {row.email}
                </span>
              ) : null}
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

function RecentProjects({
  rows,
}: {
  readonly rows: ReturnType<typeof organizationOverviewRecentProjects>;
}) {
  if (rows.length === 0) return null;
  return (
    <section aria-label="Newest projects" className="rounded-md border border-line p-4">
      <h3 className="mb-3 text-sm font-medium text-content">Newest projects</h3>
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
            {row.createdLabel ? (
              <span className="text-2xs text-content-subtle">Created {row.createdLabel}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

export interface OrganizationOverviewPanelProps {
  /** Organizations available to inspect; the panel renders a picker over them. */
  readonly organizations: readonly Organization[];
  readonly title?: string;
  readonly description?: string;
}

/**
 * Authoritative single-organization overview (C226/C228/C229 follow-up), backed
 * by the `useOrganizationOverview` query hook so the same view works in mock and
 * live mode. Renders explicit loading, error, missing-data, empty and populated
 * states; every display value is derived in `organizationOverviewHelpers`. There
 * is no organization-detail route, so the panel stays read-only.
 */
export function OrganizationOverviewPanel({
  organizations,
  title = "Organization overview snapshot",
  description = "Compact authoritative snapshot: identity, membership counts, role mix and recent activity.",
}: OrganizationOverviewPanelProps) {
  const [selectedOrgId, setSelectedOrgId] = useState("");

  // Fall back to the first organization when the current selection disappears
  // (e.g. the organization list changed) without an effect fighting the cache.
  const activeOrgId = organizations.some((org) => org.id === selectedOrgId)
    ? selectedOrgId
    : (organizations[0]?.id ?? "");

  const { data, isPending, isError, error, refetch } = useOrganizationOverview(activeOrgId);
  const identity = organizationOverviewIdentity(data);
  const stats = organizationOverviewStatRows(data);
  const roles = organizationOverviewRoleRows(data);
  const members = organizationOverviewRecentMembers(data);
  const projects = organizationOverviewRecentProjects(data);
  const generatedAt = organizationOverviewGeneratedAtLabel(data);
  const summary = organizationOverviewSummaryLabel(data);

  const picker = (
    <label className="flex items-center gap-2 text-xs text-content-muted">
      <span>Organization</span>
      <select
        aria-label="Select an organization to inspect"
        className="h-8 max-w-72 rounded-md border border-line-strong bg-surface-raised px-2 text-xs text-content"
        value={activeOrgId}
        onChange={(event) => setSelectedOrgId(event.target.value)}
        disabled={organizations.length === 0}
      >
        {organizations.length === 0 ? <option value="">No organizations</option> : null}
        {organizations.map((org) => (
          <option key={org.id} value={org.id}>
            {organizationOverviewOptionLabel(org)}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <Card>
      <div className="p-4">
        <SectionHeader title={title} description={description} action={picker} />
      </div>
      <div className="border-t border-line p-4">
        {organizations.length === 0 ? (
          <EmptyState
            title="No organizations to inspect"
            description="No organization is available in the current data."
          />
        ) : isPending ? (
          <div className="space-y-6" aria-busy="true" aria-label="Loading organization overview">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} className="h-20" />
              ))}
            </div>
            <Skeleton className="h-40" />
          </div>
        ) : isError ? (
          <EmptyState
            title="Could not load organization overview"
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
            description="The authoritative snapshot for this organization is not available right now."
          />
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 truncate text-sm font-semibold text-content" title={identity.nameLabel}>
                {identity.nameLabel}
              </span>
              <span className="text-2xs text-content-subtle">{identity.slugLabel}</span>
              <span className="font-mono text-2xs text-content-subtle" title={identity.shortIdLabel}>
                {identity.shortIdLabel}
              </span>
              {identity.createdLabel ? (
                <span className="text-2xs text-content-muted">Created {identity.createdLabel}</span>
              ) : null}
            </div>

            <StatGrid rows={stats} />

            {!hasOrganizationOverviewData(data) ? (
              <EmptyState
                title="No organization activity yet"
                description="This organization has no members or projects recorded yet."
              />
            ) : (
              <div className="space-y-4">
                <RoleDistribution rows={roles} />
                <RecentMembers rows={members} />
                <RecentProjects rows={projects} />
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
