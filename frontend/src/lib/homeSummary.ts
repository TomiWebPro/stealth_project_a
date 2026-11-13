/**
 * Home screen view models.
 *
 * Presentation shapes assembled from the shared API contracts in `src/types`,
 * not API payloads themselves. Screens render these so they never depend on
 * backend field naming (e.g. snake_case) or derive display values inline.
 */

import type { Asset, Job, ProviderStatus } from "./types";

export interface ProjectListItem {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly assetCount: number;
  readonly updatedAt: string;
}

export interface ProviderListItem {
  readonly id: string;
  readonly name: string;
  readonly status: ProviderStatus;
  /** Human-readable operation ids the provider can execute. */
  readonly operations: readonly string[];
}

export interface HomeSummary {
  readonly projects: readonly ProjectListItem[];
  readonly recentAssets: readonly Asset[];
  readonly activeJobs: readonly Job[];
  readonly providers: readonly ProviderListItem[];
}
