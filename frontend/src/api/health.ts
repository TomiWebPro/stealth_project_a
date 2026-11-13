/** Health and version probes (`GET /health`, `GET /version`). */

import type { HealthResponse, VersionResponse } from "../types";
import type { ApiClient } from "./client";

export function createHealthApi(client: ApiClient) {
  return {
    /** Liveness/readiness probe. Stays 200; gate on `status`. */
    check(): Promise<HealthResponse> {
      return client.get("/health");
    },
    /** API contract version and build identifier. */
    version(): Promise<VersionResponse> {
      return client.get("/version");
    },
  };
}

export type HealthApi = ReturnType<typeof createHealthApi>;
