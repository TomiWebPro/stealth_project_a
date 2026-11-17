/**
 * Capability-discovery view model.
 *
 * Flattens `Provider.capabilities` into rows a picker can render without
 * joining provider payloads inline. Presentation-only; not a backend contract.
 */

import type { ProviderLocation, ProviderStatus } from "./types";

export interface CapabilityMatch {
  readonly provider_id: string;
  readonly provider_name: string;
  readonly location: ProviderLocation;
  readonly status: ProviderStatus;
  readonly operation_id: string;
  readonly schema_versions: readonly string[];
}
