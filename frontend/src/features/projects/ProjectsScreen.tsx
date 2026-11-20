import { useProjects } from "../../hooks/useQueries";
import { errorMessage } from "../../lib/errors";
import type { Project } from "../../lib/types";
import { PageHeader } from "../../layout/AppLayout";
import { useUiStore } from "../../stores/uiStore";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card, SectionHeader } from "../../ui/Card";
import { EmptyState, Skeleton } from "../../ui/Feedback";
import { ChainOverviewPanel } from "./ChainOverviewPanel";
import { formatProjectUpdatedAt } from "./helpers";
import { PipelineFeedPanel } from "./PipelineFeedPanel";
import { PipelineStatsPanel } from "./PipelineStatsPanel";
import { LineageFeedPanel } from "../lineage/LineageFeedPanel";
import { LineageOverviewPanel } from "../lineage/LineageOverviewPanel";
import { LineageStatsPanel } from "../lineage/LineageStatsPanel";
import { ProjectDetailScreen } from "./ProjectDetailScreen";
import { ProjectFeedPanel } from "./ProjectFeedPanel";
import { ProjectStatsPanel } from "./ProjectStatsPanel";

function ProjectRow({
  project,
  onOpen,
}: {
  readonly project: Project;
  readonly onOpen: (id: string) => void;
}) {
  return (
    <li className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-content">{project.name}</p>
        <p className="truncate text-xs text-content-muted">
          {project.description ?? "No description"}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3 text-xs text-content-muted">
        <Badge tone={project.archived ? "neutral" : "success"}>
          {project.archived ? "Archived" : "Active"}
        </Badge>
        <time dateTime={project.updated_at}>{formatProjectUpdatedAt(project.updated_at)}</time>
        <Button variant="secondary" size="sm" onClick={() => onOpen(project.id)}>
          Open
        </Button>
      </div>
    </li>
  );
}

function ProjectsSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading projects">
      {Array.from({ length: 4 }, (_, index) => (
        <Skeleton key={index} className="h-16" />
      ))}
    </div>
  );
}

export function ProjectsScreen() {
  const selectedProjectId = useUiStore((s) => s.selectedProjectId);
  const selectProject = useUiStore((s) => s.selectProject);
  const { data, isPending, isError, error, refetch } = useProjects();

  if (selectedProjectId) {
    return <ProjectDetailScreen projectId={selectedProjectId} />;
  }

  return (
    <div>
      <PageHeader
        title="Projects"
        description="Production work across your studio. Open a project for detail, assets, jobs, and lineage."
        actions={
          <Button variant="secondary" size="sm" onClick={() => void refetch()}>
            Refresh
          </Button>
        }
      />

      <ProjectStatsPanel
        title="Project portfolio stats"
        description="Authoritative lifecycle and cross-domain metrics for all projects."
      />

      <ProjectFeedPanel
        title="Global project feed"
        description="Newest-first projects from the authoritative project store, with lifecycle filters."
      />

      <PipelineStatsPanel
        title="Production pipeline stats"
        description="Authoritative training, shot and splat chain metrics across the workspace."
      />

      <PipelineFeedPanel
        title="Global production pipeline feed"
        description="Newest-first training, shot and splat chains from the authoritative chain stores, with kind filters."
      />

      <ChainOverviewPanel
        title="Global chain overview"
        description="Select any training, shot or splat chain to inspect its authoritative snapshot and newest linked jobs/assets."
      />

      <LineageStatsPanel
        title="Asset lineage stats"
        description="Authoritative asset relationship metrics across the workspace."
      />

      <LineageFeedPanel
        title="Workspace asset lineage"
        description="Newest-first typed asset relationships across every project in the workspace."
      />

      <LineageOverviewPanel
        title="Workspace relationship overview"
        description="Select any asset relationship to inspect both endpoints and whole-source-asset lineage activity."
      />

      {isPending ? <ProjectsSkeleton /> : null}

      {isError ? (
        <Card className="p-6">
          <EmptyState
            title="Could not load projects"
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
              title="All projects"
              description="Select a project to view detail, assets, jobs, and lineage."
            />
          </div>
          {data.length > 0 ? (
            <ul className="divide-y divide-line border-t border-line">
              {data.map((project) => (
                <ProjectRow key={project.id} project={project} onOpen={selectProject} />
              ))}
            </ul>
          ) : (
            <div className="border-t border-line p-4">
              <EmptyState title="No projects" description="Create a project to get started." />
            </div>
          )}
        </Card>
      ) : null}
    </div>
  );
}
