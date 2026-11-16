import { useProviders } from "../../hooks/useQueries";
import { errorMessage } from "../../lib/errors";
import { PageHeader } from "../../layout/AppLayout";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card, SectionHeader } from "../../ui/Card";
import { EmptyState, Skeleton } from "../../ui/Feedback";
import {
  formatCapabilitiesSummary,
  providerLocationLabel,
  providerOperationIds,
  providerStatusTone,
} from "./helpers";

export function ProvidersScreen() {
  const { data, isPending, isError, error, refetch } = useProviders();
  const providers = data ?? [];

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
        <Card>
          <div className="p-4">
            <SectionHeader
              title="Registered providers"
              description={`${providers.length} provider${providers.length === 1 ? "" : "s"} · capabilities shown as operation IDs.`}
            />
          </div>
          {providers.length === 0 ? (
            <div className="border-t border-line p-4">
              <EmptyState
                title="No providers"
                description="No local or cloud providers are available in the current mock data."
              />
            </div>
          ) : (
            <ul className="divide-y divide-line border-t border-line">
              {providers.map((provider) => {
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
      ) : null}
    </div>
  );
}
