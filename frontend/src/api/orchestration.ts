/** Orchestration, collaboration (presence/comments) and storage stats. */

import type {
  Comment,
  OrchestrationRun,
  OrchestrationRunRequest,
  Presence,
  StorageStats,
  Uuid,
} from "../types";
import type { ApiClient } from "./client";

export function createOrchestrationApi(client: ApiClient) {
  return {
    /** Ask the orchestration layer to plan and submit an operation graph. */
    run(body: OrchestrationRunRequest): Promise<OrchestrationRun> {
      return client.post("/orchestration/runs", body);
    },
    get(runId: Uuid): Promise<OrchestrationRun> {
      return client.get(`/orchestration/runs/${runId}`);
    },
  };
}

export function createCollaborationApi(client: ApiClient) {
  return {
    presence(projectId: Uuid): Promise<Presence[]> {
      return client.get("/presence", { query: { project_id: projectId } });
    },
    listComments(projectId: Uuid, assetId?: Uuid): Promise<Comment[]> {
      return client.get("/comments", {
        query: { project_id: projectId, asset_id: assetId },
      });
    },
    addComment(projectId: Uuid, body: string, assetId?: Uuid): Promise<Comment> {
      return client.post("/comments", {
        project_id: projectId,
        asset_id: assetId ?? null,
        body,
      });
    },
  };
}

export function createStorageApi(client: ApiClient) {
  return {
    stats(projectId: Uuid): Promise<StorageStats> {
      return client.get("/storage/stats", { query: { project_id: projectId } });
    },
  };
}

export type OrchestrationApi = ReturnType<typeof createOrchestrationApi>;
export type CollaborationApi = ReturnType<typeof createCollaborationApi>;
export type StorageApi = ReturnType<typeof createStorageApi>;
