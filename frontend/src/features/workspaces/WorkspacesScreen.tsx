import { useAssets, useOrganizations } from "../../hooks/useQueries";
import { errorMessage } from "../../lib/errors";
import { PageHeader } from "../../layout/AppLayout";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card, SectionHeader } from "../../ui/Card";
import { EmptyState, Skeleton } from "../../ui/Feedback";
import { ProjectStatsPanel } from "../projects/ProjectStatsPanel";
import { CollaborationPanel } from "./CollaborationPanel";
import { CollaborationStatsPanel } from "./CollaborationStatsPanel";
import { buildWorkflowTemplateCards, templateDescription } from "./helpers";
import { OrganizationFeedPanel } from "./OrganizationFeedPanel";
import { OrganizationStatsPanel } from "./OrganizationStatsPanel";

export function WorkspacesScreen() {
  const { data, isPending, isError, error, refetch } = useAssets();
  const orgId = useOrganizations().data?.[0]?.id;
  const templates = buildWorkflowTemplateCards(data ?? []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workspaces"
        description="Collaboration, presence, shared resources, and workflow templates."
        actions={
          <Button variant="secondary" size="sm" onClick={() => void refetch()}>
            Refresh
          </Button>
        }
      />

      <CollaborationPanel />

      <OrganizationFeedPanel />

      <ProjectStatsPanel
        orgId={orgId}
        title="Organization project stats"
        description="Authoritative portfolio metrics scoped to this organization."
      />

      <OrganizationStatsPanel
        orgId={orgId}
        title="Organization membership stats"
        description="Authoritative membership metrics scoped to this organization."
      />

      <CollaborationStatsPanel
        title="Workspace collaboration stats"
        description="Authoritative presence and comment metrics across the workspace."
      />

      {isPending ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Loading templates">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : null}

      {isError ? (
        <Card className="p-6">
          <EmptyState
            title="Could not load workspace resources"
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
              title="Workflow template gallery"
              description="Resource-type assets rendered as template cards (data only, never embedded node JSON)."
            />
          </div>
          {templates.length === 0 ? (
            <div className="border-t border-line p-4">
              <EmptyState
                title="No workflow templates"
                description="No resource-type assets are available in the mock data."
              />
            </div>
          ) : (
            <ul className="grid gap-3 border-t border-line p-4 sm:grid-cols-2 lg:grid-cols-3">
              {templates.map((template) => (
                <li key={template.id} className="rounded-md border border-line bg-surface-raised p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-content">{template.name}</p>
                    <Badge tone="neutral">resource</Badge>
                  </div>
                  <p className="mt-2 text-xs text-content-muted">{templateDescription(template.asset)}</p>
                  <p className="mt-2 truncate text-2xs text-content-subtle" title={template.storageKey}>
                    {template.storageKey}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {template.tags.length === 0 ? (
                      <Badge tone="neutral">no tags</Badge>
                    ) : (
                      template.tags.map((tag) => (
                        <Badge key={tag} tone="info">
                          {tag}
                        </Badge>
                      ))
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}
    </div>
  );
}
