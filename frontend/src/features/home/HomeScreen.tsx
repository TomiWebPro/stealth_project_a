import { useHomeSummary } from "../../hooks/useQueries";
import { errorMessage } from "../../lib/errors";
import type { ProjectListItem, ProviderListItem } from "../../lib/homeSummary";
import type { Asset, Job } from "../../lib/types";
import { PageHeader } from "../../layout/AppLayout";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card, SectionHeader } from "../../ui/Card";
import { EmptyState, Skeleton } from "../../ui/Feedback";
import { ProgressBar } from "../../ui/ProgressBar";
import { ActivityFeedPanel } from "../activity/ActivityFeedPanel";
import { ActivityStatsPanel } from "../activity/ActivityStatsPanel";
import { CommentFeedPanel } from "../comments/CommentFeedPanel";
import { CommentStatsPanel } from "../comments/CommentStatsPanel";
import { AssetFeedPanel } from "../assets/AssetFeedPanel";
import { AssetStatsPanel } from "../assets/AssetStatsPanel";
import { PublishFeedPanel } from "../assets/PublishFeedPanel";
import { PublishStatsPanel } from "../assets/PublishStatsPanel";
import { VersionFeedPanel } from "../assets/VersionFeedPanel";
import { VersionStatsPanel } from "../assets/VersionStatsPanel";
import { ConversationFeedPanel } from "../chat/ConversationFeedPanel";
import { ConversationStatsPanel } from "../chat/ConversationStatsPanel";
import { ProjectStatsPanel } from "../projects/ProjectStatsPanel";
import { SearchStatsPanel } from "../search/SearchStatsPanel";
import { UploadFeedPanel } from "../uploads/UploadFeedPanel";
import { UploadOverviewPanel } from "../uploads/UploadOverviewPanel";
import { UploadStatsPanel } from "../uploads/UploadStatsPanel";
import { OrganizationStatsPanel } from "../workspaces/OrganizationStatsPanel";
import { DashboardPanel } from "./DashboardPanel";
import {
  assetTypeTone,
  formatRelative,
  jobStatusTone,
  providerStatusTone,
} from "./format";

function StatCard({ label, value }: { readonly label: string; readonly value: number }) {
  return (
    <Card className="p-4">
      <p className="text-2xs font-semibold uppercase tracking-wider text-content-subtle">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-content">{value}</p>
    </Card>
  );
}

function ProjectRow({ project }: { readonly project: ProjectListItem }) {
  return (
    <li className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-content">{project.name}</p>
        <p className="truncate text-xs text-content-muted">{project.description}</p>
      </div>
      <div className="flex shrink-0 items-center gap-3 text-xs text-content-muted">
        <span className="tabular-nums">{project.assetCount} assets</span>
        <span aria-hidden="true">·</span>
        <time dateTime={project.updatedAt}>{formatRelative(project.updatedAt)}</time>
      </div>
    </li>
  );
}

function AssetTile({ asset }: { readonly asset: Asset }) {
  const previewUrl = asset.preview_url ?? asset.thumbnail_url;
  // `props` is optional in the contract; narrow once here so the markup stays
  // free of repeated optional-chaining.
  const width = asset.props?.width ?? undefined;
  const height = asset.props?.height ?? undefined;

  return (
    <li className="overflow-hidden rounded-md border border-line bg-surface-raised">
      <div className="aspect-4/3 w-full bg-surface-overlay">
        {previewUrl ? (
          <img
            src={previewUrl}
            alt={asset.name}
            width={width}
            height={height}
            loading="lazy"
            className="size-full object-cover"
          />
        ) : (
          <div className="grid size-full place-items-center text-2xs uppercase tracking-wider text-content-subtle">
            {asset.type}
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-2 p-2">
        <p className="truncate text-xs text-content" title={asset.name}>
          {asset.name}
        </p>
        <Badge tone={assetTypeTone(asset.type)}>{asset.type}</Badge>
      </div>
    </li>
  );
}

function JobRow({ job }: { readonly job: Job }) {
  return (
    <li className="flex flex-col gap-2 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-content">{job.operation_id}</p>
        <Badge tone={jobStatusTone(job.status)}>{job.status}</Badge>
      </div>
      <ProgressBar
        value={job.progress ?? 0}
        label={`${job.operation_id} progress`}
      />
    </li>
  );
}

function ProviderRow({ provider }: { readonly provider: ProviderListItem }) {
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3">
      <div>
        <p className="text-sm font-medium text-content">{provider.name}</p>
        <p className="text-xs text-content-muted">
          {provider.operations.join(" · ")}
        </p>
      </div>
      <Badge tone={providerStatusTone(provider.status)}>{provider.status}</Badge>
    </li>
  );
}

function HomeSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading home summary">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-64" />
      <Skeleton className="h-48" />
    </div>
  );
}

export function HomeScreen() {
  const { data, isPending, isError, error, refetch } = useHomeSummary();

  return (
    <div>
      <PageHeader
        title="Home"
        description="Your studio at a glance — projects, recent assets, active jobs, and provider health."
        actions={
          <Button variant="secondary" size="sm" onClick={() => void refetch()}>
            Refresh
          </Button>
        }
      />

      <div className="space-y-6">
        <DashboardPanel />
        <ActivityFeedPanel />
        <ActivityStatsPanel
          title="Workspace activity stats"
          description="Authoritative event metrics across every project in the workspace."
        />
        <ProjectStatsPanel
          title="Workspace project stats"
          description="Authoritative portfolio metrics across every project in the workspace."
        />
        <OrganizationStatsPanel
          title="Workspace organization stats"
          description="Authoritative membership metrics across every organization in the workspace."
        />
        <ConversationStatsPanel
          title="Workspace conversation stats"
          description="Authoritative message metrics across every project in the workspace."
        />
        <ConversationFeedPanel
          title="Workspace conversations"
          description="Newest-first conversations across every project in the workspace."
        />
        <CommentFeedPanel
          title="Workspace comments"
          description="Newest-first collaboration comments across every project in the workspace."
        />
        <CommentStatsPanel
          title="Workspace comment stats"
          description="Authoritative comment metrics across every project in the workspace."
        />
        <AssetStatsPanel
          title="Workspace asset stats"
          description="Authoritative inventory metrics across every project in the workspace."
        />
        <AssetFeedPanel
          title="Workspace assets"
          description="Newest-first live assets across every project in the workspace."
        />
        <VersionStatsPanel
          title="Workspace version stats"
          description="Authoritative asset version metrics across every project in the workspace."
        />
        <VersionFeedPanel
          title="Workspace asset versions"
          description="Newest-first asset version records across every project in the workspace."
        />
        <PublishFeedPanel
          title="Workspace published deliverables"
          description="Newest-first published assets across every project in the workspace."
        />
        <PublishStatsPanel
          title="Workspace publish stats"
          description="Authoritative publish metrics across every project in the workspace."
        />
        <SearchStatsPanel
          title="Workspace search stats"
          description="Authoritative index metrics for projects, assets and conversations in the workspace."
        />
        <UploadFeedPanel
          title="Workspace upload tickets"
          description="Newest-first upload tickets across every project in the workspace."
        />
        <UploadStatsPanel
          title="Workspace upload stats"
          description="Authoritative upload-ticket metrics across every project in the workspace."
        />
        <UploadOverviewPanel
          title="Workspace upload overview"
          description="Select an upload ticket to inspect its byte accounting and whole-project activity."
        />

        {isPending ? <HomeSkeleton /> : null}

        {isError ? (
          <Card className="p-6">
            <EmptyState
              title="Could not load your studio"
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
        <div className="space-y-6">
          <section aria-label="Studio metrics" className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard label="Active projects" value={data.projects.length} />
            <StatCard label="Recent assets" value={data.recentAssets.length} />
            <StatCard label="Active jobs" value={data.activeJobs.length} />
            <StatCard label="Providers" value={data.providers.length} />
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <div className="p-4">
                <SectionHeader
                  title="Active projects"
                  description="Production work currently in progress."
                />
              </div>
              {data.projects.length === 0 ? (
                <div className="border-t border-line p-4">
                  <EmptyState title="No projects" description="Create a project to start organizing production work." />
                </div>
              ) : (
                <ul className="divide-y divide-line border-t border-line">
                  {data.projects.map((project) => (
                    <ProjectRow key={project.id} project={project} />
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <div className="p-4">
                <SectionHeader
                  title="Active jobs"
                  description="Operations running or queued on the backend."
                />
              </div>
              {data.activeJobs.length > 0 ? (
                <ul className="divide-y divide-line border-t border-line">
                  {data.activeJobs.map((job) => (
                    <JobRow key={job.id} job={job} />
                  ))}
                </ul>
              ) : (
                <div className="border-t border-line p-4">
                  <EmptyState title="No active jobs" description="Submit an operation to see progress here." />
                </div>
              )}
            </Card>
          </div>

          <Card>
            <div className="p-4">
              <SectionHeader
                title="Recent assets"
                description="Latest generated and imported items across projects."
              />
            </div>
            {data.recentAssets.length === 0 ? (
              <div className="border-t border-line p-4">
                <EmptyState title="No recent assets" description="Generated and imported assets will appear here." />
              </div>
            ) : (
              <ul className="grid grid-cols-2 gap-3 border-t border-line p-4 sm:grid-cols-3 md:grid-cols-6">
                {data.recentAssets.map((asset) => (
                  <AssetTile key={asset.id} asset={asset} />
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <div className="p-4">
              <SectionHeader
                title="Providers & capabilities"
                description="Execution backends available to your studio."
              />
            </div>
            {data.providers.length === 0 ? (
              <div className="border-t border-line p-4">
                <EmptyState title="No providers" description="Connect a local or cloud provider to enable generation." />
              </div>
            ) : (
              <ul className="divide-y divide-line border-t border-line">
                {data.providers.map((provider) => (
                  <ProviderRow key={provider.id} provider={provider} />
                ))}
              </ul>
            )}
          </Card>
        </div>
      ) : null}
      </div>
    </div>
  );
}
