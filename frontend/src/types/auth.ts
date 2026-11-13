/**
 * Auth and organization/membership contracts.
 * Mirrors backend/app/schemas/auth.py.
 */

import type { Email, Metadata, Timestamp, Uuid } from "./common";

export type MemberRole = "owner" | "admin" | "member" | "viewer";

// --- Auth -------------------------------------------------------------------

export interface User {
  id: Uuid;
  email: Email;
  display_name: string;
  avatar_url?: string | null;
  created_at: Timestamp;
}

export interface LoginRequest {
  email: Email;
  password: string;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type?: "bearer";
  /** Access token lifetime in seconds. */
  expires_in: number;
}

export interface RefreshRequest {
  refresh_token: string;
}

export interface SessionResponse {
  user: User;
  tokens: TokenPair;
}

// --- Organizations ----------------------------------------------------------

export interface Organization {
  id: Uuid;
  name: string;
  slug: string;
  created_at: Timestamp;
  metadata?: Metadata;
}

export interface OrganizationCreate {
  name: string;
  slug: string;
}

export interface Member {
  user_id: Uuid;
  email: Email;
  display_name: string;
  role: MemberRole;
  joined_at: Timestamp;
}

export interface MemberInvite {
  email: Email;
  role?: MemberRole;
}

// --- Projects ---------------------------------------------------------------

export interface Project {
  id: Uuid;
  org_id: Uuid;
  name: string;
  description?: string | null;
  created_by: Uuid;
  created_at: Timestamp;
  updated_at: Timestamp;
  archived?: boolean;
}

export interface ProjectCreate {
  name: string;
  description?: string | null;
}

export interface ProjectUpdate {
  name?: string | null;
  description?: string | null;
  archived?: boolean | null;
}
