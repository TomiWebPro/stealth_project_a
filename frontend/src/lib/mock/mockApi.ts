import { env } from "../env";
import type { HomeSummary } from "../homeSummary";
import type { ProjectDetail } from "../projectDetail";
import type { Asset, Job, Project, Provider } from "../types";
import { ASSETS, JOBS, PROJECTS, PROVIDERS } from "./data";

/**
 * Mock API transport.
 *
 * Simulates the stable application API so the frontend can be built before the
 * backend exists. Every function mirrors a future real endpoint on `src/api`
 * and returns the same typed payloads from `src/types`. Assembled view models
 * (`HomeSummary`, `ProjectDetail`) are built here so screens never map
 * backend payloads.
 */

function delay<T>(value: T): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(value), env.mockLatencyMs);
  });
}

function toSummary(): HomeSummary {
  return {
    projects: PROJECTS.filter((project) => !project.archived).map((project) => ({
      id: project.id,
      name: project.name,
      description: project.description ?? "",
      assetCount: ASSETS.filter((asset) => asset.project_id === project.id).length,
      updatedAt: project.updated_at,
    })),
    recentAssets: [...ASSETS]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 6),
    activeJobs: JOBS.filter(
      (candidate) => candidate.status === "queued" || candidate.status === "running",
    ),
    providers: PROVIDERS.map((provider) => ({
      id: provider.id,
      name: provider.name,
      status: provider.status,
      operations: (provider.capabilities ?? []).map((capability) => capability.operation_id),
    })),
  };
}

export async function fetchHomeSummary(): Promise<HomeSummary> {
  return delay(toSummary());
}

export async function fetchProjects(): Promise<readonly Project[]> {
  return delay(PROJECTS);
}

export async function fetchProject(projectId: string): Promise<Project | undefined> {
  return delay(PROJECTS.find((project) => project.id === projectId));
}

export async function fetchRecentAssets(
  limit = 6,
): Promise<readonly Asset[]> {
  const assets = [...ASSETS]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit);
  return delay(assets);
}

export async function fetchAssetsByProject(projectId: string): Promise<readonly Asset[]> {
  const assets = ASSETS.filter((asset) => asset.project_id === projectId).sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  );
  return delay(assets);
}

export async function fetchJobs(projectId?: string): Promise<readonly Job[]> {
  const jobs = (projectId ? JOBS.filter((job) => job.project_id === projectId) : [...JOBS]).sort(
    (a, b) => b.created_at.localeCompare(a.created_at),
  );
  return delay(jobs);
}

export async function fetchProjectDetail(projectId: string): Promise<ProjectDetail | undefined> {
  const project = PROJECTS.find((candidate) => candidate.id === projectId);
  if (!project) {
    return delay(undefined);
  }
  return delay({
    project,
    assets: ASSETS.filter((asset) => asset.project_id === projectId).sort((a, b) =>
      b.created_at.localeCompare(a.created_at),
    ),
    jobs: JOBS.filter((job) => job.project_id === projectId).sort((a, b) =>
      b.created_at.localeCompare(a.created_at),
    ),
  });
}

export async function fetchProviders(): Promise<readonly Provider[]> {
  return delay(PROVIDERS);
}
