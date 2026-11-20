import { useMemo, useState } from "react";
import { useExtensions } from "../../hooks/useQueries";
import { errorMessage } from "../../lib/errors";
import type { ExtensionStatus, ExtensionType } from "../../lib/types";
import { PageHeader } from "../../layout/AppLayout";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card, SectionHeader } from "../../ui/Card";
import { EmptyState, Skeleton } from "../../ui/Feedback";
import { ExtensionFeedPanel } from "./ExtensionFeedPanel";
import { ExtensionOverviewPanel } from "./ExtensionOverviewPanel";
import { ExtensionStatsPanel } from "./ExtensionStatsPanel";
import { buildExtensionCards, extensionSummary, SDK_EXAMPLES } from "./helpers";

function RegistryCard() {
  const { data, isPending, isError, error, refetch } = useExtensions();
  const cards = useMemo(() => buildExtensionCards(data ?? []), [data]);

  return (
    <Card>
      <div className="p-4">
        <SectionHeader
          title="Extension registry"
          description={extensionSummary(cards)}
          action={
            <Button variant="secondary" size="sm" onClick={() => void refetch()}>
              Refresh
            </Button>
          }
        />
      </div>
      {isPending ? (
        <div className="grid gap-3 border-t border-line p-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Loading extensions">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : null}
      {isError ? (
        <div className="border-t border-line p-4">
          <EmptyState
            title="Could not load extensions"
            description={errorMessage(error)}
            action={
              <Button variant="primary" size="sm" onClick={() => void refetch()}>
                Try again
              </Button>
            }
          />
        </div>
      ) : null}
      {data ? (
        cards.length === 0 ? (
          <div className="border-t border-line p-4">
            <EmptyState
              title="No extensions installed"
              description="Installed connectors and capability packages will appear here."
            />
          </div>
        ) : (
          <ul className="grid gap-3 border-t border-line p-4 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((card) => (
              <li key={card.id} className="space-y-3 rounded-md border border-line bg-surface-raised p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-content">{card.name}</p>
                    <p className="truncate text-2xs text-content-muted">
                      {card.publisher} · v{card.version}
                    </p>
                  </div>
                  <Badge tone={card.statusTone}>{card.status}</Badge>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Badge tone="neutral">{card.type}</Badge>
                  {card.trusted ? <Badge tone="success">signed · verified</Badge> : <Badge tone="warning">unverified</Badge>}
                </div>
                <dl className="space-y-1 text-2xs">
                  {card.permissions.length > 0 ? (
                    <div>
                      <dt className="text-content-muted">Permissions</dt>
                      <dd className="flex flex-wrap gap-1 pt-1">
                        {card.permissions.map((permission) => (
                          <Badge key={permission} tone="warning">{permission}</Badge>
                        ))}
                      </dd>
                    </div>
                  ) : null}
                  {card.capabilities.length > 0 ? (
                    <div>
                      <dt className="text-content-muted">Capabilities</dt>
                      <dd className="pt-0.5 text-content">{card.capabilities.join(", ")}</dd>
                    </div>
                  ) : null}
                  {card.providerIds.length > 0 ? (
                    <div>
                      <dt className="text-content-muted">Providers</dt>
                      <dd className="pt-0.5 text-content">{card.providerIds.join(", ")}</dd>
                    </div>
                  ) : null}
                  {card.uiContributions.length > 0 ? (
                    <div>
                      <dt className="text-content-muted">UI contributions</dt>
                      <dd className="pt-0.5 text-content">{card.uiContributions.join(", ")}</dd>
                    </div>
                  ) : null}
                  {card.dependencies.length > 0 ? (
                    <div>
                      <dt className="text-content-muted">Dependencies</dt>
                      <dd className="pt-0.5 text-content">{card.dependencies.join(", ")}</dd>
                    </div>
                  ) : null}
                </dl>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </Card>
  );
}

function ExamplesCard() {
  return (
    <Card>
      <div className="p-4">
        <SectionHeader
          title="SDK & connector examples"
          description="Reference examples for building a capability, provider, or UI extension."
        />
      </div>
      <div className="grid gap-3 border-t border-line p-4 lg:grid-cols-3">
        {SDK_EXAMPLES.map((example) => (
          <section key={example.id} aria-label={example.title} className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-content">{example.title}</h3>
              <Badge tone="info">{example.language}</Badge>
            </div>
            <p className="text-xs text-content-muted">{example.description}</p>
            <pre className="max-h-64 overflow-auto rounded-md border border-line bg-canvas p-3 text-2xs leading-relaxed text-content">
              <code>{example.code}</code>
            </pre>
          </section>
        ))}
      </div>
    </Card>
  );
}

export function ExtensionsScreen() {
  // Screen-level registry data feeds the overview picker; RegistryCard keeps its
  // own useExtensions observer (React Query dedupes the shared query).
  const { data: extensionsData } = useExtensions();
  const [type, setType] = useState<ExtensionType | "all">("all");
  const [status, setStatus] = useState<ExtensionStatus | "all">("all");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Extensions"
        description="Permissioned connectors and capability packages, with SDK examples."
      />
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-content-muted">
            Type
            <select
              value={type}
              onChange={(event) => setType(event.target.value as ExtensionType | "all")}
              className="h-9 rounded-md border border-line bg-surface px-3 text-sm text-content"
            >
              <option value="all">All types</option>
              <option value="capability">Capability</option>
              <option value="ui">UI</option>
              <option value="provider">Provider</option>
              <option value="runtime">Runtime</option>
              <option value="bundle">Bundle</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-content-muted">
            Status
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as ExtensionStatus | "all")}
              className="h-9 rounded-md border border-line bg-surface px-3 text-sm text-content"
            >
              <option value="all">All statuses</option>
              <option value="installed">Installed</option>
              <option value="enabled">Enabled</option>
              <option value="disabled">Disabled</option>
              <option value="update_available">Update available</option>
            </select>
          </label>
        </div>
      </Card>

      <ExtensionStatsPanel
        type={type === "all" ? undefined : type}
        status={status === "all" ? undefined : status}
      />
      <ExtensionOverviewPanel extensions={extensionsData ?? []} />
      <ExtensionFeedPanel />
      <RegistryCard />
      <ExamplesCard />
    </div>
  );
}
