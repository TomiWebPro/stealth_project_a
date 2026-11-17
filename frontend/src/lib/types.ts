/**
 * Contract re-export surface for UI code.
 *
 * The canonical API contracts live in `src/types` (they mirror the backend
 * schemas and are parity-checked). UI modules import shared types from here so
 * that a future contract location change touches one file, not every screen.
 */
export type {
  Asset,
  AssetProps,
  AssetStatus,
  AssetType,
  Comment,
  Conversation,
  Extension,
  Job,
  JobStatus,
  Message,
  Metadata,
  OperationCatalog,
  Organization,
  OrchestrationRun,
  Presence,
  Project,
  Provider,
  ProviderCapability,
  ProviderLocation,
  ProviderStatus,
  StorageRef,
  StorageStats,
  Timestamp,
  User,
  Uuid,
} from "../types";
