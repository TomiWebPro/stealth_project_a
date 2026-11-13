/** Auth, organization and project endpoints. */

import type {
  LoginRequest,
  Member,
  MemberInvite,
  Organization,
  OrganizationCreate,
  Project,
  ProjectCreate,
  ProjectUpdate,
  RefreshRequest,
  SessionResponse,
  TokenPair,
  User,
  Uuid,
} from "../types";
import type { ApiClient } from "./client";

export function createAuthApi(client: ApiClient) {
  return {
    login(body: LoginRequest): Promise<SessionResponse> {
      return client.post("/auth/login", body, { auth: false });
    },
    refresh(body: RefreshRequest): Promise<TokenPair> {
      return client.post("/auth/refresh", body, { auth: false });
    },
    logout(): Promise<void> {
      return client.post<void>("/auth/logout");
    },
    me(): Promise<User> {
      return client.get("/auth/me");
    },
  };
}

export function createOrgsApi(client: ApiClient) {
  return {
    list(): Promise<Organization[]> {
      return client.get("/orgs");
    },
    create(body: OrganizationCreate): Promise<Organization> {
      return client.post("/orgs", body);
    },
    listMembers(orgId: Uuid): Promise<Member[]> {
      return client.get(`/orgs/${orgId}/members`);
    },
    invite(orgId: Uuid, body: MemberInvite): Promise<Member> {
      return client.post(`/orgs/${orgId}/members`, body);
    },
  };
}

export function createProjectsApi(client: ApiClient) {
  return {
    list(orgId?: Uuid): Promise<Project[]> {
      return client.get("/projects", { query: { org_id: orgId } });
    },
    get(projectId: Uuid): Promise<Project> {
      return client.get(`/projects/${projectId}`);
    },
    create(body: ProjectCreate): Promise<Project> {
      return client.post("/projects", body);
    },
    update(projectId: Uuid, body: ProjectUpdate): Promise<Project> {
      return client.patch(`/projects/${projectId}`, body);
    },
    remove(projectId: Uuid): Promise<void> {
      return client.delete<void>(`/projects/${projectId}`);
    },
  };
}

export type AuthApi = ReturnType<typeof createAuthApi>;
export type OrgsApi = ReturnType<typeof createOrgsApi>;
export type ProjectsApi = ReturnType<typeof createProjectsApi>;
