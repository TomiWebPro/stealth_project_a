/**
 * Provider capability discovery and extension manifest contracts.
 * Mirrors backend/app/schemas/provider.py.
 */

import type { Metadata, Timestamp, Uuid } from "./common";

export type ProviderStatus = "available" | "unavailable" | "degraded";
export type ProviderLocation = "local" | "studio" | "cloud";
export type ExtensionType = "capability" | "ui" | "provider" | "runtime" | "bundle";
export type ExtensionStatus = "installed" | "enabled" | "disabled" | "update_available";

export interface ProviderCapability {
  operation_id: string;
  schema_versions?: string[];
}

export interface Provider {
  id: string;
  name: string;
  location: ProviderLocation;
  status: ProviderStatus;
  capabilities?: ProviderCapability[];
  metadata?: Metadata;
}

export interface CapabilityQuery {
  operation_id?: string | null;
  location?: ProviderLocation | null;
}

export interface ExtensionPermission {
  name: string;
  description?: string | null;
}

export interface ExtensionDependency {
  extension_id: string;
  version_range: string;
}

export interface ExtensionRequirements {
  app_versions: string;
  permissions?: ExtensionPermission[];
  capabilities?: string[];
  provider_ids?: string[];
  runtime?: string | null;
}

export interface ExtensionManifest {
  id: string;
  name: string;
  version: string;
  publisher: string;
  type: ExtensionType;
  requirements: ExtensionRequirements;
  dependencies?: ExtensionDependency[];
  ui_contributions?: string[];
}

export interface Extension {
  manifest: ExtensionManifest;
  status: ExtensionStatus;
  installed_at?: Timestamp | null;
  signed?: boolean;
  verified?: boolean;
}

export interface ExtensionInstallRequest {
  source?: "registry" | "package" | "org";
  extension_id: string;
  version?: string | null;
  accepted_permissions?: string[];
}

export interface ExtensionInstallResult {
  extension_id: Uuid;
  status: ExtensionStatus;
  manifest: ExtensionManifest;
}
