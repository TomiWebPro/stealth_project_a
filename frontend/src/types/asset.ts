/**
 * Asset, lineage, version and relationship contracts.
 * Mirrors backend/app/schemas/asset.py.
 *
 * Large media live in object storage; the API exposes references and
 * short-lived download URLs only.
 */

import type { Metadata, Timestamp, Uuid } from "./common";

export type AssetType =
  | "image"
  | "video"
  | "audio"
  | "model3d"
  | "splat"
  | "texture"
  | "dataset"
  | "lora"
  | "scene"
  | "resource";
export type AssetStatus = "pending" | "processing" | "ready" | "failed" | "deleted";
export type RelationshipType =
  | "derived_from"
  | "variant_of"
  | "uses_input"
  | "related_to"
  | "duplicate_of";

/** Where the bytes live. `url` is a short-lived signed URL when present. */
export interface StorageRef {
  backend?: "s3" | "local";
  bucket?: string | null;
  key: string;
  size_bytes: number;
  content_type: string;
  etag?: string | null;
  url?: string | null;
}

export interface AssetProps {
  width?: number | null;
  height?: number | null;
  duration_ms?: number | null;
  fps?: number | null;
  format?: string | null;
}

/** Traceable production history for a generated/derived asset. */
export interface Provenance {
  operation_id?: string | null;
  operation_version?: string | null;
  conversation_id?: Uuid | null;
  message_id?: Uuid | null;
  job_id?: Uuid | null;
  prompt?: string | null;
  provider_id?: string | null;
  workflow?: string | null;
  params?: Metadata;
}

export interface Asset {
  id: Uuid;
  project_id: Uuid;
  type: AssetType;
  name: string;
  status?: AssetStatus;
  creator_id: Uuid;
  version?: number;
  tags?: string[];
  storage: StorageRef;
  props?: AssetProps;
  preview_url?: string | null;
  thumbnail_url?: string | null;
  provenance?: Provenance;
  parent_asset_ids?: Uuid[];
  metadata?: Metadata;
  created_at: Timestamp;
  updated_at: Timestamp;
}

/** Register a client-known asset (upload already completed). */
export interface AssetRegisterRequest {
  project_id: Uuid;
  type: AssetType;
  name: string;
  storage: StorageRef;
  props?: AssetProps;
  provenance?: Provenance;
  parent_asset_ids?: Uuid[];
  tags?: string[];
  upload_id?: Uuid | null;
}

export interface AssetUpdate {
  name?: string | null;
  tags?: string[] | null;
  metadata?: Metadata | null;
}

export interface AssetVersion {
  asset_id: Uuid;
  version: number;
  storage: StorageRef;
  created_at: Timestamp;
  created_by: Uuid;
}

/** Create a new version of an existing asset (storage already uploaded). */
export interface AssetVersionCreate {
  storage: StorageRef;
  upload_id?: Uuid | null;
}

/** Create a new version of an existing asset (storage already uploaded). */
export interface AssetVersionCreateRequest {
  storage: StorageRef;
  upload_id?: Uuid | null;
}

/** Register a new version of an existing asset (upload already completed). */
export interface AssetVersionRegisterRequest {
  storage: StorageRef;
  upload_id?: Uuid | null;
}

/** Request payload for adding a version to an existing asset. */
export interface AssetVersionRequest {
  storage: StorageRef;
  upload_id?: Uuid | null;
}

/** Request payload for creating a new asset version. */
export interface CreateAssetVersionRequest {
  storage: StorageRef;
  upload_id?: Uuid | null;
}

export interface AssetRelationship {
  id: Uuid;
  from_asset_id: Uuid;
  to_asset_id: Uuid;
  type: RelationshipType;
  created_at: Timestamp;
}

export interface AssetLineageNode {
  asset_id: Uuid;
  relationship?: RelationshipType | null;
  depth?: number;
}

export interface AssetLineage {
  root_asset_id: Uuid;
  nodes?: AssetLineageNode[];
}

// --- Uploads ----------------------------------------------------------------

export interface UploadRequest {
  project_id: Uuid;
  filename: string;
  content_type: string;
  size_bytes: number;
}

/** Presigned upload target; the client PUTs bytes directly to `url`. */
export interface UploadTicket {
  upload_id: Uuid;
  url: string;
  method?: "PUT";
  headers?: Record<string, string>;
  expires_at: Timestamp;
}

export interface DownloadTicket {
  url: string;
  expires_at: Timestamp;
}
