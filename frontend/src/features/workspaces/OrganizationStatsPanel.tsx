import { useOrganizationStats, useOrganizations } from "../../hooks/useQueries";
import { errorMessage } from "../../lib/errors";
import type { OrganizationStats } from "../../lib/types";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card, SectionHeader } from "../../ui/Card";
import { EmptyState, Skeleton } from "../../ui/Feedback";
import { ProgressBar } from "../../ui/ProgressBar";
import {
  hasOrganizationStatsData,
  organizationAverageLabel,
  organizationMemberRows,
  organizationRoleRows,
  organizationStatsCards,
  organizationStatsGeneratedAtLabel,
  type OrganizationMemberRow,
  type OrganizationRoleRow,
} from "./organizationStatsHelpers";

function StatGrid({ stats }: { readonly stats: OrganizationStats }) {
  const cards = organizationStatsCards(stats);
  return (
    <section
      aria-label="Organization and membership totals"
      className="grid grid-cols-2 gap-3 md:grid-cols-4"
    >
      {cards.map((card) => (
        <div key={card.key} className="rounded-md border border-line bg-surface-raised p-3">
          <p className="text-2xs font-semibold uppercase tracking-wider text-content-subtle">
            {card.label}
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-content">{card.value}</p>
          <p className="mt-0.5 text-2xs text-content-muted">{card.hint}</p>
        </div>
      ))}
    </section>
  );
}

function RoleRows({ rows }: { readonly rows: readonly OrganizationRoleRow[] }) {
  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.role} className="flex items-center gap-3">
          <span className="w-16 shrink-0">
            <Badge tone={row.tone}>{row.label}</Badge>
          </span>
          <ProgressBar value={row.fraction} label={`${row.label} share`} className="flex-1" />
          <span className="w-8 shrink-0 text-right text-xs tabular-nums text-content">
            {row.count}
          </span>
          <span className="w-9 shrink-0 text-right text-2xs tabular-nums text-content-subtle">
            {row.percent}%
          </span>
        </li>
      ))}
    </ul>
  );
}

function MemberRows({ rows }: { readonly rows: readonly OrganizationMemberRow[] }) {
  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.orgId} className="flex items-center gap-3">
          <span className="w-28 shrink-0 truncate text-xs text-content-muted" title={row.orgId}>
            {row.label}
          </span>
          <ProgressBar value={row.fraction} label={`${row.label} member share`} className="flex-1" />
          <span className="w-8 shrink-0 text-right text-xs tabular-nums text-content">
            {row.count}
          </span>
          <span className="w-9 shrink-0 text-right text-2xs tabular-nums text-content-subtle">
            {row.percent}%
          </span>
        </li>
      ))}
    </ul>
  );
}

function OrganizationStatsContent({
  stats,
  orgNames,
}: {
  readonly stats: OrganizationStats;
  readonly orgNames: Readonly<Record<string, string>>;
}) {
  const generatedAt = organizationStatsGeneratedAtLabel(stats);
  const roles = organizationRoleRows(stats);
  const members = organizationMemberRows(stats, orgNames);

  return (
    <div className="space-y-6">
      <StatGrid stats={stats} />
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="info">{`Avg members / org: ${organizationAverageLabel(stats)}`}</Badge>
      </div>
      {!hasOrganizationStatsData(stats) ? (
        <EmptyState
          title="No organizations in this scope"
          description="Organizations and memberships will populate these metrics as they are added."
        />
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <section aria-label="Members by role" className="rounded-md border border-line p-4">
              <h3 className="mb-3 text-sm font-medium text-content">Members by role</h3>
              <RoleRows rows={roles} />
            </section>
            <section aria-label="Members by organization" className="rounded-md border border-line p-4">
              <h3 className="mb-3 text-sm font-medium text-content">Members by organization</h3>
              {members.length === 0 ? (
                <p className="text-xs text-content-muted">No organizations in this scope.</p>
              ) : (
                <MemberRows rows={members} />
              )}
            </section>
          </div>
          {generatedAt ? (
            <p className="text-2xs text-content-subtle">Metrics generated {generatedAt}.</p>
          ) : null}
        </>
      )}
    </div>
  );
}

export interface OrganizationStatsPanelProps {
  /** Optional organization scope; omitted renders the workspace-wide snapshot. */
  readonly orgId?: string;
  readonly title?: string;
  readonly description?: string;
}

/**
 * Authoritative organization/membership metrics from the `useOrganizationStats`
 * query hook. Renders explicit loading, error, missing-data, empty and populated
 * states; every display value comes from `organizationStatsHelpers` so JSX stays
 * free of inline derivation and mock/live transports render identically. See
 * C69/C71/C72.
 */
export function OrganizationStatsPanel({
  orgId,
  title = "Organization stats",
  description = "Authoritative membership metrics derived from the organization, member and user stores.",
}: OrganizationStatsPanelProps) {
  const { data, isPending, isError, error, refetch } = useOrganizationStats(
    orgId ? { orgId } : undefined,
  );
  const organizations = useOrganizations().data ?? [];
  const orgNames: Record<string, string> = {};
  for (const org of organizations) orgNames[org.id] = org.name;

  return (
    <Card>
      <div className="p-4">
        <SectionHeader title={title} description={description} />
      </div>
      <div className="border-t border-line p-4">
        {isPending ? (
          <div className="space-y-6" aria-busy="true" aria-label="Loading organization statistics">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} className="h-20" />
              ))}
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <Skeleton className="h-40" />
              <Skeleton className="h-40" />
            </div>
          </div>
        ) : isError ? (
          <EmptyState
            title="Could not load organization statistics"
            description={errorMessage(error)}
            action={
              <Button variant="primary" size="sm" onClick={() => void refetch()}>
                Try again
              </Button>
            }
          />
        ) : !data ? (
          <EmptyState
            title="Statistics unavailable"
            description="Organization and membership metrics are not available right now."
          />
        ) : (
          <OrganizationStatsContent stats={data} orgNames={orgNames} />
        )}
      </div>
    </Card>
  );
}
