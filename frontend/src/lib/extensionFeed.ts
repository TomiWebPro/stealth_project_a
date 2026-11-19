/**
 * Authoritative extension installation feed derivation + query helpers (C173
 * follow-up).
 *
 * The backend (`ExtensionFeedRepository`) keeps no second index: it derives a
 * newest-first, workspace-wide feed fresh from the authoritative `EXTENSIONS`
 * collection — the same store `/extensions` lists and `/extensions/stats`
 * aggregates — so the three views can never drift. Each item is projected with
 * its manifest display fields and trust flags; the extension id is the same
 * deterministic `uuid5(NAMESPACE_URL, "studio-extension:{manifest_id}")`
 * installation uses, so the feed agrees with `/extensions/{id}`. Ordering is by
 * descending `(installed_at, extension_id)` for a deterministic wire shape, and
 * `total` counts the whole filtered feed before the `limit` page.
 *
 * `lib/extensionFeed` reproduces that derivation over the same seed so mock
 * mode stays at feature parity with live mode and the parity guard can drive
 * both transports over identical data. Invalid `type`/`status`/`limit` values
 * use the shared 422 envelope, matching the router's query validation.
 */

import { ApiError } from "../api/client";
import { EXTENSION_STATUSES, EXTENSION_TYPES } from "./extensionStats";
import type {
  Extension,
  ExtensionFeed,
  ExtensionFeedItem,
  ExtensionStatus,
  ExtensionType,
} from "./types";

/** Optional filters/page bound mirrored from the authoritative `/extensions/feed` endpoint. */
export interface ExtensionFeedOptions {
  readonly type?: ExtensionType;
  readonly status?: ExtensionStatus;
  readonly limit?: number;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/**
 * Mirror the router's optional enum `type`/`status` and bounded `limit`
 * validation so mock and live fail identically with the shared error envelope.
 */
export function validateExtensionFeedArgs(options: ExtensionFeedOptions = {}): void {
  if (options.type !== undefined && !EXTENSION_TYPES.includes(options.type)) {
    throw new ApiError({
      status: 422,
      code: "validation_error",
      message: "Invalid extension type.",
      details: [
        { field: "type", message: "type must be one of capability, ui, provider, runtime, bundle" },
      ],
    });
  }
  if (options.status !== undefined && !EXTENSION_STATUSES.includes(options.status)) {
    throw new ApiError({
      status: 422,
      code: "validation_error",
      message: "Invalid extension status.",
      details: [
        {
          field: "status",
          message: "status must be one of installed, enabled, disabled, update_available",
        },
      ],
    });
  }
  if (
    options.limit !== undefined &&
    (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > MAX_LIMIT)
  ) {
    throw new ApiError({
      status: 422,
      code: "validation_error",
      message: "Feed limit must be between 1 and 200.",
      details: [{ field: "limit", message: "limit must be between 1 and 200" }],
    });
  }
}

// --- Deterministic extension id (uuid5 / NAMESPACE_URL) --------------------
// Reproduces Python's `uuid5(NAMESPACE_URL, "studio-extension:" + manifest_id)`
// without a runtime dependency so the browser bundle matches the backend's
// installation-derived id byte-for-byte.

const NAMESPACE_URL_BYTES = [
  0x6b, 0xa7, 0xb8, 0x11, 0x9d, 0xad, 0x11, 0xd1, 0x80, 0xb4, 0x00, 0xc0, 0x4f, 0xd4, 0x30, 0xc8,
];

function rotl(value: number, bits: number): number {
  return ((value << bits) | (value >>> (32 - bits))) >>> 0;
}

/** Minimal SHA-1 over a byte array, returning the 20 digest bytes. */
function sha1(bytes: Uint8Array): Uint8Array {
  const bitLength = bytes.length * 8;
  const paddedLength = bytes.length + 1 + ((64 - ((bytes.length + 9) % 64)) % 64) + 8;
  const message = new Uint8Array(paddedLength);
  message.set(bytes);
  message[bytes.length] = 0x80;
  const view = new DataView(message.buffer);
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000));
  view.setUint32(paddedLength - 4, bitLength >>> 0);

  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;
  let h4 = 0xc3d2e1f0;
  const words = new Uint32Array(80);

  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let i = 0; i < 16; i += 1) words[i] = view.getUint32(offset + i * 4);
    for (let i = 16; i < 80; i += 1) {
      words[i] = rotl(words[i - 3]! ^ words[i - 8]! ^ words[i - 14]! ^ words[i - 16]!, 1);
    }
    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    for (let i = 0; i < 80; i += 1) {
      let f: number;
      let k: number;
      if (i < 20) {
        f = (b & c) | (~b & d);
        k = 0x5a827999;
      } else if (i < 40) {
        f = b ^ c ^ d;
        k = 0x6ed9eba1;
      } else if (i < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8f1bbcdc;
      } else {
        f = b ^ c ^ d;
        k = 0xca62c1d6;
      }
      const next = (rotl(a, 5) + f + e + k + words[i]!) >>> 0;
      e = d;
      d = c;
      c = rotl(b, 30);
      b = a;
      a = next;
    }
    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
  }

  const digest = new Uint8Array(20);
  const digestView = new DataView(digest.buffer);
  digestView.setUint32(0, h0);
  digestView.setUint32(4, h1);
  digestView.setUint32(8, h2);
  digestView.setUint32(12, h3);
  digestView.setUint32(16, h4);
  return digest;
}

/** The stable `Uuid` the backend assigns to an installed extension manifest. */
export function extensionId(manifestId: string): string {
  const name = new TextEncoder().encode(`studio-extension:${manifestId}`);
  const data = new Uint8Array(NAMESPACE_URL_BYTES.length + name.length);
  data.set(NAMESPACE_URL_BYTES);
  data.set(name, NAMESPACE_URL_BYTES.length);
  const hash = sha1(data).slice(0, 16);
  hash[6] = (hash[6]! & 0x0f) | 0x50; // version 5
  hash[8] = (hash[8]! & 0x3f) | 0x80; // RFC 4122 variant
  const hex = Array.from(hash, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Derive the feed exactly as the backend repository does: filter by type/status,
 * skip documents with no recorded install time, project each with its manifest
 * fields and trust flags, sort newest-first with an id tie-break and apply the
 * `limit` page. `total` counts the whole filtered feed before paging; an empty
 * scope yields an empty feed (never an error).
 */
export function deriveExtensionFeed(
  extensions: readonly Extension[],
  now: string,
  options: ExtensionFeedOptions = {},
): ExtensionFeed {
  const { limit = DEFAULT_LIMIT } = options;
  const items: ExtensionFeedItem[] = [];
  for (const extension of extensions) {
    const manifest = extension.manifest;
    if (options.type !== undefined && manifest.type !== options.type) continue;
    if (options.status !== undefined && extension.status !== options.status) continue;
    if (!extension.installed_at) continue;
    items.push({
      extension_id: extensionId(manifest.id),
      manifest_id: manifest.id,
      name: manifest.name,
      version: manifest.version,
      publisher: manifest.publisher,
      type: manifest.type,
      status: extension.status,
      signed: extension.signed ?? false,
      verified: extension.verified ?? false,
      installed_at: extension.installed_at,
    });
  }
  items.sort(
    (a, b) => b.installed_at.localeCompare(a.installed_at) || b.extension_id.localeCompare(a.extension_id),
  );
  return { items: items.slice(0, limit), total: items.length, generated_at: now };
}

/** Query-string values for the live `/extensions/feed` request. */
export function extensionFeedQueryParams(
  options: ExtensionFeedOptions = {},
): Record<string, string | number | undefined> {
  return { type: options.type, status: options.status, limit: options.limit };
}
