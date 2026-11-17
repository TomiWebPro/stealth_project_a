import { useMemo, useState } from "react";
import { useProviders } from "../../hooks/useQueries";
import { errorMessage } from "../../lib/errors";
import type { Provider, ProviderLocation, ProviderStatus } from "../../lib/types";
import { PageHeader } from "../../layout/AppLayout";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card, SectionHeader } from "../../ui/Card";
import { EmptyState, Skeleton } from "../../ui/Feedback";
import {
  filterProviders,
  providerHealthSummary,
  runtimeGroups,
  statusTone,
} from "./healthHelpers";
import {
  formatCapabilitiesSummary,
  providerLocationLabel,
  providerOperationIds,
  providerStatusTone,
} from "./helpers";

function HealthOverview({ providers }: { readonly providers: readonly Provider[] }) {
  const summary = providerHealthSummary(providers);
  const groups = runtimeGroups(providers);
  return (
    <Card>
      <div className="p-4">
        <SectionHeader
          title="Provider health"
          description={summary.label}
          action={<Badge tone={summary.tone}>{`${summary.healthPercent}% available`}</Badge>}
        />
      </div>
      <div className="grid gap-3 border-t border-line p-4 sm:grid-cols-3">
        <div className="rounded-md border border-line bg-surface-raised p-3">
          <p className="text-2xs uppercase tracking-wider text-content-subtle">Available</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-success">{summary.available}</p>
        </div>
        <div className="rounded-md border border-line bg-surface-raised p-3">
          <p className="text-2xs uppercase tracking-wider text-content-subtle">Degraded</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-warning">{summary.degraded}</p>
        </div>
        <div className="rounded-md border border-line bg-surface-raised p-3">
          <p className="text-2xs uppercase tracking-wider text-content-subtle">Unavailable</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-danger">{summary.unavailable}</p>
        </div>
      </div>
      {groups.length > 0 ? (
        <ul className="flex flex-wrap gap-2 border-t border-line p-4">
          {groups.map((group) => (
            <li key={group.location}>
              <Badge tone={statusTone(group.degraded > 0 ? "degraded" : "available")}>
                {`${group.label}: ${group.available}/${group.total}`}
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}

export function ProvidersScreen() {
  const { data, isPending, isError, error, refetch } = useProviders();
  const providers = data ?? [];
  const [location, setLocation] = useState<ProviderLocation | "all">("all");
  const [status, setStatus] = useState<ProviderStatus | "all">("all");
  const filtered = useMemo(
    () => filterProviders(data ?? [], location, status),
    [data, location, status],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Providers"
        description="Local and cloud providers with capabilities listed as operation IDs from mocks."
        actions={
          <Button variant="secondary" size="sm" onClick={() => void refetch()}>
            Refresh
          </Button>
        }
      />

      {isPending ? (
        <div className="space-y-3" aria-busy="true" aria-label="Loading providers">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : null}

      {isError ? (
        <Card className="p-6">
          <EmptyState
            title="Could not load providers"
            description={errorMessage(error)}
            action={
              <Button variant="primary" size="sm" onClick={() => void refetch()}>
                Try again
              </Button>
            }
          />
        </Card>
      ) : null}

      {data ? (
        <>
          <HealthOverview providers={providers} />
          <Card className="p-4">
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1 text-xs text-content-muted">
                Location
                <select
                  value={location}
                  onChange={(event) => setLocation(event.target.value as ProviderLocation | "all")}
                  className="h-9 rounded-md border border-line bg-surface px-3 text-sm text-content"
                >
                  <option value="all">All locations</option>
                  <option value="local">Local</option>
                  <option value="studio">Studio</option>
                  <option value="cloud">Cloud</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-content-muted">
                Status
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value as ProviderStatus | "all")}
                  className="h-9 rounded-md border border-line bg-surface px-3 text-sm text-content"
                >
                  <option value="all">All statuses</option>
                  <option value="available">Available</option>
                  <option value="degraded">Degraded</option>
                  <option value="unavailable">Unavailable</option>
                </select>
              </label>
            </div>
          </Card>

          <Card>
            <div className="p-4">
              <SectionHeader
                title="Registered providers"
                description={`${filtered.length} of ${providers.length} shown · capabilities as operation IDs.`}
              />
            </div>
            {providers.length === 0 ? (
              <div className="border-t border-line p-4">
                <EmptyState
                  title="No providers"
                  description="No local or cloud providers are available in the current mock data."
                />
              </div>
            ) : filtered.length === 0 ? (
              <div className="border-t border-line p-4">
                <EmptyState title="No matching providers" description="Try adjusting the filters." />
              </div>
            ) : (
              <ul className="divide-y divide-line border-t border-line">
                {filtered.map((provider) => {
                  const ops = providerOperationIds(provider);
                  return (
                    <li key={provider.id} className="space-y-3 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-content">{provider.name}</p>
                          <p className="text-xs text-content-muted">{provider.id}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge tone="neutral">{providerLocationLabel(provider.location)}</Badge>
                          <Badge tone={providerStatusTone(provider.status)}>{provider.status}</Badge>
                          <Badge tone="info">{formatCapabilitiesSummary(provider)}</Badge>
                        </div>
                      </div>
                      <div>
                        <p className="mb-2 text-xs font-medium text-content-muted">Capabilities (operation IDs)</p>
                        {ops.length === 0 ? (
                          <p className="text-xs text-content-subtle">No operation capabilities.</p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {ops.map((op) => (
                              <Badge key={op} tone="accent">
                                {op}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </>
      ) : null}
    </div>
  );
}
