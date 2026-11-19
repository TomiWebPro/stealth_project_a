import { useProjectDetail } from "../../hooks/useQueries";
import { errorMessage } from "../../lib/errors";
import { PageHeader } from "../../layout/AppLayout";
import { useUiStore } from "../../stores/uiStore";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card, SectionHeader } from "../../ui/Card";
import { EmptyState, Skeleton } from "../../ui/Feedback";
import { ExportPanel } from "../export/ExportPanel";
import { JobStatsPanel } from "../jobs/JobStatsPanel";
import { JobsPanel } from "../jobs/JobsPanel";
import { ConversationStatsPanel } from "../chat/ConversationStatsPanel";
import { AuditFeedPanel } from "../lineage/AuditFeedPanel";
import { LineageGraph } from "../lineage/LineageGraph";
import { LineageStatsPanel } from "../lineage/LineageStatsPanel";
import { StoragePanel } from "../storage/StoragePanel";
import { LineageView } from "../lineage/LineageView";
import { VersionPanel } from "../assets/VersionPanel";
import { AssetStatsPanel } from "../assets/AssetStatsPanel";
import { formatAssetMeta, isPublishAsset, assetTypeTone, assetPreviewUrl } from "../assets/helpers";
import { PipelineStatsPanel } from "./PipelineStatsPanel";
import { CollaborationStatsPanel } from "../workspaces/CollaborationStatsPanel";
import { formatProjectUpdatedAtLong } from "./helpers";

function ProjectDetailContent({ projectId }: { readonly projectId: string }) {
  const selectProject = useUiStore((s) => s.selectProject);
  const { data, isPending, isError, error, refetch } = useProjectDetail(projectId);

  if (isPending) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading project detail">
        <Skeleton className="h-24" />
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (isError) {
    return (
      <Card className="p-6">
        <EmptyState
          title="Could not load project"
          description={errorMessage(error)}
          action={
            <div className="flex gap-2">
              <Button variant="primary" size="sm" onClick={() => void refetch()}>
                Try again
              </Button>
              <Button variant="secondary" size="sm" onClick={() => selectProject(null)}>
                Back to projects
              </Button>
            </div>
          }
        />
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className="p-6">
        <EmptyState
          title="Project not found"
          description="The selected project could not be resolved from the mock API."
          action={
            <Button variant="secondary" size="sm" onClick={() => selectProject(null)}>
              Back to projects
            </Button>
          }
        />
      </Card>
    );
  }

  const { project, assets, jobs } = data;
  return (
    <div className="space-y-6">
      <PageHeader
        title={project.name}
        description={project.description ?? "No description"}
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => void refetch()}>
              Refresh
            </Button>
            <Button variant="secondary" size="sm" onClick={() => selectProject(null)}>
              Back
            </Button>
          </div>
        }
      />

      <Card className="p-4">
        <SectionHeader title="Project overview" description="Details from useProjectDetail." />
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          <div>
            <dt className="text-xs text-content-muted">Status</dt>
            <dd className="mt-1">
              <Badge tone={project.archived ? "neutral" : "success"}>
                {project.archived ? "Archived" : "Active"}
              </Badge>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-content-muted">Assets</dt>
            <dd className="mt-1 font-medium text-content">{assets.length}</dd>
          </div>
          <div>
            <dt className="text-xs text-content-muted">Jobs</dt>
            <dd className="mt-1 font-medium text-content">{jobs.length}</dd>
          </div>
          <div>
            <dt className="text-xs text-content-muted">Updated</dt>
            <dd className="mt-1 text-content">{formatProjectUpdatedAtLong(project.updated_at)}</dd>
          </div>
        </dl>
      </Card>

      <Card>
        <div className="p-4">
          <SectionHeader
            title="Project assets"
            description="Assets associated with this project (grid summary)."
          />
        </div>
        {assets.length === 0 ? (
          <div className="border-t border-line p-4">
            <EmptyState title="No assets" description="This project has no assets yet." />
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-3 border-t border-line p-4 sm:grid-cols-3 lg:grid-cols-4">
            {assets.map((asset) => {
              const preview = assetPreviewUrl(asset);
              return (
                <li key={asset.id} className="overflow-hidden rounded-md border border-line bg-surface-raised">
                  <div className="aspect-4/3 bg-surface-overlay">
                    {preview ? (
                      <img src={preview} alt={asset.name} loading="lazy" className="size-full object-cover" />
                    ) : (
                      <div className="grid size-full place-items-center text-2xs uppercase text-content-subtle">
                        {asset.type}
                      </div>
                    )}
                  </div>
                  <div className="space-y-1 p-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-xs font-medium text-content" title={asset.name}>{asset.name}</p>
                      <Badge tone={assetTypeTone(asset.type)}>{asset.type}</Badge>
                    </div>
                    <p className="truncate text-2xs text-content-muted">{formatAssetMeta(asset)}</p>
                    <div>{isPublishAsset(asset) ? <Badge tone="success">Publish</Badge> : <Badge tone="neutral">Output</Badge>}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <StoragePanel projectId={projectId} />
      <AssetStatsPanel
        projectId={projectId}
        title="Project asset stats"
        description="Authoritative inventory metrics scoped to this project."
      />
      <LineageStatsPanel
        projectId={projectId}
        title="Project lineage stats"
        description="Authoritative asset relationship metrics scoped to this project."
      />
      <JobStatsPanel
        projectId={projectId}
        title="Project job stats"
        description="Authoritative execution metrics scoped to this project."
      />
      <ConversationStatsPanel
        projectId={projectId}
        title="Project conversation stats"
        description="Authoritative message metrics scoped to this project."
      />
      <PipelineStatsPanel
        projectId={projectId}
        title="Project pipeline stats"
        description="Authoritative training, shot and splat chain metrics scoped to this project."
      />
      <CollaborationStatsPanel
        projectId={projectId}
        title="Project collaboration stats"
        description="Authoritative presence and comment metrics scoped to this project."
      />
      <JobsPanel jobs={jobs} title="Project jobs" description="Task panel for this project." />
      <VersionPanel assets={assets} />
      <LineageView assets={assets} />
      <LineageGraph assets={assets} />
      <AuditFeedPanel projectId={projectId} />
      <ExportPanel assets={assets} project={project} />
    </div>
  );
}

export function ProjectDetailScreen({ projectId }: { readonly projectId: string }) {
  return <ProjectDetailContent projectId={projectId} />;
}
