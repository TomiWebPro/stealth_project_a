import { describe, expect, it } from "vitest";

import { API_PREFIX } from "../types/common";
import type { Asset, Job, Project, Provider } from "./types";
import { createHttpApiClient } from "./httpApiClient";

interface FakeResponseInit {
  status?: number;
  headers?: Record<string, string>;
}

function jsonResponse(body: unknown, init: FakeResponseInit = {}): Response {
  const status = init.status ?? 200;
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    headers: {
      get: (name: string) => init.headers?.[name] ?? null,
    },
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

function router(
  routes: Record<string, unknown>,
  init: Record<string, FakeResponseInit> = {},
): { fetchImpl: typeof fetch; calls: string[] } {
  const calls: string[] = [];
  const fetchImpl = (async (input: string | URL | Request) => {
    const url = String(input);
    calls.push(url);
    const path = new URL(url, "http://local").pathname.replace(API_PREFIX, "");
    if (!(path in routes)) {
      return jsonResponse(
        { error: { code: "not_found", message: `No route ${path}` } },
        { status: 404 },
      );
    }
    return jsonResponse(routes[path], init[path]);
  }) as typeof fetch;
  return { fetchImpl, calls };
}

const project: Project = {
  id: "11111111-1111-4111-8111-111111111111",
  org_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  name: "Moonshot",
  description: "A short film",
  created_by: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  created_at: "2026-01-02T00:00:00Z",
  updated_at: "2026-01-03T00:00:00Z",
};

const archived: Project = {
  ...project,
  id: "22222222-2222-4222-8222-222222222222",
  name: "Archive 2025",
  archived: true,
};

function asset(id: string, name: string, createdAt: string, projectId = project.id): Asset {
  return {
    id,
    project_id: projectId,
    type: "image",
    name,
    creator_id: project.created_by,
    storage: { key: `Output/${name}`, size_bytes: 10, content_type: "image/png" },
    created_at: createdAt,
    updated_at: createdAt,
  };
}

const assets: Asset[] = [
  asset("a1", "old.png", "2026-01-01T00:00:00Z"),
  asset("a2", "new.png", "2026-01-04T00:00:00Z"),
];

const jobs: Job[] = [
  {
    id: "j1",
    project_id: project.id,
    operation_id: "dataset-prep",
    schema_version: "v1",
    status: "running",
    progress: 40,
    attempt: 1,
    created_by: project.created_by,
    created_at: "2026-01-05T00:00:00Z",
  },
  {
    id: "j2",
    project_id: project.id,
    operation_id: "lora-train",
    schema_version: "v1",
    status: "succeeded",
    attempt: 1,
    created_by: project.created_by,
    created_at: "2026-01-06T00:00:00Z",
  },
];

const providers: Provider[] = [
  {
    id: "local",
    name: "Local Runtime",
    location: "local",
    status: "available",
    capabilities: [{ operation_id: "text-to-image" }, { operation_id: "dataset-prep" }],
  },
];

describe("createHttpApiClient", () => {
  it("mounts all calls under the API prefix exactly once", async () => {
    const prefixed = router({ "/projects": [project] });
    const origin = router({ "/projects": [project] });

    await createHttpApiClient(`http://localhost:8000${API_PREFIX}`, {
      fetchImpl: prefixed.fetchImpl,
    }).listProjects();
    await createHttpApiClient("http://localhost:8000", {
      fetchImpl: origin.fetchImpl,
    }).listProjects();

    expect(prefixed.calls).toEqual([`http://localhost:8000${API_PREFIX}/projects`]);
    expect(origin.calls).toEqual([`http://localhost:8000${API_PREFIX}/projects`]);
  });

  it("assembles a home summary from the real routers", async () => {
    const fake = router({
      "/projects": [project, archived],
      "/assets": assets,
      "/jobs": jobs,
      "/providers": providers,
    });
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl: fake.fetchImpl });

    const summary = await api.getHomeSummary();

    expect(summary.projects).toHaveLength(1);
    expect(summary.projects[0]).toMatchObject({ id: project.id, assetCount: 2 });
    expect(summary.recentAssets.map((a) => a.id)).toEqual(["a2", "a1"]);
    expect(summary.activeJobs.map((j) => j.id)).toEqual(["j1"]);
    expect(summary.providers[0]).toMatchObject({
      operations: ["text-to-image", "dataset-prep"],
    });
  });

  it("degrades missing optional routers without failing the home summary", async () => {
    const fake = router({
      "/projects": [project],
      "/assets": assets,
      // no /jobs, no /providers -> 404
    });
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl: fake.fetchImpl });

    const summary = await api.getHomeSummary();

    expect(summary.projects).toHaveLength(1);
    expect(summary.activeJobs).toEqual([]);
    expect(summary.providers).toEqual([]);
  });

  it("joins project detail and resolves unknown ids to undefined", async () => {
    const fake = router({
      "/projects": [project],
      [`/projects/${project.id}`]: project,
      "/assets": assets,
      "/jobs": jobs,
    });
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl: fake.fetchImpl });

    const detail = await api.getProjectDetail(project.id);
    expect(detail?.project.id).toBe(project.id);
    expect(detail?.assets.map((a) => a.id)).toEqual(["a2", "a1"]);
    expect(detail?.jobs.map((j) => j.id)).toEqual(["j2", "j1"]);
    await expect(api.getProjectDetail("missing")).resolves.toBeUndefined();
    await expect(api.getAsset("missing")).resolves.toBeUndefined();
  });

  it("forwards job filters as query parameters", async () => {
    const fake = router({ "/jobs": jobs });
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl: fake.fetchImpl });

    await api.listJobs(project.id, "failed");

    const url = new URL(fake.calls[0] ?? "");
    expect(url.pathname).toBe(`${API_PREFIX}/jobs`);
    expect(url.searchParams.get("project_id")).toBe(project.id);
    expect(url.searchParams.get("status")).toBe("failed");
  });

  it("filters workflow templates by type/tag and sorts them by name", async () => {
    const templates = [
      { ...asset("t2", "z-template.json", "2026-01-01T00:00:00Z"), type: "resource" as const },
      { ...asset("t1", "a-template.json", "2026-01-02T00:00:00Z"), type: "resource" as const },
    ];
    const fake = router({ "/assets": templates });
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl: fake.fetchImpl });

    const result = await api.listWorkflowTemplates(project.id);

    expect(result.map((a) => a.name)).toEqual(["a-template.json", "z-template.json"]);
    const url = new URL(fake.calls[0] ?? "");
    expect(url.searchParams.get("type")).toBe("resource");
    expect(url.searchParams.get("tag")).toBe("template");
    expect(url.searchParams.get("project_id")).toBe(project.id);
  });

  it("normalizes backend error envelopes into ApiError", async () => {
    const body = {
      error: {
        code: "forbidden",
        message: "No access",
        details: [{ field: "org", message: "denied" }],
        request_id: "env-1",
      },
    };
    const fetchImpl = (async () => jsonResponse(body, {
      status: 403,
      headers: { "X-Request-ID": "req-1" },
    })) as typeof fetch;
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl });

    await expect(api.listProjects()).rejects.toMatchObject({
      name: "ApiError",
      status: 403,
      code: "forbidden",
      message: "No access",
      details: [{ field: "org", message: "denied" }],
      requestId: "env-1",
    });
  });

  it("wraps transport failures as a network_error ApiError", async () => {
    const fetchImpl = (async () => {
      throw new Error("offline");
    }) as typeof fetch;
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl });

    await expect(api.listProjects()).rejects.toMatchObject({
      status: 0,
      code: "network_error",
      message: "offline",
    });
  });

  it("injects the bearer token when one is available", async () => {
    const seen: RequestInit[] = [];
    const fetchImpl = (async (_url: string, init: RequestInit) => {
      seen.push(init);
      return jsonResponse([project]);
    }) as typeof fetch;
    const api = createHttpApiClient("http://localhost:8000", {
      fetchImpl,
      getAccessToken: () => "token-42",
    });

    await api.listProjects();

    expect((seen[0]?.headers as Record<string, string>)?.Authorization).toBe("Bearer token-42");
  });
});

describe("createHttpApiClient discovery and chat queries", () => {
  it("loads the operation catalog and capability rows", async () => {
    const catalog = { version: "v1", operations: [{ id: "dataset-prep", schema_version: "v1" }] };
    const flatRows = [
      {
        provider_id: "local",
        provider_name: "Local Runtime",
        location: "local",
        status: "available",
        operation_id: "dataset-prep",
        schema_versions: ["v1"],
      },
    ];
    const fake = router({ "/operations": catalog, "/capabilities": flatRows });
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl: fake.fetchImpl });

    await expect(api.getOperations()).resolves.toEqual(catalog);
    expect((await api.listCapabilities())[0]).toMatchObject({
      provider_id: "local",
      operation_id: "dataset-prep",
    });
    expect(await api.listCapabilities("lora-train")).toEqual([]);

    const url = new URL(fake.calls[1] ?? "");
    expect(url.pathname).toBe(`${API_PREFIX}/capabilities`);
  });

  it("accepts provider-shaped capability payloads and filters them", async () => {
    const fake = router({ "/capabilities": providers });
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl: fake.fetchImpl });

    const rows = await api.listCapabilities("text-to-image");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      provider_id: "local",
      provider_name: "Local Runtime",
      operation_id: "text-to-image",
    });
  });

  it("loads conversations and messages with correct ordering and filters", async () => {
    const conversation = {
      id: "c1",
      project_id: project.id,
      title: "Plan",
      created_by: project.created_by,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-02T00:00:00Z",
    };
    const messages = [
      {
        id: "m2",
        conversation_id: "c1",
        role: "assistant",
        content: "second",
        created_at: "2026-01-02T00:00:00Z",
      },
      {
        id: "m1",
        conversation_id: "c1",
        role: "user",
        content: "first",
        created_at: "2026-01-01T00:00:00Z",
      },
    ];
    const fake = router({
      "/conversations": [conversation],
      "/conversations/c1": conversation,
      "/conversations/c1/messages": messages,
    });
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl: fake.fetchImpl });

    expect((await api.listConversations(project.id)).map((c) => c.id)).toEqual(["c1"]);
    await expect(api.getConversation("c1")).resolves.toMatchObject({ id: "c1" });
    await expect(api.getConversation("missing")).resolves.toBeUndefined();
    expect((await api.listMessages("c1", 1)).map((m) => m.id)).toEqual(["m2"]);

    const conversationUrl = new URL(fake.calls[0] ?? "");
    expect(conversationUrl.searchParams.get("project_id")).toBe(project.id);
    const messageUrl = new URL(fake.calls[3] ?? "");
    expect(messageUrl.searchParams.get("limit")).toBe("1");
  });
});
