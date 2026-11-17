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
  SearchResponse,
  SearchResult,
  SearchResultKind,
  StorageRef,
  StorageStats,
  StreamEvent,
  StreamEventType,
  Timestamp,
  User,
  Uuid,
} from "../types";
