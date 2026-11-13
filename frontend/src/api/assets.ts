/** Asset library, lineage, versions and upload endpoints. */

import type {
  Asset,
  AssetLineage,
  AssetVersionCreate,
  AssetVersionCreateRequest,
  AssetVersionRegisterRequest,
  AssetVersionRequest,
  CreateAssetVersionRequest,
  AssetRegisterRequest,
  AssetRelationship,
  AssetType,
  AssetUpdate,
  AssetVersion,
  DownloadTicket,
  RelationshipType,
  UploadRequest,
  UploadTicket,
  Uuid,
} from "../types";
import type { ApiClient } from "./client";

/** Mirrors the query parameters accepted by `GET /assets` (see routers/assets.py). */
export interface AssetListQuery {
  project_id?: Uuid;
  type?: AssetType;
  tag?: string;
  search?: string;
  /** Last asset ID from the previous page (keyset pagination). */
  cursor?: Uuid;
  limit?: number;
  /** Include soft-deleted assets. Defaults to false on the backend. */
  include_deleted?: boolean;
}

export function createAssetsApi(client: ApiClient) {
  return {
    list(query: AssetListQuery = {}): Promise<Asset[]> {
      return client.get("/assets", {
        query: {
          project_id: query.project_id,
          type: query.type,
          tag: query.tag,
          search: query.search,
          cursor: query.cursor,
          limit: query.limit,
          include_deleted: query.include_deleted,
        },
      });
    },
    get(assetId: Uuid): Promise<Asset> {
      return client.get(`/assets/${assetId}`);
    },
    /** `upload_id` is returned by `createUpload` and echoes the completed upload. */
    register(body: AssetRegisterRequest): Promise<Asset> {
      return client.post("/assets/register", body);
    },
    update(assetId: Uuid, body: AssetUpdate): Promise<Asset> {
      return client.patch(`/assets/${assetId}`, body);
    },
    softDelete(assetId: Uuid): Promise<void> {
      return client.delete<void>(`/assets/${assetId}`);
    },
    listVersions(assetId: Uuid): Promise<AssetVersion[]> {
      return client.get(`/assets/${assetId}/versions`);
    },
    createVersion(assetId: Uuid, body: AssetVersionCreateRequest | AssetVersionCreate | AssetVersionRegisterRequest | AssetVersionRequest | CreateAssetVersionRequest): Promise<AssetVersion> {
      return client.post(`/assets/${assetId}/versions`, body);
    },
    listRelationships(assetId: Uuid, type?: RelationshipType): Promise<AssetRelationship[]> {
      return client.get(`/assets/${assetId}/relationships`, { query: { type } });
    },
    lineage(assetId: Uuid, depth = 5): Promise<AssetLineage> {
      return client.get(`/assets/${assetId}/lineage`, { query: { depth } });
    },

    // --- Uploads ------------------------------------------------------------

    createUpload(body: UploadRequest): Promise<UploadTicket> {
      return client.post("/uploads", body);
    },
    /** Short-lived signed URL for downloading the original bytes. */
    downloadTicket(assetId: Uuid): Promise<DownloadTicket> {
      return client.get(`/assets/${assetId}/download`);
    },
  };
}

/**
 * PUT bytes directly to a presigned upload target.
 * This bypasses the JSON client: storage is not part of the application API.
 */
export async function putToUploadTicket(
  ticket: UploadTicket,
  file: Blob,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const response = await fetchImpl(ticket.url, {
    method: ticket.method,
    headers: { "Content-Type": file.type || "application/octet-stream", ...ticket.headers },
    body: file,
  });
  if (!response.ok) {
    throw new Error(`Upload failed with status ${response.status}`);
  }
}

export type AssetsApi = ReturnType<typeof createAssetsApi>;
