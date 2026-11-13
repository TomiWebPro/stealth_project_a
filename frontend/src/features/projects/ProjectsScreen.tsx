import { useProjects } from "../../hooks/useQueries";
import { errorMessage } from "../../lib/errors";
import type { Project } from "../../lib/types";
import { PageHeader } from "../../layout/AppLayout";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card, SectionHeader } from "../../ui/Card";
import { EmptyState, Skeleton } from "../../ui/Feedback";

function ProjectRow({ project }: { readonly project: Project }) {
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
        <time dateTime={project.updated_at}>
          {new Date(project.updated_at).toLocaleDateString()}
        </time>
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
  const { data, isPending, isError, error, refetch } = useProjects();

  return (
    <div>
      <PageHeader
        title="Projects"
        description="Production work across your studio."
        actions={
          <Button variant="secondary" size="sm" onClick={() => void refetch()}>
            Refresh
          </Button>
        }
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
              description="Mock data from the in-memory API client."
            />
          </div>
          {data.length > 0 ? (
            <ul className="divide-y divide-line border-t border-line">
              {data.map((project) => (
                <ProjectRow key={project.id} project={project} />
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
