/** Operation catalog and job lifecycle endpoints. */

import type {
  Job,
  JobCancelRequest,
  JobEvent,
  JobEventFrame,
  JobListQuery,
  JobResult,
  JobRetryRequest,
  OperationCatalog,
  OperationRequest,
  Uuid,
} from "../types";
import type { ApiClient } from "./client";

export function createOperationsApi(client: ApiClient) {
  return {
    /** Discover available operations without hardcoding models/providers. */
    catalog(): Promise<OperationCatalog> {
      return client.get("/operations");
    },

    // --- Jobs ---------------------------------------------------------------

    submit(body: OperationRequest, idempotencyKey?: string): Promise<Job> {
      return client.post("/jobs", body, { idempotencyKey });
    },
    list(query: JobListQuery = {}): Promise<Job[]> {
      return client.get("/jobs", {
        query: {
          project_id: query.project_id,
          status: query.status,
          limit: query.limit,
        },
      });
    },
    get(jobId: Uuid): Promise<Job> {
      return client.get(`/jobs/${jobId}`);
    },
    cancel(jobId: Uuid, body: JobCancelRequest = {}): Promise<Job> {
      return client.post(`/jobs/${jobId}/cancel`, body, {
        idempotencyKey: `cancel:${jobId}`,
      });
    },
    retry(jobId: Uuid, body: JobRetryRequest): Promise<Job> {
      return client.post(`/jobs/${jobId}/retry`, body, {
        idempotencyKey: body.idempotency_key,
      });
    },
    /** Poll-based recovery: fetch events after a known sequence number. */
    events(jobId: Uuid, sinceSeq: number): Promise<JobEventFrame> {
      return client.get(`/jobs/${jobId}/events`, { query: { since: sinceSeq } });
    },
    result(jobId: Uuid): Promise<JobResult> {
      return client.get(`/jobs/${jobId}/result`);
    },
    /** Live job progress channel. Resume from `sinceSeq` after reconnects. */
    openEventStream(jobId: Uuid, sinceSeq = 0): WebSocket {
      return new WebSocket(
        client.websocketUrl(`/jobs/${jobId}/events/stream?since=${sinceSeq}`),
      );
    },
  };
}

/** Parse a raw WebSocket payload into a typed `JobEvent`. */
export function parseJobEvent(data: string): JobEvent {
  return JSON.parse(data) as JobEvent;
}

export type OperationsApi = ReturnType<typeof createOperationsApi>;
