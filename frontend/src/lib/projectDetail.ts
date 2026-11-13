/**
 * Project detail view model.
 *
 * Presentation shape assembled from the shared API contracts in `src/types`,
 * not an API payload itself. The detail screen renders this so it never joins
 * backend payloads inline.
 */

import type { Asset, Job, Project } from "./types";

export interface ProjectDetail {
  readonly project: Project;
  readonly assets: readonly Asset[];
  readonly jobs: readonly Job[];
}
