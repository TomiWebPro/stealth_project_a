/**
 * Contract re-export surface for UI code.
 *
 * The canonical API contracts live in `src/types` (they mirror the backend
 * schemas and are parity-checked). UI modules import shared types from here so
 * that a future contract location change touches one file, not every screen.
 */
export type {
  ActivityEvent,
  ActivityFeed,
  ActivityKind,
  ActivityTone,
  Asset,
  AssetImpact,
  AssetProps,
  AssetStatus,
  AssetUpdate,
  AssetType,
  AuditEvent,
  AuditEventKind,
  AuditTone,
  AuditTrail,
  Comment,
  Conversation,
  DashboardCounts,
  DashboardSummary,
  Extension,
  ImpactNode,
  Job,
  JobStatus,
  Message,
  MessageCreate,
  Metadata,
  OperationCatalog,
  Organization,
  OrchestrationRun,
  Presence,
  PresenceState,
  Project,
  Provider,
  ProviderCapability,
  ProviderLocation,
  ProviderStatus,
  RelationshipType,
  SearchResponse,
  SearchResult,
  SearchResultKind,
  StorageRef,
  StorageStats,
  StreamEvent,
  StreamEventType,
  TagFacet,
  TagIndex,
  Timestamp,
  User,
  Uuid,
} from "../types";

// Job-statistics contracts are not (yet) re-exported from the canonical types
// index; source them directly from their parity-checked module.
export type { JobStats, JobStatusCount, OperationJobStat } from "../types/jobStats";
