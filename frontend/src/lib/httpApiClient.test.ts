import { describe, expect, it } from "vitest";

import type { StreamEvent } from "../types";
import { API_PREFIX } from "../types/common";
import type { Asset, AuditTrail, Job, Project, Provider } from "./types";
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

describe("createHttpApiClient auth, orchestration and extension queries", () => {
  it("loads session, orgs, runs, presence, comments, storage and extensions", async () => {
    const run = {
      run_id: "r1",
      plan_id: "p1",
      stage: "await",
      job_ids: ["j1"],
      created_at: "2026-01-01T00:00:00Z",
    };
    const extension = {
      manifest: {
        id: "ext1",
        name: "Extension",
        version: "1.0.0",
        publisher: "Core",
        type: "capability",
        requirements: { app_versions: ">=0.1.0" },
      },
      status: "enabled",
    };
    const fake = router({
      "/auth/me": { id: "u1", email: "a@b.co", display_name: "A", created_at: "2026-01-01T00:00:00Z" },
      "/orgs": [{ id: "o1", name: "Org", slug: "org", created_at: "2026-01-01T00:00:00Z" }],
      "/orchestration/runs/r1": run,
      "/presence": [
        { user_id: "u1", project_id: project.id, state: "online", last_seen_at: "2026-01-01T00:00:00Z" },
      ],
      "/comments": [
        { id: "c1", project_id: project.id, author_id: "u1", body: "hi", created_at: "2026-01-01T00:00:00Z" },
      ],
      "/storage/stats": {
        project_id: project.id,
        quota: { used: 1, limit: 2, unit: "bytes" },
        object_count: 3,
      },
      "/extensions": [extension],
      "/extensions/ext1": extension,
    });
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl: fake.fetchImpl });

    expect((await api.getCurrentUser()).id).toBe("u1");
    expect((await api.listOrganizations())[0]).toMatchObject({ id: "o1" });
    await expect(api.getOrchestrationRun("r1")).resolves.toMatchObject({ run_id: "r1" });
    await expect(api.getOrchestrationRun("missing")).resolves.toBeUndefined();
    expect((await api.listPresence(project.id)).length).toBe(1);
    expect((await api.listComments(project.id, "a1")).length).toBe(1);
    expect((await api.getStorageStats(project.id)).quota.limit).toBe(2);
    expect((await api.listExtensions())[0]).toMatchObject({ status: "enabled" });
    await expect(api.getExtension("ext1")).resolves.toMatchObject({ status: "enabled" });
    await expect(api.getExtension("missing")).resolves.toBeUndefined();

    const commentCall = fake.calls.find((call) => call.includes("/comments"));
    expect(commentCall).toBeDefined();
    const commentUrl = new URL(commentCall ?? "");
    expect(commentUrl.searchParams.get("asset_id")).toBe("a1");
  });
});

describe("createHttpApiClient chat writes and streams", () => {
  it("POSTs a message and normalizes a failed write into ApiError", async () => {
    const created = {
      id: "m3",
      conversation_id: "c1",
      role: "user",
      content: "hi",
      status: "complete",
      created_at: "2026-01-07T00:00:00Z",
    };
    const seen: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
      seen.push({ url: String(input), init });
      return jsonResponse(created, { status: 201 });
    }) as typeof fetch;
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl });

    await expect(
      api.sendMessage("c1", { content: "hi", operation_id: "text-to-image" }),
    ).resolves.toMatchObject({ id: "m3" });

    expect(seen[0]?.init?.method).toBe("POST");
    expect(JSON.parse(String(seen[0]?.init?.body))).toEqual({
      content: "hi",
      operation_id: "text-to-image",
    });
    expect(new URL(seen[0]?.url ?? "").pathname).toBe(
      `${API_PREFIX}/conversations/c1/messages`,
    );

    const failing = createHttpApiClient("http://localhost:8000", {
      fetchImpl: (async () =>
        jsonResponse({ error: { code: "conflict", message: "nope" } }, { status: 409 })) as typeof fetch,
    });
    await expect(failing.sendMessage("c1", { content: "hi" })).rejects.toMatchObject({
      status: 409,
      code: "conflict",
      message: "nope",
    });
  });

  it("opens a resumable stream, parses typed frames and closes cleanly", () => {
    const listeners = new Map<string, Array<(event: { data?: unknown }) => void>>();
    let openedUrl = "";
    let closeCount = 0;
    const webSocketImpl = (url: string) => {
      openedUrl = url;
      return {
        addEventListener(type: string, listener: (event: { data?: unknown }) => void) {
          listeners.set(type, [...(listeners.get(type) ?? []), listener]);
        },
        removeEventListener(type: string, listener: (event: { data?: unknown }) => void) {
          listeners.set(type, (listeners.get(type) ?? []).filter((candidate) => candidate !== listener));
        },
        close() {
          closeCount += 1;
        },
      };
    };
    const api = createHttpApiClient("http://localhost:8000", {
      fetchImpl: router({}).fetchImpl,
      webSocketImpl,
    });

    const received: StreamEvent[] = [];
    const stream = api.openConversationStream("conv 1", 5);
    const unsubscribe = stream.onEvent((event) => received.push(event));
    const emit = (data: string) => {
      for (const listener of listeners.get("message") ?? []) listener({ data });
    };

    emit(
      JSON.stringify({
        type: "delta",
        message_id: "m1",
        seq: 6,
        delta: "hi",
      }),
    );
    emit("not json");

    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({ type: "delta", seq: 6, delta: "hi" });
    expect(openedUrl).toBe(
      `ws://localhost:8000${API_PREFIX}/conversations/conv%201/stream?since=5`,
    );

    unsubscribe();
    stream.close();
    expect(closeCount).toBe(1);
    expect(listeners.get("message")).toHaveLength(0);
  });
});

describe("createHttpApiClient asset writes", () => {
  it("PATCHes an asset patch with a JSON body and returns the updated asset", async () => {
    const updated = { ...assets[0], name: "Renamed frame", tags: ["reviewed"] };
    const seen: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
      seen.push({ url: String(input), init });
      return jsonResponse(updated);
    }) as typeof fetch;
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl });

    await expect(
      api.updateAsset("a1", { name: "Renamed frame", tags: ["reviewed"] }),
    ).resolves.toMatchObject({ id: "a1", name: "Renamed frame", tags: ["reviewed"] });

    expect(seen[0]?.init?.method).toBe("PATCH");
    expect(JSON.parse(String(seen[0]?.init?.body))).toEqual({
      name: "Renamed frame",
      tags: ["reviewed"],
    });
    expect(new URL(seen[0]?.url ?? "").pathname).toBe(`${API_PREFIX}/assets/a1`);
  });

  it("normalizes a failed PATCH into an ApiError", async () => {
    const failing = createHttpApiClient("http://localhost:8000", {
      fetchImpl: (async () =>
        jsonResponse(
          { error: { code: "invalid_request", message: "name cannot be null" } },
          { status: 400 },
        )) as typeof fetch,
    });

    await expect(failing.updateAsset("a1", { name: null })).rejects.toMatchObject({
      status: 400,
      code: "invalid_request",
      message: "name cannot be null",
    });
  });
});

describe("createHttpApiClient project audit", () => {
  const trail: AuditTrail = {
    project_id: project.id,
    events: [
      {
        id: "job-j1",
        kind: "job",
        label: "dataset-prep · running",
        detail: "Attempt 1",
        timestamp: "2026-01-05T00:00:00Z",
        tone: "info",
      },
    ],
  };

  it("GETs the audit path with filters and returns the trail", async () => {
    const { fetchImpl, calls } = router({
      [`/projects/${project.id}/audit`]: trail,
    });
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl });

    await expect(
      api.getProjectAudit(project.id, { kind: "job", limit: 5 }),
    ).resolves.toEqual(trail);

    const url = new URL(calls[0] ?? "");
    expect(url.pathname).toBe(`${API_PREFIX}/projects/${project.id}/audit`);
    expect(url.searchParams.get("kind")).toBe("job");
    expect(url.searchParams.get("limit")).toBe("5");
  });

  it("maps a 404 to undefined but surfaces other failures", async () => {
    const missing = createHttpApiClient("http://localhost:8000", {
      fetchImpl: (async () =>
        jsonResponse({ error: { code: "not_found", message: "missing" } }, {
          status: 404,
        })) as typeof fetch,
    });
    await expect(missing.getProjectAudit(project.id)).resolves.toBeUndefined();

    const failing = createHttpApiClient("http://localhost:8000", {
      fetchImpl: (async () =>
        jsonResponse({ error: { code: "internal_error", message: "boom" } }, {
          status: 500,
        })) as typeof fetch,
    });
    await expect(failing.getProjectAudit(project.id)).rejects.toMatchObject({
      status: 500,
      code: "internal_error",
    });
  });
});

describe("createHttpApiClient asset overview (C205)", () => {
  const root = asset("a1", "frame", "2026-01-05T00:00:00Z");
  const overview = {
    asset_id: root.id,
    asset_name: root.name,
    asset_type: root.type,
    status: "ready",
    version: 2,
    project_id: root.project_id,
    project_name: project.name,
    created_at: root.created_at,
    published: true,
    counts: { versions: 2, upstream: 1, downstream: 3, comments: 4, tags: 5 },
    recent_versions: [
      {
        asset_id: root.id,
        version: 2,
        storage: root.storage,
        created_at: "2026-01-06T00:00:00Z",
        created_by: root.creator_id,
      },
    ],
    generated_at: "2026-01-07T00:00:00Z",
  };

  it("GETs the asset overview path with the recent limit and forwards the snapshot", async () => {
    const { fetchImpl, calls } = router({
      [`/assets/${root.id}/overview`]: overview,
    });
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl });

    await expect(api.getAssetOverview(root.id, { recentLimit: 3 })).resolves.toEqual(overview);

    const url = new URL(calls[0] ?? "");
    expect(url.pathname).toBe(`${API_PREFIX}/assets/${root.id}/overview`);
    expect(url.searchParams.get("recent_limit")).toBe("3");
  });

  it("omits the query string when no recent limit is supplied", async () => {
    const { fetchImpl, calls } = router({
      [`/assets/${root.id}/overview`]: overview,
    });
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl });
    await expect(api.getAssetOverview(root.id)).resolves.toEqual(overview);
    expect(new URL(calls[0] ?? "").search).toBe("");
  });

  it("maps a 404 to undefined but surfaces validation and other failures", async () => {
    const missing = createHttpApiClient("http://localhost:8000", {
      fetchImpl: (async () =>
        jsonResponse({ error: { code: "not_found", message: "missing" } }, {
          status: 404,
        })) as typeof fetch,
    });
    await expect(missing.getAssetOverview(root.id)).resolves.toBeUndefined();

    const invalid = createHttpApiClient("http://localhost:8000", {
      fetchImpl: (async () =>
        jsonResponse(
          {
            error: {
              code: "validation_error",
              message: "Invalid asset id.",
              details: [{ field: "asset_id", message: "must be a UUID" }],
            },
          },
          { status: 422 },
        )) as typeof fetch,
    });
    await expect(invalid.getAssetOverview("bad")).rejects.toMatchObject({
      status: 422,
      code: "validation_error",
    });

    const failing = createHttpApiClient("http://localhost:8000", {
      fetchImpl: (async () =>
        jsonResponse({ error: { code: "internal_error", message: "boom" } }, {
          status: 500,
        })) as typeof fetch,
    });
    await expect(failing.getAssetOverview(root.id)).rejects.toMatchObject({
      status: 500,
      code: "internal_error",
    });
  });
});

describe("createHttpApiClient conversation overview (C209)", () => {
  const conversationId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  const overview = {
    conversation_id: conversationId,
    project_id: project.id,
    project_name: project.name,
    title: "Shot review",
    created_by: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    created_at: "2026-01-02T00:00:00Z",
    updated_at: "2026-01-03T00:00:00Z",
    message_count: 2,
    last_message_role: "assistant",
    last_message_excerpt: "Looks good",
    counts: {
      total: 2,
      by_role: [
        { role: "system", count: 0 },
        { role: "user", count: 1 },
        { role: "assistant", count: 1 },
        { role: "tool", count: 0 },
      ],
      by_status: [
        { status: "pending", count: 0 },
        { status: "streaming", count: 0 },
        { status: "complete", count: 2 },
        { status: "error", count: 0 },
      ],
    },
    recent_messages: [],
    generated_at: "2026-01-04T00:00:00Z",
  };

  it("GETs the conversation overview path with the recent limit and forwards the snapshot", async () => {
    const { fetchImpl, calls } = router({
      [`/conversations/${conversationId}/overview`]: overview,
    });
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl });

    await expect(api.getConversationOverview(conversationId, { recentLimit: 3 })).resolves.toEqual(
      overview,
    );

    const url = new URL(calls[0] ?? "");
    expect(url.pathname).toBe(`${API_PREFIX}/conversations/${conversationId}/overview`);
    expect(url.searchParams.get("recent_limit")).toBe("3");
  });

  it("omits the query string when no recent limit is supplied", async () => {
    const { fetchImpl, calls } = router({
      [`/conversations/${conversationId}/overview`]: overview,
    });
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl });
    await expect(api.getConversationOverview(conversationId)).resolves.toEqual(overview);
    expect(new URL(calls[0] ?? "").search).toBe("");
  });

  it("maps a 404 to undefined but surfaces validation and other failures", async () => {
    const missing = createHttpApiClient("http://localhost:8000", {
      fetchImpl: (async () =>
        jsonResponse({ error: { code: "not_found", message: "missing" } }, {
          status: 404,
        })) as typeof fetch,
    });
    await expect(missing.getConversationOverview(conversationId)).resolves.toBeUndefined();

    const invalid = createHttpApiClient("http://localhost:8000", {
      fetchImpl: (async () =>
        jsonResponse(
          {
            error: {
              code: "validation_error",
              message: "Invalid conversation id.",
              details: [{ field: "conversation_id", message: "must be a UUID" }],
            },
          },
          { status: 422 },
        )) as typeof fetch,
    });
    await expect(invalid.getConversationOverview("bad")).rejects.toMatchObject({
      status: 422,
      code: "validation_error",
    });

    const failing = createHttpApiClient("http://localhost:8000", {
      fetchImpl: (async () =>
        jsonResponse({ error: { code: "internal_error", message: "boom" } }, {
          status: 500,
        })) as typeof fetch,
    });
    await expect(failing.getConversationOverview(conversationId)).rejects.toMatchObject({
      status: 500,
      code: "internal_error",
    });
  });
});

describe("createHttpApiClient job overview (C213)", () => {
  const jobId = "0b5c1e2a-3000-4000-8000-000000000001";
  const overview = {
    job_id: jobId,
    project_id: "0b5c1e2a-1000-4000-8000-000000000001",
    project_name: "Moonshot",
    operation_id: "dataset-prep",
    schema_version: "1.0",
    status: "running",
    progress: 0.4,
    attempt: 1,
    created_by: "0b5c1e2a-0000-4000-8000-0000000000aa",
    created_at: "2026-01-01T00:00:00.000Z",
    started_at: null,
    finished_at: null,
    result: null,
    error: null,
    counts: {
      events: 2,
      retries: 1,
      by_event_type: [
        { type: "status", count: 1 },
        { type: "progress", count: 1 },
        { type: "intermediate", count: 0 },
        { type: "result", count: 0 },
        { type: "error", count: 0 },
        { type: "log", count: 0 },
      ],
    },
    recent_events: [],
    generated_at: "2026-01-04T00:00:00Z",
  };

  it("GETs the job overview path with the recent limit and forwards the snapshot", async () => {
    const { fetchImpl, calls } = router({
      [`/jobs/${jobId}/overview`]: overview,
    });
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl });

    await expect(api.getJobOverview(jobId, { recentLimit: 3 })).resolves.toEqual(overview);

    const url = new URL(calls[0] ?? "");
    expect(url.pathname).toBe(`${API_PREFIX}/jobs/${jobId}/overview`);
    expect(url.searchParams.get("recent_limit")).toBe("3");
  });

  it("omits the query string when no recent limit is supplied", async () => {
    const { fetchImpl, calls } = router({
      [`/jobs/${jobId}/overview`]: overview,
    });
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl });
    await expect(api.getJobOverview(jobId)).resolves.toEqual(overview);
    expect(new URL(calls[0] ?? "").search).toBe("");
  });

  it("maps a 404 to undefined but surfaces validation and other failures", async () => {
    const missing = createHttpApiClient("http://localhost:8000", {
      fetchImpl: (async () =>
        jsonResponse({ error: { code: "job_not_found", message: "missing" } }, {
          status: 404,
        })) as typeof fetch,
    });
    await expect(missing.getJobOverview(jobId)).resolves.toBeUndefined();

    const invalid = createHttpApiClient("http://localhost:8000", {
      fetchImpl: (async () =>
        jsonResponse(
          {
            error: {
              code: "validation_error",
              message: "Invalid job id.",
              details: [{ field: "job_id", message: "must be a UUID" }],
            },
          },
          { status: 422 },
        )) as typeof fetch,
    });
    await expect(invalid.getJobOverview("bad")).rejects.toMatchObject({
      status: 422,
      code: "validation_error",
    });

    const failing = createHttpApiClient("http://localhost:8000", {
      fetchImpl: (async () =>
        jsonResponse({ error: { code: "internal_error", message: "boom" } }, {
          status: 500,
        })) as typeof fetch,
    });
    await expect(failing.getJobOverview(jobId)).rejects.toMatchObject({
      status: 500,
      code: "internal_error",
    });
  });
});

describe("createHttpApiClient provider overview (C217)", () => {
  const providerId = "prov_local";
  const overview = {
    provider_id: providerId,
    name: "Local Runtime",
    location: "local",
    status: "available",
    metadata: {},
    operation_ids: ["image-to-image", "text-to-image", "upscale"],
    catalog_operations: [
      {
        operation_id: "image-to-image",
        title: "Image to image",
        catalog_version: "v1",
        advertised_versions: ["v1"],
        schema_match: true,
      },
    ],
    counts: {
      capabilities: 3,
      advertised_operations: 3,
      catalog_operations: 3,
      schema_versions: 1,
    },
    generated_at: "2026-01-04T00:00:00Z",
  };

  it("GETs the provider overview path and forwards the snapshot", async () => {
    const { fetchImpl, calls } = router({
      [`/providers/${providerId}/overview`]: overview,
    });
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl });

    await expect(api.getProviderOverview(providerId)).resolves.toEqual(overview);

    const url = new URL(calls[0] ?? "");
    expect(url.pathname).toBe(`${API_PREFIX}/providers/${providerId}/overview`);
    expect(url.search).toBe("");
  });

  it("maps a 404 to undefined but surfaces other failures", async () => {
    const missing = createHttpApiClient("http://localhost:8000", {
      fetchImpl: (async () =>
        jsonResponse({ error: { code: "provider_not_found", message: "missing" } }, {
          status: 404,
        })) as typeof fetch,
    });
    await expect(missing.getProviderOverview(providerId)).resolves.toBeUndefined();

    const failing = createHttpApiClient("http://localhost:8000", {
      fetchImpl: (async () =>
        jsonResponse({ error: { code: "internal_error", message: "boom" } }, {
          status: 500,
        })) as typeof fetch,
    });
    await expect(failing.getProviderOverview(providerId)).rejects.toMatchObject({
      status: 500,
      code: "internal_error",
    });
  });
});

describe("createHttpApiClient operation overview (C230)", () => {
  const operationId = "text-to-image";
  const overview = {
    operation_id: operationId,
    title: "Text to image",
    description: "Generate a frame.",
    schema_version: "v1",
    input_types: [],
    output_types: ["image"],
    setting_keys: ["width"],
    streaming: false,
    provider_ids: ["prov_local"],
    provider_bindings: [
      {
        provider_id: "prov_local",
        name: "Local Runtime",
        location: "local",
        status: "available",
        advertised_versions: ["v1"],
        schema_match: true,
      },
    ],
    counts: {
      settings: 1,
      input_types: 0,
      output_types: 1,
      provider_bindings: 1,
      matching_providers: 1,
    },
    generated_at: "2026-01-04T00:00:00Z",
  };

  it("GETs the operation overview path and forwards the snapshot", async () => {
    const { fetchImpl, calls } = router({
      [`/operations/${operationId}/overview`]: overview,
    });
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl });

    await expect(api.getOperationOverview(operationId)).resolves.toEqual(overview);

    const url = new URL(calls[0] ?? "");
    expect(url.pathname).toBe(`${API_PREFIX}/operations/${operationId}/overview`);
    expect(url.search).toBe("");
  });

  it("maps a 404 to undefined but surfaces other failures", async () => {
    const missing = createHttpApiClient("http://localhost:8000", {
      fetchImpl: (async () =>
        jsonResponse({ error: { code: "operation_not_found", message: "missing" } }, {
          status: 404,
        })) as typeof fetch,
    });
    await expect(missing.getOperationOverview(operationId)).resolves.toBeUndefined();

    const failing = createHttpApiClient("http://localhost:8000", {
      fetchImpl: (async () =>
        jsonResponse({ error: { code: "internal_error", message: "boom" } }, {
          status: 500,
        })) as typeof fetch,
    });
    await expect(failing.getOperationOverview(operationId)).rejects.toMatchObject({
      status: 500,
      code: "internal_error",
    });
  });
});

describe("createHttpApiClient chain overview (C234)", () => {
  const chainId = "0b5c1e2a-4000-4000-8000-000000000001";
  const overview = {
    chain_id: chainId,
    project_id: "0b5c1e2a-1000-4000-8000-000000000001",
    project_name: "Moonshot",
    kind: "training",
    created_by: "0b5c1e2a-0000-4000-8000-0000000000aa",
    created_at: "2026-01-01T00:00:00.000Z",
    counts: { jobs: 2, assets: 3 },
    recent_jobs: [],
    recent_assets: [],
    generated_at: "2026-01-04T00:00:00Z",
  };

  it("GETs the chain overview path and forwards recent_limit", async () => {
    const { fetchImpl, calls } = router({
      [`/pipelines/${chainId}/overview`]: overview,
    });
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl });

    await expect(api.getChainOverview(chainId, { recentLimit: 2 })).resolves.toEqual(overview);

    const url = new URL(calls[0] ?? "");
    expect(url.pathname).toBe(`${API_PREFIX}/pipelines/${chainId}/overview`);
    expect(url.searchParams.get("recent_limit")).toBe("2");
  });

  it("maps a 404 to undefined but surfaces other failures", async () => {
    const missing = createHttpApiClient("http://localhost:8000", {
      fetchImpl: (async () =>
        jsonResponse({ error: { code: "chain_not_found", message: "missing" } }, {
          status: 404,
        })) as typeof fetch,
    });
    await expect(missing.getChainOverview(chainId)).resolves.toBeUndefined();

    const failing = createHttpApiClient("http://localhost:8000", {
      fetchImpl: (async () =>
        jsonResponse({ error: { code: "internal_error", message: "boom" } }, {
          status: 500,
        })) as typeof fetch,
    });
    await expect(failing.getChainOverview(chainId)).rejects.toMatchObject({
      status: 500,
      code: "internal_error",
    });
  });
});

describe("createHttpApiClient plan overview (C238)", () => {
  const planId = "0b5c1e2a-6100-4000-8000-000000000001";
  const overview = {
    plan_id: planId,
    project_id: "0b5c1e2a-1000-4000-8000-000000000001",
    project_name: "Moonshot",
    goal: "Generate the s01_c01 shot video.",
    created_at: "2026-01-01T00:00:00.000Z",
    counts: { steps: 3, runs: 1, jobs_linked: 2 },
    by_stage: [
      { stage: "plan", count: 0 },
      { stage: "resolve", count: 0 },
      { stage: "submit", count: 0 },
      { stage: "await", count: 1 },
      { stage: "collect", count: 0 },
      { stage: "done", count: 0 },
    ],
    recent_runs: [],
    generated_at: "2026-01-04T00:00:00Z",
  };

  it("GETs the plan overview path and forwards recent_limit", async () => {
    const { fetchImpl, calls } = router({
      [`/orchestration/plans/${planId}/overview`]: overview,
    });
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl });

    await expect(api.getPlanOverview(planId, { recentLimit: 2 })).resolves.toEqual(overview);

    const url = new URL(calls[0] ?? "");
    expect(url.pathname).toBe(`${API_PREFIX}/orchestration/plans/${planId}/overview`);
    expect(url.searchParams.get("recent_limit")).toBe("2");
  });

  it("maps a 404 to undefined but surfaces other failures", async () => {
    const missing = createHttpApiClient("http://localhost:8000", {
      fetchImpl: (async () =>
        jsonResponse({ error: { code: "plan_not_found", message: "missing" } }, {
          status: 404,
        })) as typeof fetch,
    });
    await expect(missing.getPlanOverview(planId)).resolves.toBeUndefined();

    const failing = createHttpApiClient("http://localhost:8000", {
      fetchImpl: (async () =>
        jsonResponse({ error: { code: "internal_error", message: "boom" } }, {
          status: 500,
        })) as typeof fetch,
    });
    await expect(failing.getPlanOverview(planId)).rejects.toMatchObject({
      status: 500,
      code: "internal_error",
    });
  });
});

describe("createHttpApiClient run overview (C242)", () => {
  const runId = "0b5c1e2a-6000-4000-8000-000000000001";
  const overview = {
    run_id: runId,
    plan_id: "0b5c1e2a-6100-4000-8000-000000000001",
    project_id: "0b5c1e2a-1000-4000-8000-000000000001",
    project_name: "Moonshot",
    plan_goal: "Generate the s01_c01 shot video.",
    stage: "await",
    created_at: "2026-01-02T00:00:00.000Z",
    counts: { jobs_linked: 2, jobs_resolved: 2, plan_steps: 3 },
    by_status: [
      { status: "queued", count: 0 },
      { status: "running", count: 2 },
      { status: "succeeded", count: 0 },
      { status: "failed", count: 0 },
      { status: "canceled", count: 0 },
    ],
    recent_jobs: [],
    generated_at: "2026-01-04T00:00:00Z",
  };

  it("GETs the run overview path and forwards recent_limit", async () => {
    const { fetchImpl, calls } = router({
      [`/orchestration/runs/${runId}/overview`]: overview,
    });
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl });

    await expect(api.getRunOverview(runId, { recentLimit: 2 })).resolves.toEqual(overview);

    const url = new URL(calls[0] ?? "");
    expect(url.pathname).toBe(`${API_PREFIX}/orchestration/runs/${runId}/overview`);
    expect(url.searchParams.get("recent_limit")).toBe("2");
  });

  it("maps a 404 to undefined but surfaces other failures", async () => {
    const missing = createHttpApiClient("http://localhost:8000", {
      fetchImpl: (async () =>
        jsonResponse({ error: { code: "run_not_found", message: "missing" } }, {
          status: 404,
        })) as typeof fetch,
    });
    await expect(missing.getRunOverview(runId)).resolves.toBeUndefined();

    const failing = createHttpApiClient("http://localhost:8000", {
      fetchImpl: (async () =>
        jsonResponse({ error: { code: "internal_error", message: "boom" } }, {
          status: 500,
        })) as typeof fetch,
    });
    await expect(failing.getRunOverview(runId)).rejects.toMatchObject({
      status: 500,
      code: "internal_error",
    });
  });
});

describe("createHttpApiClient upload overview (C246)", () => {
  const uploadId = "0b5c1e2a-7000-4000-8000-000000000001";
  const overview = {
    upload_id: uploadId,
    project_id: "0b5c1e2a-1000-4000-8000-000000000001",
    project_name: "Moonshot",
    filename: "concept_sheet.png",
    content_type: "image/png",
    status: "complete",
    declared_size: 1_200_000,
    size_bytes: 1_200_000,
    bytes_remaining: 0,
    progress: 1,
    expired: false,
    created_at: "2026-03-17T10:30:00.000Z",
    expires_at: "2026-03-19T10:30:00.000Z",
    counts: { project_tickets: 4, project_completed: 2, project_bytes_uploaded: 4_600_000 },
    generated_at: "2026-03-18T10:30:00.000Z",
  };

  it("GETs the upload overview path", async () => {
    const { fetchImpl, calls } = router({ [`/uploads/${uploadId}/overview`]: overview });
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl });

    await expect(api.getUploadOverview(uploadId)).resolves.toEqual(overview);

    const url = new URL(calls[0] ?? "");
    expect(url.pathname).toBe(`${API_PREFIX}/uploads/${uploadId}/overview`);
  });

  it("maps a 404 to undefined but surfaces other failures", async () => {
    const missing = createHttpApiClient("http://localhost:8000", {
      fetchImpl: (async () =>
        jsonResponse({ error: { code: "upload_not_found", message: "missing" } }, {
          status: 404,
        })) as typeof fetch,
    });
    await expect(missing.getUploadOverview(uploadId)).resolves.toBeUndefined();

    const failing = createHttpApiClient("http://localhost:8000", {
      fetchImpl: (async () =>
        jsonResponse({ error: { code: "internal_error", message: "boom" } }, {
          status: 500,
        })) as typeof fetch,
    });
    await expect(failing.getUploadOverview(uploadId)).rejects.toMatchObject({
      status: 500,
      code: "internal_error",
    });
  });
});

describe("createHttpApiClient comment overview (C254)", () => {
  const commentId = "0b5c1e2a-6200-4000-8000-000000000001";
  const overview = {
    comment_id: commentId,
    project_id: "0b5c1e2a-1000-4000-8000-000000000001",
    project_name: "Moonshot",
    asset_id: "0b5c1e2a-2000-4000-8000-000000000011",
    author_id: "0b5c1e2a-0000-4000-8000-0000000000aa",
    body: "Lock the character silhouette before we expand the dataset.",
    created_at: "2026-03-17T10:30:00.000Z",
    reference: "asset",
    counts: {
      project_comments: 3,
      project_authors: 2,
      project_assets: 1,
      thread_comments: 2,
    },
    recent_comments: [],
    generated_at: "2026-03-18T10:30:00.000Z",
  };

  it("GETs the comment overview path with the recent_limit query", async () => {
    const { fetchImpl, calls } = router({ [`/comments/${commentId}/overview`]: overview });
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl });

    await expect(api.getCommentOverview(commentId, { recentLimit: 2 })).resolves.toEqual(overview);

    const url = new URL(calls[0] ?? "");
    expect(url.pathname).toBe(`${API_PREFIX}/comments/${commentId}/overview`);
    expect(url.searchParams.get("recent_limit")).toBe("2");
  });

  it("maps a 404 to undefined but surfaces other failures", async () => {
    const missing = createHttpApiClient("http://localhost:8000", {
      fetchImpl: (async () =>
        jsonResponse({ error: { code: "comment_not_found", message: "missing" } }, {
          status: 404,
        })) as typeof fetch,
    });
    await expect(missing.getCommentOverview(commentId)).resolves.toBeUndefined();

    const failing = createHttpApiClient("http://localhost:8000", {
      fetchImpl: (async () =>
        jsonResponse({ error: { code: "internal_error", message: "boom" } }, {
          status: 500,
        })) as typeof fetch,
    });
    await expect(failing.getCommentOverview(commentId)).rejects.toMatchObject({
      status: 500,
      code: "internal_error",
    });
  });
});

describe("createHttpApiClient lineage overview (C258)", () => {
  const relationshipId = "0b5c1e2a-5000-4000-8000-000000000001";
  const overview = {
    id: relationshipId,
    from_asset_id: "0b5c1e2a-2000-4000-8000-000000000012",
    to_asset_id: "0b5c1e2a-2000-4000-8000-000000000011",
    from_asset_name: "Source frame",
    to_asset_name: "Concept frame",
    from_asset_type: "image",
    to_asset_type: "image",
    project_id: "0b5c1e2a-1000-4000-8000-000000000001",
    project_name: "Moonshot",
    type: "derived_from",
    created_at: "2026-03-18T10:00:00.000Z",
    counts: {
      source_upstream: 0,
      source_downstream: 1,
      source_types: 1,
      project_relationships: 1,
    },
    recent_relationships: [],
    generated_at: "2026-03-18T10:30:00.000Z",
  };

  it("GETs the lineage overview path with the recent_limit query", async () => {
    const { fetchImpl, calls } = router({ [`/lineage/${relationshipId}/overview`]: overview });
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl });

    await expect(api.getLineageOverview(relationshipId, { recentLimit: 2 })).resolves.toEqual(
      overview,
    );

    const url = new URL(calls[0] ?? "");
    expect(url.pathname).toBe(`${API_PREFIX}/lineage/${relationshipId}/overview`);
    expect(url.searchParams.get("recent_limit")).toBe("2");
  });

  it("maps a 404 to undefined but surfaces other failures", async () => {
    const missing = createHttpApiClient("http://localhost:8000", {
      fetchImpl: (async () =>
        jsonResponse({ error: { code: "relationship_not_found", message: "missing" } }, {
          status: 404,
        })) as typeof fetch,
    });
    await expect(missing.getLineageOverview(relationshipId)).resolves.toBeUndefined();

    const failing = createHttpApiClient("http://localhost:8000", {
      fetchImpl: (async () =>
        jsonResponse({ error: { code: "internal_error", message: "boom" } }, {
          status: 500,
        })) as typeof fetch,
    });
    await expect(failing.getLineageOverview(relationshipId)).rejects.toMatchObject({
      status: 500,
      code: "internal_error",
    });
  });
});

describe("createHttpApiClient version overview (C250)", () => {
  const assetId = "0b5c1e2a-2000-4000-8000-000000000001";
  const overview = {
    asset_id: assetId,
    asset_name: "concept_frame",
    asset_type: "image",
    project_id: "0b5c1e2a-1000-4000-8000-000000000001",
    project_name: "Moonshot",
    version: 2,
    storage: { key: "Publish/concept.png", size_bytes: 1000, content_type: "image/png" },
    created_by: "0b5c1e2a-0000-4000-8000-0000000000aa",
    created_at: "2026-03-17T10:30:00.000Z",
    is_latest: true,
    counts: { asset_versions: 2, revisions: 1 },
    recent_versions: [],
    generated_at: "2026-03-18T10:30:00.000Z",
  };

  it("GETs the version overview path with the recent_limit query", async () => {
    const { fetchImpl, calls } = router({
      [`/assets/${assetId}/versions/2/overview`]: overview,
    });
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl });

    await expect(api.getVersionOverview(assetId, 2, { recentLimit: 1 })).resolves.toEqual(overview);

    const url = new URL(calls[0] ?? "");
    expect(url.pathname).toBe(`${API_PREFIX}/assets/${assetId}/versions/2/overview`);
    expect(url.searchParams.get("recent_limit")).toBe("1");
  });

  it("maps both 404s to undefined but surfaces other failures", async () => {
    const missing = createHttpApiClient("http://localhost:8000", {
      fetchImpl: (async () =>
        jsonResponse({ error: { code: "version_not_found", message: "missing" } }, {
          status: 404,
        })) as typeof fetch,
    });
    await expect(missing.getVersionOverview(assetId, 9)).resolves.toBeUndefined();

    const failing = createHttpApiClient("http://localhost:8000", {
      fetchImpl: (async () =>
        jsonResponse({ error: { code: "internal_error", message: "boom" } }, {
          status: 500,
        })) as typeof fetch,
    });
    await expect(failing.getVersionOverview(assetId, 2)).rejects.toMatchObject({
      status: 500,
      code: "internal_error",
    });
  });
});

describe("createHttpApiClient extension overview (C222)", () => {
  const extensionId = "0f1f2a3b-4c5d-5e6f-8a9b-0c1d2e3f4a5b";
  const overview = {
    extension_id: extensionId,
    manifest_id: "comfyui-local-adapter",
    name: "Local ComfyUI adapter",
    version: "1.2.0",
    publisher: "Studio Core",
    type: "provider",
    status: "enabled",
    installed_at: "2026-01-01T00:00:00Z",
    runtime: null,
    app_versions: ">=0.1.0",
    signed: true,
    verified: true,
    permissions: ["runtime.local"],
    capabilities: ["image-to-image", "text-to-image"],
    provider_ids: ["prov_comfy"],
    ui_contributions: [],
    dependencies: [],
    counts: {
      permissions: 1,
      capabilities: 2,
      provider_ids: 1,
      ui_contributions: 0,
      dependencies: 0,
    },
    generated_at: "2026-01-04T00:00:00Z",
  };

  it("GETs the extension overview path and forwards the snapshot", async () => {
    const { fetchImpl, calls } = router({
      [`/extensions/${extensionId}/overview`]: overview,
    });
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl });

    await expect(api.getExtensionOverview(extensionId)).resolves.toEqual(overview);

    const url = new URL(calls[0] ?? "");
    expect(url.pathname).toBe(`${API_PREFIX}/extensions/${extensionId}/overview`);
    expect(url.search).toBe("");
  });

  it("maps a 404 to undefined but surfaces other failures", async () => {
    const missing = createHttpApiClient("http://localhost:8000", {
      fetchImpl: (async () =>
        jsonResponse({ error: { code: "extension_not_found", message: "missing" } }, {
          status: 404,
        })) as typeof fetch,
    });
    await expect(missing.getExtensionOverview(extensionId)).resolves.toBeUndefined();

    const failing = createHttpApiClient("http://localhost:8000", {
      fetchImpl: (async () =>
        jsonResponse({ error: { code: "internal_error", message: "boom" } }, {
          status: 500,
        })) as typeof fetch,
    });
    await expect(failing.getExtensionOverview(extensionId)).rejects.toMatchObject({
      status: 500,
      code: "internal_error",
    });
  });
});

describe("createHttpApiClient project overview (C201)", () => {
  const overview = {
    project_id: project.id,
    project_name: project.name,
    lifecycle: "active",
    created_at: project.created_at,
    counts: {
      assets: 1,
      conversations: 2,
      jobs: 3,
      comments: 4,
      publishes: 5,
      versions: 6,
      collaborators: 7,
    },
    recent_jobs: jobs,
    recent_assets: [asset("a1", "frame", "2026-01-05T00:00:00Z")],
    generated_at: "2026-01-07T00:00:00Z",
  };

  it("GETs the overview path with the recent limit and forwards the snapshot", async () => {
    const { fetchImpl, calls } = router({
      [`/projects/${project.id}/overview`]: overview,
    });
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl });

    await expect(api.getProjectOverview(project.id, { recentLimit: 3 })).resolves.toEqual(overview);

    const url = new URL(calls[0] ?? "");
    expect(url.pathname).toBe(`${API_PREFIX}/projects/${project.id}/overview`);
    expect(url.searchParams.get("recent_limit")).toBe("3");
  });

  it("omits the query string when no recent limit is supplied", async () => {
    const { fetchImpl, calls } = router({
      [`/projects/${project.id}/overview`]: overview,
    });
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl });
    await expect(api.getProjectOverview(project.id)).resolves.toEqual(overview);
    expect(new URL(calls[0] ?? "").search).toBe("");
  });

  it("maps a 404 to undefined but surfaces validation and other failures", async () => {
    const missing = createHttpApiClient("http://localhost:8000", {
      fetchImpl: (async () =>
        jsonResponse({ error: { code: "not_found", message: "missing" } }, {
          status: 404,
        })) as typeof fetch,
    });
    await expect(missing.getProjectOverview(project.id)).resolves.toBeUndefined();

    const invalid = createHttpApiClient("http://localhost:8000", {
      fetchImpl: (async () =>
        jsonResponse(
          {
            error: {
              code: "validation_error",
              message: "Invalid project id.",
              details: [{ field: "project_id", message: "must be a UUID" }],
            },
          },
          { status: 422 },
        )) as typeof fetch,
    });
    await expect(invalid.getProjectOverview("bad")).rejects.toMatchObject({
      status: 422,
      code: "validation_error",
    });

    const failing = createHttpApiClient("http://localhost:8000", {
      fetchImpl: (async () =>
        jsonResponse({ error: { code: "internal_error", message: "boom" } }, {
          status: 500,
        })) as typeof fetch,
    });
    await expect(failing.getProjectOverview(project.id)).rejects.toMatchObject({
      status: 500,
      code: "internal_error",
    });
  });
});

describe("createHttpApiClient workspace activity (C29)", () => {
  const feed = {
    events: [
      {
        id: "job-j1",
        kind: "job",
        project_id: project.id,
        actor_id: project.created_by,
        label: "dataset-prep · running",
        detail: "Attempt 1",
        timestamp: "2026-01-05T00:00:00Z",
        tone: "info",
      },
    ],
    total: 1,
  };

  it("GETs /activity with filters and forwards the feed untouched", async () => {
    const { fetchImpl, calls } = router({ "/activity": feed });
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl });

    await expect(
      api.getActivity({ projectId: project.id, kind: "job", limit: 5 }),
    ).resolves.toEqual(feed);

    const url = new URL(calls[0] ?? "");
    expect(url.pathname).toBe(`${API_PREFIX}/activity`);
    expect(url.searchParams.get("project_id")).toBe(project.id);
    expect(url.searchParams.get("kind")).toBe("job");
    expect(url.searchParams.get("limit")).toBe("5");
  });

  it("surfaces normalized 404 and 422 failures", async () => {
    const missing = createHttpApiClient("http://localhost:8000", {
      fetchImpl: (async () =>
        jsonResponse(
          { error: { code: "not_found", message: "missing" } },
          { status: 404 },
        )) as typeof fetch,
    });
    await expect(missing.getActivity({ projectId: project.id })).rejects.toMatchObject({
      status: 404,
      code: "not_found",
    });

    const failing = createHttpApiClient("http://localhost:8000", {
      fetchImpl: (async () =>
        jsonResponse(
          { error: { code: "validation_error", message: "Bad filter" } },
          { status: 422 },
        )) as typeof fetch,
    });
    await expect(failing.getActivity({ limit: 999 })).rejects.toMatchObject({
      status: 422,
      code: "validation_error",
      message: "Bad filter",
    });
  });
});

describe("createHttpApiClient dashboard", () => {
  const snapshot = {
    counts: {
      projects: 1,
      assets: 2,
      conversations: 0,
      jobs: 2,
      providers: 1,
      enabled_extensions: 0,
    },
    generated_at: "2026-01-06T00:00:00Z",
    jobs_by_status: { queued: 0, running: 1, succeeded: 1, failed: 0, canceled: 0 },
    assets_by_type: { image: 2 },
    recent_jobs: [],
    recent_assets: [],
  };

  it("GETs /dashboard with recent_limit and forwards the snapshot untouched", async () => {
    const { fetchImpl, calls } = router({ "/dashboard": snapshot });
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl });

    await expect(api.getDashboard({ recentLimit: 10 })).resolves.toEqual(snapshot);

    const url = new URL(calls[0] ?? "");
    expect(url.pathname).toBe(`${API_PREFIX}/dashboard`);
    expect(url.searchParams.get("recent_limit")).toBe("10");
  });

  it("normalizes a backend validation failure into an ApiError", async () => {
    const failing = createHttpApiClient("http://localhost:8000", {
      fetchImpl: (async () =>
        jsonResponse(
          { error: { code: "validation_error", message: "Too many" } },
          { status: 422 },
        )) as typeof fetch,
    });
    await expect(failing.getDashboard({ recentLimit: 999 })).rejects.toMatchObject({
      status: 422,
      code: "validation_error",
      message: "Too many",
    });
  });
});

describe("createHttpApiClient job stats", () => {
  const stats = {
    total: 2,
    by_status: [
      { status: "queued", count: 0 },
      { status: "running", count: 1 },
      { status: "succeeded", count: 1 },
      { status: "failed", count: 0 },
      { status: "canceled", count: 0 },
    ],
    by_operation: [{ operation_id: "lora-train", total: 2, succeeded: 1, failed: 0 }],
    success_rate: 1,
    in_flight: 1,
    completed: 1,
    average_duration_seconds: null,
    generated_at: "2026-01-06T00:00:00Z",
  };

  it("GETs /jobs/stats with the project scope and forwards the snapshot untouched", async () => {
    const { fetchImpl, calls } = router({ "/jobs/stats": stats });
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl });

    await expect(
      api.getJobStats({ projectId: "11111111-1111-4111-8111-111111111111" }),
    ).resolves.toEqual(stats);

    const url = new URL(calls[0] ?? "");
    expect(url.pathname).toBe(`${API_PREFIX}/jobs/stats`);
    expect(url.searchParams.get("project_id")).toBe("11111111-1111-4111-8111-111111111111");
  });

  it("normalizes a backend failure into an ApiError", async () => {
    const failing = createHttpApiClient("http://localhost:8000", {
      fetchImpl: (async () =>
        jsonResponse(
          { error: { code: "not_found", message: "Project not found" } },
          { status: 404 },
        )) as typeof fetch,
    });
    await expect(failing.getJobStats()).rejects.toMatchObject({
      status: 404,
      code: "not_found",
      message: "Project not found",
    });
  });
});

describe("createHttpApiClient job dispatch queue (C121)", () => {
  const view = {
    total: 2,
    waiting: 1,
    running: 1,
    entries: [
      {
        position: 1,
        job_id: "0b5c1e2a-3000-4000-8000-000000000001",
        operation_id: "dataset-prep",
        status: "running",
        project_id: project.id,
        created_at: "2026-01-05T00:00:00Z",
      },
      {
        position: 2,
        job_id: "0b5c1e2a-3000-4000-8000-000000000003",
        operation_id: "upscale",
        status: "queued",
        project_id: project.id,
        created_at: "2026-01-07T00:00:00Z",
      },
    ],
    generated_at: "2026-01-06T00:00:00Z",
  };

  it("GETs /jobs/queue with the project scope and page limit, forwarding the view untouched", async () => {
    const { fetchImpl, calls } = router({ "/jobs/queue": view });
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl });

    await expect(api.getJobQueue({ projectId: project.id, limit: 2 })).resolves.toEqual(view);
    const url = new URL(calls[0] ?? "");
    expect(url.pathname).toBe(`${API_PREFIX}/jobs/queue`);
    expect(url.searchParams.get("project_id")).toBe(project.id);
    expect(url.searchParams.get("limit")).toBe("2");

    await expect(api.getJobQueue()).resolves.toEqual(view);
    expect(new URL(calls[1] ?? "").search).toBe("");
  });

  it("normalizes a backend failure into an ApiError", async () => {
    const failing = createHttpApiClient("http://localhost:8000", {
      fetchImpl: (async () =>
        jsonResponse(
          { error: { code: "not_found", message: "Project not found" } },
          { status: 404 },
        )) as typeof fetch,
    });
    await expect(failing.getJobQueue()).rejects.toMatchObject({
      status: 404,
      code: "not_found",
      message: "Project not found",
    });
  });
});

describe("createHttpApiClient per-job execution log (C117)", () => {
  const jobId = "33333333-3333-4333-8333-333333333333";
  const frame = {
    job_id: jobId,
    entries: [
      {
        seq: 0,
        type: "status",
        level: "info",
        message: "started",
        status: "running",
        progress: null,
        asset_id: null,
        error: null,
        timestamp: "2026-01-06T00:00:00Z",
      },
      {
        seq: 1,
        type: "error",
        level: "error",
        message: "boom",
        status: "failed",
        progress: null,
        asset_id: null,
        error: { code: "E", message: "boom" },
        timestamp: "2026-01-06T00:01:00Z",
      },
    ],
    next_seq: 2,
    total: 2,
  };

  it("GETs /jobs/{id}/logs with filter/cursor params and forwards the frame", async () => {
    const calls: string[] = [];
    const api = createHttpApiClient("http://localhost:8000", {
      fetchImpl: (async (input: string | URL | Request) => {
        calls.push(String(input));
        return jsonResponse(frame);
      }) as typeof fetch,
    });

    await expect(api.getJobLogs(jobId, { level: "error", sinceSeq: 1, limit: 10 })).resolves.toEqual(
      frame,
    );

    const url = new URL(calls[0] ?? "");
    expect(url.pathname).toBe(`${API_PREFIX}/jobs/${jobId}/logs`);
    expect(url.searchParams.get("level")).toBe("error");
    expect(url.searchParams.get("since_seq")).toBe("1");
    expect(url.searchParams.get("limit")).toBe("10");
  });

  it("maps a 404 to undefined but surfaces a 422 validation failure", async () => {
    let status = 404;
    let code = "job_not_found";
    const api = createHttpApiClient("http://localhost:8000", {
      fetchImpl: (async () =>
        jsonResponse(
          { error: { code, message: "nope" } },
          { status },
        )) as typeof fetch,
    });

    await expect(api.getJobLogs(jobId)).resolves.toBeUndefined();
    status = 422;
    code = "validation_error";
    await expect(api.getJobLogs(jobId, { limit: 0 })).rejects.toMatchObject({
      status: 422,
      code: "validation_error",
    });
  });
});

describe("createHttpApiClient conversation stats", () => {
  const stats = {
    total_conversations: 2,
    total_messages: 3,
    by_role: [
      { role: "system", count: 0 },
      { role: "user", count: 2 },
      { role: "assistant", count: 1 },
      { role: "tool", count: 0 },
    ],
    by_status: [
      { status: "pending", count: 0 },
      { status: "streaming", count: 0 },
      { status: "complete", count: 3 },
      { status: "error", count: 0 },
    ],
    average_messages_per_conversation: 1.5,
    last_activity_at: "2026-01-06T00:00:00Z",
    generated_at: "2026-01-06T00:00:00Z",
  };

  it("GETs /conversations/stats with the project scope and forwards the snapshot untouched", async () => {
    const { fetchImpl, calls } = router({ "/conversations/stats": stats });
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl });

    await expect(
      api.getConversationStats({ projectId: "11111111-1111-4111-8111-111111111111" }),
    ).resolves.toEqual(stats);

    const url = new URL(calls[0] ?? "");
    expect(url.pathname).toBe(`${API_PREFIX}/conversations/stats`);
    expect(url.searchParams.get("project_id")).toBe("11111111-1111-4111-8111-111111111111");
  });

  it("normalizes a backend failure into an ApiError", async () => {
    const failing = createHttpApiClient("http://localhost:8000", {
      fetchImpl: (async () =>
        jsonResponse(
          { error: { code: "not_found", message: "Project not found" } },
          { status: 404 },
        )) as typeof fetch,
    });
    await expect(failing.getConversationStats()).rejects.toMatchObject({
      status: 404,
      code: "not_found",
      message: "Project not found",
    });
  });
});

describe("createHttpApiClient cross-domain search", () => {
  const response = {
    query: "mara",
    results: [
      {
        kind: "conversation",
        id: "c1",
        title: "Mara identity — dataset review",
        subtitle: "Sable — Character Study",
        project_id: project.id,
        score: 1,
      },
    ],
  };

  it("GETs /search with the query and optional filters", async () => {
    const { fetchImpl, calls } = router({ "/search": response });
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl });

    await expect(api.search("mara", { kind: "conversation", limit: 5 })).resolves.toEqual(response);

    const url = new URL(calls[0] ?? "");
    expect(url.pathname).toBe(`${API_PREFIX}/search`);
    expect(url.searchParams.get("q")).toBe("mara");
    expect(url.searchParams.get("kind")).toBe("conversation");
    expect(url.searchParams.get("limit")).toBe("5");
  });

  it("normalizes a backend validation failure into an ApiError", async () => {
    const failing = createHttpApiClient("http://localhost:8000", {
      fetchImpl: (async () =>
        jsonResponse(
          { error: { code: "validation_error", message: "Empty query" } },
          { status: 422 },
        )) as typeof fetch,
    });

    await expect(failing.search("")).rejects.toMatchObject({
      status: 422,
      code: "validation_error",
      message: "Empty query",
    });
  });
});

describe("createHttpApiClient asset stats", () => {
  const stats = {
    total: 2,
    by_type: [
      { type: "image", count: 2 },
      { type: "video", count: 0 },
    ],
    by_status: [{ status: "ready", count: 2 }],
    total_size_bytes: 350,
    total_versions: 3,
    newest_asset_at: "2026-01-06T00:00:00Z",
    generated_at: "2026-01-06T00:00:00Z",
  };

  it("GETs /assets/stats with the project scope and forwards the snapshot untouched", async () => {
    const { fetchImpl, calls } = router({ "/assets/stats": stats });
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl });

    await expect(
      api.getAssetStats({ projectId: "11111111-1111-4111-8111-111111111111" }),
    ).resolves.toEqual(stats);

    const url = new URL(calls[0] ?? "");
    expect(url.pathname).toBe(`${API_PREFIX}/assets/stats`);
    expect(url.searchParams.get("project_id")).toBe("11111111-1111-4111-8111-111111111111");
  });

  it("normalizes a backend failure into an ApiError", async () => {
    const failing = createHttpApiClient("http://localhost:8000", {
      fetchImpl: (async () =>
        jsonResponse(
          { error: { code: "not_found", message: "Project not found" } },
          { status: 404 },
        )) as typeof fetch,
    });
    await expect(failing.getAssetStats()).rejects.toMatchObject({
      status: 404,
      code: "not_found",
      message: "Project not found",
    });
  });
});

describe("createHttpApiClient project stats", () => {
  const stats = {
    total: 2,
    by_lifecycle: [
      { lifecycle: "active", count: 1 },
      { lifecycle: "archived", count: 1 },
    ],
    active: 1,
    archived: 1,
    total_assets: 3,
    total_conversations: 2,
    total_jobs: 4,
    average_assets_per_project: 1.5,
    average_jobs_per_project: 2.0,
    newest_project_at: "2026-01-06T00:00:00Z",
    generated_at: "2026-01-06T00:00:00Z",
  };

  it("GETs /projects/stats with the org scope and forwards the snapshot untouched", async () => {
    const { fetchImpl, calls } = router({ "/projects/stats": stats });
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl });

    await expect(
      api.getProjectStats({ orgId: "11111111-1111-4111-8111-111111111111" }),
    ).resolves.toEqual(stats);

    const url = new URL(calls[0] ?? "");
    expect(url.pathname).toBe(`${API_PREFIX}/projects/stats`);
    expect(url.searchParams.get("org_id")).toBe("11111111-1111-4111-8111-111111111111");
  });

  it("normalizes a backend failure into an ApiError", async () => {
    const failing = createHttpApiClient("http://localhost:8000", {
      fetchImpl: (async () =>
        jsonResponse(
          { error: { code: "validation_error", message: "Invalid organization id." } },
          { status: 422 },
        )) as typeof fetch,
    });
    await expect(failing.getProjectStats({ orgId: "bad" })).rejects.toMatchObject({
      status: 422,
      code: "validation_error",
      message: "Invalid organization id.",
    });
  });
});

describe("createHttpApiClient project feed", () => {
  const feed = {
    items: [
      {
        project_id: "11111111-1111-4111-8111-111111111111",
        org_id: "22222222-2222-4222-8222-222222222222",
        org_name: "Studio Northlight",
        name: "Moonshot",
        description: "Short film.",
        lifecycle: "active",
        created_by: "33333333-3333-4333-8333-333333333333",
        created_at: "2026-01-06T00:00:00Z",
        updated_at: "2026-01-07T00:00:00Z",
      },
    ],
    total: 1,
    generated_at: "2026-01-08T00:00:00Z",
  };

  it("GETs /projects/feed with the org/lifecycle/limit scope and forwards the feed untouched", async () => {
    const { fetchImpl, calls } = router({ "/projects/feed": feed });
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl });

    await expect(
      api.getProjectFeed({
        orgId: "22222222-2222-4222-8222-222222222222",
        lifecycle: "active",
        limit: 5,
      }),
    ).resolves.toEqual(feed);

    const url = new URL(calls[0] ?? "");
    expect(url.pathname).toBe(`${API_PREFIX}/projects/feed`);
    expect(url.searchParams.get("org_id")).toBe("22222222-2222-4222-8222-222222222222");
    expect(url.searchParams.get("lifecycle")).toBe("active");
    expect(url.searchParams.get("limit")).toBe("5");
  });

  it("normalizes a backend failure into an ApiError", async () => {
    const failing = createHttpApiClient("http://localhost:8000", {
      fetchImpl: (async () =>
        jsonResponse(
          { error: { code: "validation_error", message: "Invalid project lifecycle." } },
          { status: 422 },
        )) as typeof fetch,
    });
    await expect(failing.getProjectFeed({ lifecycle: "paused" as never })).rejects.toMatchObject({
      status: 422,
      code: "validation_error",
      message: "Invalid project lifecycle.",
    });
  });
});

describe("createHttpApiClient organization stats", () => {
  const stats = {
    total_organizations: 2,
    total_members: 4,
    total_users: 5,
    by_role: [{ role: "owner", members: 1 }],
    by_organization: [{ org_id: "11111111-1111-4111-8111-111111111111", members: 2 }],
    average_members_per_org: 2.0,
    newest_org_at: "2026-01-06T00:00:00Z",
    generated_at: "2026-01-06T00:00:00Z",
  };

  it("GETs /orgs/stats with the org scope and forwards the snapshot untouched", async () => {
    const { fetchImpl, calls } = router({ "/orgs/stats": stats });
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl });

    await expect(
      api.getOrganizationStats({ orgId: "11111111-1111-4111-8111-111111111111" }),
    ).resolves.toEqual(stats);

    const url = new URL(calls[0] ?? "");
    expect(url.pathname).toBe(`${API_PREFIX}/orgs/stats`);
    expect(url.searchParams.get("org_id")).toBe("11111111-1111-4111-8111-111111111111");
  });

  it("normalizes a backend failure into an ApiError", async () => {
    const failing = createHttpApiClient("http://localhost:8000", {
      fetchImpl: (async () =>
        jsonResponse(
          { error: { code: "validation_error", message: "Invalid organization id." } },
          { status: 422 },
        )) as typeof fetch,
    });
    await expect(failing.getOrganizationStats({ orgId: "bad" })).rejects.toMatchObject({
      status: 422,
      code: "validation_error",
      message: "Invalid organization id.",
    });
  });
});

describe("createHttpApiClient pipeline stats", () => {
  const stats = {
    total_chains: 3,
    total_jobs: 5,
    total_assets: 7,
    by_kind: [
      { kind: "training", chains: 1, jobs: 2, assets: 3 },
      { kind: "shot", chains: 1, jobs: 1, assets: 1 },
      { kind: "splat", chains: 1, jobs: 2, assets: 3 },
    ],
    by_project: [{ project_id: "11111111-1111-4111-8111-111111111111", chains: 3 }],
    newest_chain_at: "2026-01-06T00:00:00Z",
    generated_at: "2026-01-06T00:00:00Z",
  };

  it("GETs /pipelines/stats with the project scope and forwards the snapshot untouched", async () => {
    const { fetchImpl, calls } = router({ "/pipelines/stats": stats });
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl });

    await expect(
      api.getPipelineStats({ projectId: "11111111-1111-4111-8111-111111111111" }),
    ).resolves.toEqual(stats);

    const url = new URL(calls[0] ?? "");
    expect(url.pathname).toBe(`${API_PREFIX}/pipelines/stats`);
    expect(url.searchParams.get("project_id")).toBe("11111111-1111-4111-8111-111111111111");
  });

  it("normalizes a backend failure into an ApiError", async () => {
    const failing = createHttpApiClient("http://localhost:8000", {
      fetchImpl: (async () =>
        jsonResponse(
          { error: { code: "project_not_found", message: "Project not found." } },
          { status: 404 },
        )) as typeof fetch,
    });
    await expect(failing.getPipelineStats({ projectId: "bad" })).rejects.toMatchObject({
      status: 404,
      code: "project_not_found",
      message: "Project not found.",
    });
  });
});

describe("createHttpApiClient /pipelines/feed", () => {
  const feed = {
    items: [
      {
        chain_id: "0b5c1e2a-4000-4000-8000-000000000002",
        project_id: "0b5c1e2a-1000-4000-8000-000000000005",
        project_name: "Moonshot — Short Film",
        kind: "shot",
        job_count: 1,
        asset_count: 1,
        created_by: "0b5c1e2a-0000-4000-8000-0000000000aa",
        created_at: "2026-01-06T00:00:00Z",
      },
    ],
    total: 1,
    generated_at: "2026-01-06T00:00:00Z",
  };

  it("GETs /pipelines/feed with filters and page and forwards the feed untouched", async () => {
    const { fetchImpl, calls } = router({ "/pipelines/feed": feed });
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl });

    await expect(
      api.getPipelineFeed({
        projectId: "0b5c1e2a-1000-4000-8000-000000000005",
        kind: "shot",
        limit: 2,
      }),
    ).resolves.toEqual(feed);

    const url = new URL(calls[0] ?? "");
    expect(url.pathname).toBe(`${API_PREFIX}/pipelines/feed`);
    expect(url.searchParams.get("project_id")).toBe("0b5c1e2a-1000-4000-8000-000000000005");
    expect(url.searchParams.get("kind")).toBe("shot");
    expect(url.searchParams.get("limit")).toBe("2");
  });

  it("omits the query string when no filters or page are supplied", async () => {
    const { fetchImpl, calls } = router({ "/pipelines/feed": feed });
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl });

    await expect(api.getPipelineFeed()).resolves.toEqual(feed);
    expect(new URL(calls[0] ?? "").search).toBe("");
  });

  it("normalizes a backend failure into an ApiError", async () => {
    const failing = createHttpApiClient("http://localhost:8000", {
      fetchImpl: (async () =>
        jsonResponse(
          { error: { code: "validation_error", message: "Feed limit must be between 1 and 200." } },
          { status: 422 },
        )) as typeof fetch,
    });
    await expect(failing.getPipelineFeed({ limit: 0 })).rejects.toMatchObject({
      status: 422,
      code: "validation_error",
      message: "Feed limit must be between 1 and 200.",
    });
  });
});

describe("createHttpApiClient lineage stats", () => {
  const stats = {
    total_relationships: 3,
    total_linked_assets: 4,
    by_type: [
      { type: "derived_from", count: 2 },
      { type: "variant_of", count: 0 },
      { type: "uses_input", count: 1 },
      { type: "related_to", count: 0 },
      { type: "duplicate_of", count: 0 },
    ],
    by_project: [{ project_id: "11111111-1111-4111-8111-111111111111", relationships: 3 }],
    newest_relationship_at: "2026-01-06T00:00:00Z",
    generated_at: "2026-01-06T00:00:00Z",
  };

  it("GETs /lineage/stats with the project scope and forwards the snapshot untouched", async () => {
    const { fetchImpl, calls } = router({ "/lineage/stats": stats });
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl });

    await expect(
      api.getLineageStats({ projectId: "11111111-1111-4111-8111-111111111111" }),
    ).resolves.toEqual(stats);

    const url = new URL(calls[0] ?? "");
    expect(url.pathname).toBe(`${API_PREFIX}/lineage/stats`);
    expect(url.searchParams.get("project_id")).toBe("11111111-1111-4111-8111-111111111111");
  });

  it("normalizes a backend failure into an ApiError", async () => {
    const failing = createHttpApiClient("http://localhost:8000", {
      fetchImpl: (async () =>
        jsonResponse(
          { error: { code: "project_not_found", message: "Project not found." } },
          { status: 404 },
        )) as typeof fetch,
    });
    await expect(failing.getLineageStats({ projectId: "bad" })).rejects.toMatchObject({
      status: 404,
      code: "project_not_found",
      message: "Project not found.",
    });
  });
});

describe("createHttpApiClient collaboration stats", () => {
  const stats = {
    total_presence: 3,
    total_comments: 2,
    total_participants: 3,
    by_state: [
      { state: "online", count: 1 },
      { state: "away", count: 1 },
      { state: "offline", count: 1 },
    ],
    by_project: [{ project_id: "11111111-1111-4111-8111-111111111111", comments: 2, presence: 3 }],
    newest_presence_at: "2026-01-06T00:00:00Z",
    newest_comment_at: "2026-01-06T00:00:00Z",
    generated_at: "2026-01-06T00:00:00Z",
  };

  it("GETs /collaboration/stats with the project scope and forwards the snapshot untouched", async () => {
    const { fetchImpl, calls } = router({ "/collaboration/stats": stats });
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl });

    await expect(
      api.getCollaborationStats({ projectId: "11111111-1111-4111-8111-111111111111" }),
    ).resolves.toEqual(stats);

    const url = new URL(calls[0] ?? "");
    expect(url.pathname).toBe(`${API_PREFIX}/collaboration/stats`);
    expect(url.searchParams.get("project_id")).toBe("11111111-1111-4111-8111-111111111111");
  });

  it("normalizes a backend failure into an ApiError", async () => {
    const failing = createHttpApiClient("http://localhost:8000", {
      fetchImpl: (async () =>
        jsonResponse(
          { error: { code: "project_not_found", message: "Project not found." } },
          { status: 404 },
        )) as typeof fetch,
    });
    await expect(failing.getCollaborationStats({ projectId: "bad" })).rejects.toMatchObject({
      status: 404,
      code: "project_not_found",
      message: "Project not found.",
    });
  });
});

describe("createHttpApiClient activity stats", () => {
  const stats = {
    total_events: 4,
    total_participants: 2,
    by_kind: [
      { kind: "asset", count: 2 },
      { kind: "publish", count: 0 },
      { kind: "job", count: 1 },
      { kind: "comment", count: 1 },
    ],
    by_project: [
      { project_id: "11111111-1111-4111-8111-111111111111", events: 4, participants: 2 },
    ],
    newest_event_at: "2026-01-06T00:00:00Z",
    generated_at: "2026-01-06T00:00:00Z",
  };

  it("GETs /activity/stats with the project scope and forwards the snapshot untouched", async () => {
    const { fetchImpl, calls } = router({ "/activity/stats": stats });
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl });

    await expect(
      api.getActivityStats({ projectId: "11111111-1111-4111-8111-111111111111" }),
    ).resolves.toEqual(stats);

    const url = new URL(calls[0] ?? "");
    expect(url.pathname).toBe(`${API_PREFIX}/activity/stats`);
    expect(url.searchParams.get("project_id")).toBe("11111111-1111-4111-8111-111111111111");
  });

  it("normalizes a backend failure into an ApiError", async () => {
    const failing = createHttpApiClient("http://localhost:8000", {
      fetchImpl: (async () =>
        jsonResponse(
          { error: { code: "project_not_found", message: "Project not found." } },
          { status: 404 },
        )) as typeof fetch,
    });
    await expect(failing.getActivityStats({ projectId: "bad" })).rejects.toMatchObject({
      status: 404,
      code: "project_not_found",
      message: "Project not found.",
    });
  });
});

describe("createHttpApiClient search index stats", () => {
  const stats = {
    total_documents: 6,
    by_kind: [
      { kind: "project", count: 2 },
      { kind: "asset", count: 3 },
      { kind: "conversation", count: 1 },
    ],
    newest_document_at: "2026-01-06T00:00:00Z",
    generated_at: "2026-01-06T00:00:00Z",
  };

  it("GETs /search/stats with the project scope and forwards the snapshot untouched", async () => {
    const { fetchImpl, calls } = router({ "/search/stats": stats });
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl });

    await expect(
      api.getSearchStats({ projectId: "11111111-1111-4111-8111-111111111111" }),
    ).resolves.toEqual(stats);

    const url = new URL(calls[0] ?? "");
    expect(url.pathname).toBe(`${API_PREFIX}/search/stats`);
    expect(url.searchParams.get("project_id")).toBe("11111111-1111-4111-8111-111111111111");
  });

  it("omits the project scope when none is supplied", async () => {
    const { fetchImpl, calls } = router({ "/search/stats": stats });
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl });

    await expect(api.getSearchStats()).resolves.toEqual(stats);
    expect(new URL(calls[0] ?? "").search).toBe("");
  });

  it("normalizes a backend failure into an ApiError", async () => {
    const failing = createHttpApiClient("http://localhost:8000", {
      fetchImpl: (async () =>
        jsonResponse(
          { error: { code: "project_not_found", message: "Project not found." } },
          { status: 404 },
        )) as typeof fetch,
    });
    await expect(failing.getSearchStats({ projectId: "bad" })).rejects.toMatchObject({
      status: 404,
      code: "project_not_found",
      message: "Project not found.",
    });
  });
});

describe("createHttpApiClient upload statistics", () => {
  const stats = {
    total_tickets: 4,
    pending: 1,
    completed: 3,
    bytes_uploaded: 1_500_000,
    by_status: [
      { status: "pending", count: 1 },
      { status: "complete", count: 3 },
    ],
    by_project: [
      {
        project_id: "11111111-1111-4111-8111-111111111111",
        total: 3,
        completed: 2,
        bytes_uploaded: 1_000_000,
      },
    ],
    newest_upload_at: "2026-01-06T00:00:00Z",
    generated_at: "2026-01-06T00:00:00Z",
  };

  it("GETs /uploads/stats with the project scope and forwards the snapshot untouched", async () => {
    const { fetchImpl, calls } = router({ "/uploads/stats": stats });
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl });

    await expect(
      api.getUploadStats({ projectId: "11111111-1111-4111-8111-111111111111" }),
    ).resolves.toEqual(stats);

    const url = new URL(calls[0] ?? "");
    expect(url.pathname).toBe(`${API_PREFIX}/uploads/stats`);
    expect(url.searchParams.get("project_id")).toBe("11111111-1111-4111-8111-111111111111");
  });

  it("omits the project scope and query string when none is supplied", async () => {
    const { fetchImpl, calls } = router({ "/uploads/stats": stats });
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl });

    await expect(api.getUploadStats()).resolves.toEqual(stats);
    expect(new URL(calls[0] ?? "").search).toBe("");
  });

  it("normalizes a backend failure into an ApiError", async () => {
    const failing = createHttpApiClient("http://localhost:8000", {
      fetchImpl: (async () =>
        jsonResponse(
          { error: { code: "project_not_found", message: "Project not found." } },
          { status: 404 },
        )) as typeof fetch,
    });
    await expect(failing.getUploadStats({ projectId: "bad" })).rejects.toMatchObject({
      status: 404,
      code: "project_not_found",
      message: "Project not found.",
    });
  });
});

describe("createHttpApiClient event stream statistics", () => {
  const stats = {
    total_events: 5,
    total_jobs: 2,
    by_type: [
      { type: "status", count: 1 },
      { type: "progress", count: 2 },
      { type: "intermediate", count: 0 },
      { type: "result", count: 1 },
      { type: "error", count: 1 },
      { type: "log", count: 0 },
    ],
    by_job: [
      {
        job_id: "11111111-1111-4111-8111-111111111111",
        events: 3,
        newest_event_at: "2026-01-06T00:00:00Z",
      },
    ],
    newest_event_at: "2026-01-06T00:00:00Z",
    generated_at: "2026-01-06T00:00:00Z",
  };

  it("GETs /events/stats with the project scope and forwards the snapshot untouched", async () => {
    const { fetchImpl, calls } = router({ "/events/stats": stats });
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl });

    await expect(
      api.getEventStats({ projectId: "11111111-1111-4111-8111-111111111111" }),
    ).resolves.toEqual(stats);

    const url = new URL(calls[0] ?? "");
    expect(url.pathname).toBe(`${API_PREFIX}/events/stats`);
    expect(url.searchParams.get("project_id")).toBe("11111111-1111-4111-8111-111111111111");
  });

  it("omits the project scope and query string when none is supplied", async () => {
    const { fetchImpl, calls } = router({ "/events/stats": stats });
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl });

    await expect(api.getEventStats()).resolves.toEqual(stats);
    expect(new URL(calls[0] ?? "").search).toBe("");
  });

  it("normalizes a backend failure into an ApiError", async () => {
    const failing = createHttpApiClient("http://localhost:8000", {
      fetchImpl: (async () =>
        jsonResponse(
          { error: { code: "project_not_found", message: "Project not found." } },
          { status: 404 },
        )) as typeof fetch,
    });
    await expect(failing.getEventStats({ projectId: "bad" })).rejects.toMatchObject({
      status: 404,
      code: "project_not_found",
      message: "Project not found.",
    });
  });
});

describe("createHttpApiClient /events/feed", () => {
  const feed = {
    items: [
      {
        job_id: "11111111-1111-4111-8111-111111111111",
        seq: 0,
        type: "status",
        operation_id: "dataset-prep",
        project_id: "22222222-2222-4222-8222-222222222222",
        project_name: "Moonshot",
        status: "running",
        progress: null,
        message: "started",
        asset_id: null,
        error: null,
        timestamp: "2026-01-06T00:00:00Z",
      },
    ],
    total: 1,
    generated_at: "2026-01-06T00:00:00Z",
  };

  it("GETs /events/feed with the scope, type filter and page and forwards the feed untouched", async () => {
    const { fetchImpl, calls } = router({ "/events/feed": feed });
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl });

    await expect(
      api.getEventFeed({
        projectId: "22222222-2222-4222-8222-222222222222",
        type: "status",
        limit: 2,
      }),
    ).resolves.toEqual(feed);

    const url = new URL(calls[0] ?? "");
    expect(url.pathname).toBe(`${API_PREFIX}/events/feed`);
    expect(url.searchParams.get("project_id")).toBe("22222222-2222-4222-8222-222222222222");
    expect(url.searchParams.get("type")).toBe("status");
    expect(url.searchParams.get("limit")).toBe("2");
  });

  it("omits the query string when no scope, type or page is supplied", async () => {
    const { fetchImpl, calls } = router({ "/events/feed": feed });
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl });

    await expect(api.getEventFeed()).resolves.toEqual(feed);
    expect(new URL(calls[0] ?? "").search).toBe("");
  });

  it("normalizes a backend failure into an ApiError", async () => {
    const failing = createHttpApiClient("http://localhost:8000", {
      fetchImpl: (async () =>
        jsonResponse(
          { error: { code: "project_not_found", message: "Project not found." } },
          { status: 404 },
        )) as typeof fetch,
    });
    await expect(failing.getEventFeed({ projectId: "bad" })).rejects.toMatchObject({
      status: 404,
      code: "project_not_found",
      message: "Project not found.",
    });
  });
});

describe("createHttpApiClient retry statistics", () => {
  const stats = {
    total_retries: 4,
    total_jobs: 3,
    by_status: [
      { status: "queued", jobs: 0 },
      { status: "running", jobs: 1 },
      { status: "succeeded", jobs: 1 },
      { status: "failed", jobs: 1 },
      { status: "canceled", jobs: 0 },
    ],
    by_project: [{ project_id: "11111111-1111-4111-8111-111111111111", retries: 4, jobs: 3 }],
    newest_retry_at: "2026-01-06T00:00:00Z",
    generated_at: "2026-01-06T00:00:00Z",
  };

  it("GETs /retries/stats with the project scope and forwards the snapshot untouched", async () => {
    const { fetchImpl, calls } = router({ "/retries/stats": stats });
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl });

    await expect(
      api.getRetryStats({ projectId: "11111111-1111-4111-8111-111111111111" }),
    ).resolves.toEqual(stats);

    const url = new URL(calls[0] ?? "");
    expect(url.pathname).toBe(`${API_PREFIX}/retries/stats`);
    expect(url.searchParams.get("project_id")).toBe("11111111-1111-4111-8111-111111111111");
  });

  it("omits the project scope and query string when none is supplied", async () => {
    const { fetchImpl, calls } = router({ "/retries/stats": stats });
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl });

    await expect(api.getRetryStats()).resolves.toEqual(stats);
    expect(new URL(calls[0] ?? "").search).toBe("");
  });

  it("normalizes a backend failure into an ApiError", async () => {
    const failing = createHttpApiClient("http://localhost:8000", {
      fetchImpl: (async () =>
        jsonResponse(
          { error: { code: "project_not_found", message: "Project not found." } },
          { status: 404 },
        )) as typeof fetch,
    });
    await expect(failing.getRetryStats({ projectId: "bad" })).rejects.toMatchObject({
      status: 404,
      code: "project_not_found",
      message: "Project not found.",
    });
  });
});

describe("createHttpApiClient retry feed", () => {
  const feed = {
    items: [
      {
        job_id: "0b5c1e2a-3000-4000-8000-000000000016",
        project_id: "11111111-1111-4111-8111-111111111111",
        project_name: "Moonshot",
        operation_id: "lora-train",
        status: "failed",
        attempt: 2,
        retries: 2,
        retried_at: "2026-01-06T00:00:00Z",
      },
    ],
    total: 1,
    generated_at: "2026-01-06T00:00:00Z",
  };

  it("GETs /retries/feed with the project scope and limit and forwards the feed untouched", async () => {
    const { fetchImpl, calls } = router({ "/retries/feed": feed });
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl });

    await expect(
      api.getRetryFeed({ projectId: "11111111-1111-4111-8111-111111111111", limit: 5 }),
    ).resolves.toEqual(feed);

    const url = new URL(calls[0] ?? "");
    expect(url.pathname).toBe(`${API_PREFIX}/retries/feed`);
    expect(url.searchParams.get("project_id")).toBe("11111111-1111-4111-8111-111111111111");
    expect(url.searchParams.get("limit")).toBe("5");
  });

  it("omits the query string when no scope or limit is supplied", async () => {
    const { fetchImpl, calls } = router({ "/retries/feed": feed });
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl });

    await expect(api.getRetryFeed()).resolves.toEqual(feed);
    expect(new URL(calls[0] ?? "").search).toBe("");
  });

  it("normalizes a backend failure into an ApiError", async () => {
    const failing = createHttpApiClient("http://localhost:8000", {
      fetchImpl: (async () =>
        jsonResponse(
          { error: { code: "project_not_found", message: "Project not found." } },
          { status: 404 },
        )) as typeof fetch,
    });
    await expect(failing.getRetryFeed({ projectId: "bad" })).rejects.toMatchObject({
      status: 404,
      code: "project_not_found",
      message: "Project not found.",
    });
  });
});

describe("createHttpApiClient collaboration feed", () => {
  const feed = {
    items: [
      {
        signal_id: "33333333-3333-4333-8333-333333333333",
        signal: "comment",
        project_id: "11111111-1111-4111-8111-111111111111",
        project_name: "Moonshot",
        actor_id: "55555555-5555-4555-8555-555555555555",
        state: null,
        body: "Lock the silhouette.",
        asset_id: null,
        occurred_at: "2026-01-03T00:00:00Z",
      },
    ],
    total: 1,
    generated_at: "2026-01-06T00:00:00Z",
  };

  it("GETs /collaboration/feed with the project scope, signal and limit and forwards the feed untouched", async () => {
    const { fetchImpl, calls } = router({ "/collaboration/feed": feed });
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl });

    await expect(
      api.getCollaborationFeed({
        projectId: "11111111-1111-4111-8111-111111111111",
        signal: "comment",
        limit: 5,
      }),
    ).resolves.toEqual(feed);

    const url = new URL(calls[0] ?? "");
    expect(url.pathname).toBe(`${API_PREFIX}/collaboration/feed`);
    expect(url.searchParams.get("project_id")).toBe("11111111-1111-4111-8111-111111111111");
    expect(url.searchParams.get("signal")).toBe("comment");
    expect(url.searchParams.get("limit")).toBe("5");
  });

  it("omits the query string when no scope, signal or limit is supplied", async () => {
    const { fetchImpl, calls } = router({ "/collaboration/feed": feed });
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl });

    await expect(api.getCollaborationFeed()).resolves.toEqual(feed);
    expect(new URL(calls[0] ?? "").search).toBe("");
  });

  it("normalizes a backend failure into an ApiError", async () => {
    const failing = createHttpApiClient("http://localhost:8000", {
      fetchImpl: (async () =>
        jsonResponse(
          { error: { code: "project_not_found", message: "Project not found." } },
          { status: 404 },
        )) as typeof fetch,
    });
    await expect(failing.getCollaborationFeed({ projectId: "bad" })).rejects.toMatchObject({
      status: 404,
      code: "project_not_found",
      message: "Project not found.",
    });
  });
});

describe("createHttpApiClient version statistics", () => {
  const stats = {
    total_versions: 5,
    total_assets: 4,
    revisions: 1,
    by_version: [
      { version: 1, count: 4 },
      { version: 2, count: 1 },
    ],
    by_project: [{ project_id: "11111111-1111-4111-8111-111111111111", versions: 5, assets: 4 }],
    newest_version_at: "2026-01-06T00:00:00Z",
    generated_at: "2026-01-06T00:00:00Z",
  };

  it("GETs /versions/stats with the project scope and forwards the snapshot untouched", async () => {
    const { fetchImpl, calls } = router({ "/versions/stats": stats });
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl });

    await expect(
      api.getVersionStats({ projectId: "11111111-1111-4111-8111-111111111111" }),
    ).resolves.toEqual(stats);

    const url = new URL(calls[0] ?? "");
    expect(url.pathname).toBe(`${API_PREFIX}/versions/stats`);
    expect(url.searchParams.get("project_id")).toBe("11111111-1111-4111-8111-111111111111");
  });

  it("omits the project scope and query string when none is supplied", async () => {
    const { fetchImpl, calls } = router({ "/versions/stats": stats });
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl });

    await expect(api.getVersionStats()).resolves.toEqual(stats);
    expect(new URL(calls[0] ?? "").search).toBe("");
  });

  it("normalizes a backend failure into an ApiError", async () => {
    const failing = createHttpApiClient("http://localhost:8000", {
      fetchImpl: (async () =>
        jsonResponse(
          { error: { code: "project_not_found", message: "Project not found." } },
          { status: 404 },
        )) as typeof fetch,
    });
    await expect(failing.getVersionStats({ projectId: "bad" })).rejects.toMatchObject({
      status: 404,
      code: "project_not_found",
      message: "Project not found.",
    });
  });
});

describe("createHttpApiClient publish stats", () => {
  const stats = {
    total_published: 8,
    total_bytes: 64_438_272,
    by_version: [
      { version: 1, count: 7 },
      { version: 2, count: 1 },
    ],
    by_project: [
      { project_id: "11111111-1111-4111-8111-111111111111", published: 8, bytes: 64_438_272 },
    ],
    newest_published_at: "2026-01-06T00:00:00Z",
    generated_at: "2026-01-06T00:00:00Z",
  };

  it("GETs /publishes/stats with the project scope and forwards the snapshot untouched", async () => {
    const { fetchImpl, calls } = router({ "/publishes/stats": stats });
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl });

    await expect(
      api.getPublishStats({ projectId: "11111111-1111-4111-8111-111111111111" }),
    ).resolves.toEqual(stats);

    const url = new URL(calls[0] ?? "");
    expect(url.pathname).toBe(`${API_PREFIX}/publishes/stats`);
    expect(url.searchParams.get("project_id")).toBe("11111111-1111-4111-8111-111111111111");
  });

  it("omits the project scope and query string when none is supplied", async () => {
    const { fetchImpl, calls } = router({ "/publishes/stats": stats });
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl });

    await expect(api.getPublishStats()).resolves.toEqual(stats);
    expect(new URL(calls[0] ?? "").search).toBe("");
  });

  it("normalizes a backend failure into an ApiError", async () => {
    const failing = createHttpApiClient("http://localhost:8000", {
      fetchImpl: (async () =>
        jsonResponse(
          { error: { code: "project_not_found", message: "Project not found." } },
          { status: 404 },
        )) as typeof fetch,
    });
    await expect(failing.getPublishStats({ projectId: "bad" })).rejects.toMatchObject({
      status: 404,
      code: "project_not_found",
      message: "Project not found.",
    });
  });
});

describe("createHttpApiClient orchestration stats", () => {
  const stats = {
    total_plans: 3,
    total_runs: 3,
    total_steps: 6,
    total_jobs_linked: 3,
    by_stage: [
      { stage: "plan", count: 1 },
      { stage: "resolve", count: 0 },
      { stage: "submit", count: 0 },
      { stage: "await", count: 1 },
      { stage: "collect", count: 0 },
      { stage: "done", count: 1 },
    ],
    by_project: [{ project_id: "11111111-1111-4111-8111-111111111111", plans: 2, runs: 1 }],
    newest_plan_at: "2026-01-06T00:00:00Z",
    newest_run_at: "2026-01-06T00:00:00Z",
    generated_at: "2026-01-06T00:00:00Z",
  };

  it("GETs /orchestration/stats with the project scope and forwards the snapshot untouched", async () => {
    const { fetchImpl, calls } = router({ "/orchestration/stats": stats });
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl });

    await expect(
      api.getOrchestrationStats({ projectId: "11111111-1111-4111-8111-111111111111" }),
    ).resolves.toEqual(stats);

    const url = new URL(calls[0] ?? "");
    expect(url.pathname).toBe(`${API_PREFIX}/orchestration/stats`);
    expect(url.searchParams.get("project_id")).toBe("11111111-1111-4111-8111-111111111111");
  });

  it("normalizes a backend failure into an ApiError", async () => {
    const failing = createHttpApiClient("http://localhost:8000", {
      fetchImpl: (async () =>
        jsonResponse(
          { error: { code: "project_not_found", message: "Project not found." } },
          { status: 404 },
        )) as typeof fetch,
    });
    await expect(failing.getOrchestrationStats({ projectId: "bad" })).rejects.toMatchObject({
      status: 404,
      code: "project_not_found",
      message: "Project not found.",
    });
  });
});

describe("createHttpApiClient /orchestration/feed", () => {
  const feed = {
    items: [
      {
        id: "0b5c1e2a-6100-4000-8000-000000000001",
        kind: "plan",
        plan_id: "0b5c1e2a-6100-4000-8000-000000000001",
        run_id: null,
        project_id: "0b5c1e2a-1000-4000-8000-000000000005",
        project_name: "Moonshot — Short Film",
        goal: "Generate the shot video.",
        stage: null,
        step_count: 3,
        job_count: 0,
        created_at: "2026-01-06T00:00:00Z",
      },
    ],
    total: 1,
    generated_at: "2026-01-06T00:00:00Z",
  };

  it("GETs /orchestration/feed with filters and page and forwards the feed untouched", async () => {
    const { fetchImpl, calls } = router({ "/orchestration/feed": feed });
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl });

    await expect(
      api.getOrchestrationFeed({
        projectId: "0b5c1e2a-1000-4000-8000-000000000005",
        kind: "plan",
        limit: 2,
      }),
    ).resolves.toEqual(feed);

    const url = new URL(calls[0] ?? "");
    expect(url.pathname).toBe(`${API_PREFIX}/orchestration/feed`);
    expect(url.searchParams.get("project_id")).toBe("0b5c1e2a-1000-4000-8000-000000000005");
    expect(url.searchParams.get("kind")).toBe("plan");
    expect(url.searchParams.get("limit")).toBe("2");
  });

  it("omits the query string when no filters or page are supplied", async () => {
    const { fetchImpl, calls } = router({ "/orchestration/feed": feed });
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl });

    await expect(api.getOrchestrationFeed()).resolves.toEqual(feed);
    expect(new URL(calls[0] ?? "").search).toBe("");
  });

  it("normalizes a backend failure into an ApiError", async () => {
    const failing = createHttpApiClient("http://localhost:8000", {
      fetchImpl: (async () =>
        jsonResponse(
          { error: { code: "validation_error", message: "Feed limit must be between 1 and 200." } },
          { status: 422 },
        )) as typeof fetch,
    });
    await expect(failing.getOrchestrationFeed({ limit: 0 })).rejects.toMatchObject({
      status: 422,
      code: "validation_error",
      message: "Feed limit must be between 1 and 200.",
    });
  });
});

describe("createHttpApiClient provider stats", () => {
  const stats = {
    total: 2,
    by_status: [
      { status: "available", count: 1 },
      { status: "unavailable", count: 0 },
      { status: "degraded", count: 1 },
    ],
    by_location: [
      { location: "local", count: 0 },
      { location: "studio", count: 0 },
      { location: "cloud", count: 2 },
    ],
    available: 1,
    degraded: 1,
    unavailable: 0,
    total_capabilities: 5,
    unique_operations: 3,
    by_operation: [
      { operation_id: "image-to-video", providers: 2, available: 1 },
      { operation_id: "splat-train", providers: 1, available: 0 },
      { operation_id: "text-to-video", providers: 1, available: 0 },
    ],
    generated_at: "2026-01-06T00:00:00Z",
  };

  it("GETs /providers/stats with both filters and forwards the snapshot untouched", async () => {
    const { fetchImpl, calls } = router({ "/providers/stats": stats });
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl });

    await expect(
      api.getProviderStats({ location: "cloud", status: "degraded" }),
    ).resolves.toEqual(stats);

    const url = new URL(calls[0] ?? "");
    expect(url.pathname).toBe(`${API_PREFIX}/providers/stats`);
    expect(url.searchParams.get("location")).toBe("cloud");
    expect(url.searchParams.get("status")).toBe("degraded");
  });

  it("omits the filters when no options are supplied", async () => {
    const { fetchImpl, calls } = router({ "/providers/stats": stats });
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl });

    await expect(api.getProviderStats()).resolves.toEqual(stats);

    const url = new URL(calls[0] ?? "");
    expect(url.pathname).toBe(`${API_PREFIX}/providers/stats`);
    expect(url.searchParams.has("location")).toBe(false);
    expect(url.searchParams.has("status")).toBe(false);
  });

  it("normalizes a backend failure into an ApiError", async () => {
    const failing = createHttpApiClient("http://localhost:8000", {
      fetchImpl: (async () =>
        jsonResponse(
          { error: { code: "validation_error", message: "Invalid provider location." } },
          { status: 422 },
        )) as typeof fetch,
    });
    await expect(failing.getProviderStats({ location: "moon" as never })).rejects.toMatchObject({
      status: 422,
      code: "validation_error",
      message: "Invalid provider location.",
    });
  });
});

describe("createHttpApiClient provider feed", () => {
  const feed = {
    items: [
      {
        provider_id: "prov_a",
        name: "Alpha Runtime",
        location: "local",
        status: "available",
        operation_ids: ["text-to-image"],
        capability_count: 1,
      },
    ],
    total: 1,
    generated_at: "2026-01-06T00:00:00Z",
  };

  it("GETs /providers/feed with filters and page and forwards the feed untouched", async () => {
    const { fetchImpl, calls } = router({ "/providers/feed": feed });
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl });

    await expect(
      api.getProviderFeed({ location: "local", status: "available", limit: 2 }),
    ).resolves.toEqual(feed);

    const url = new URL(calls[0] ?? "");
    expect(url.pathname).toBe(`${API_PREFIX}/providers/feed`);
    expect(url.searchParams.get("location")).toBe("local");
    expect(url.searchParams.get("status")).toBe("available");
    expect(url.searchParams.get("limit")).toBe("2");
  });

  it("omits the query string when no filters or page are supplied", async () => {
    const { fetchImpl, calls } = router({ "/providers/feed": feed });
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl });

    await expect(api.getProviderFeed()).resolves.toEqual(feed);
    expect(new URL(calls[0] ?? "").search).toBe("");
  });

  it("normalizes a backend failure into an ApiError", async () => {
    const failing = createHttpApiClient("http://localhost:8000", {
      fetchImpl: (async () =>
        jsonResponse(
          { error: { code: "validation_error", message: "Feed limit must be between 1 and 200." } },
          { status: 422 },
        )) as typeof fetch,
    });
    await expect(failing.getProviderFeed({ limit: 0 })).rejects.toMatchObject({
      status: 422,
      code: "validation_error",
      message: "Feed limit must be between 1 and 200.",
    });
  });
});

describe("createHttpApiClient extension stats", () => {
  const stats = {
    total_registered: 3,
    total_installed: 2,
    by_type: [
      { type: "capability", count: 1 },
      { type: "ui", count: 1 },
      { type: "provider", count: 1 },
      { type: "runtime", count: 0 },
      { type: "bundle", count: 0 },
    ],
    by_status: [
      { status: "installed", count: 1 },
      { status: "enabled", count: 1 },
      { status: "disabled", count: 0 },
      { status: "update_available", count: 0 },
    ],
    enabled: 1,
    signed: 1,
    verified: 1,
    total_permissions: 3,
    unique_permissions: 2,
    by_permission: [
      { permission: "assets.read", extensions: 2 },
      { permission: "storage.write", extensions: 1 },
    ],
    total_capabilities: 2,
    generated_at: "2026-01-06T00:00:00Z",
  };

  it("GETs /extensions/stats with both filters and forwards the snapshot untouched", async () => {
    const { fetchImpl, calls } = router({ "/extensions/stats": stats });
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl });

    await expect(
      api.getExtensionStats({ type: "ui", status: "enabled" }),
    ).resolves.toEqual(stats);

    const url = new URL(calls[0] ?? "");
    expect(url.pathname).toBe(`${API_PREFIX}/extensions/stats`);
    expect(url.searchParams.get("type")).toBe("ui");
    expect(url.searchParams.get("status")).toBe("enabled");
  });

  it("omits the filters when no options are supplied", async () => {
    const { fetchImpl, calls } = router({ "/extensions/stats": stats });
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl });

    await expect(api.getExtensionStats()).resolves.toEqual(stats);

    const url = new URL(calls[0] ?? "");
    expect(url.pathname).toBe(`${API_PREFIX}/extensions/stats`);
    expect(url.searchParams.has("type")).toBe(false);
    expect(url.searchParams.has("status")).toBe(false);
  });

  it("normalizes a backend failure into an ApiError", async () => {
    const failing = createHttpApiClient("http://localhost:8000", {
      fetchImpl: (async () =>
        jsonResponse(
          { error: { code: "validation_error", message: "Invalid extension type." } },
          { status: 422 },
        )) as typeof fetch,
    });
    await expect(failing.getExtensionStats({ type: "mystery" as never })).rejects.toMatchObject({
      status: 422,
      code: "validation_error",
      message: "Invalid extension type.",
    });
  });
});

describe("createHttpApiClient /extensions/feed", () => {
  const feed = {
    items: [
      {
        extension_id: "f9c71eba-e91c-5724-ad4e-367cfdb0ad80",
        manifest_id: "comfyui-local-adapter",
        name: "Local ComfyUI adapter",
        version: "1.2.0",
        publisher: "Studio Core",
        type: "provider",
        status: "enabled",
        signed: true,
        verified: true,
        installed_at: "2026-01-06T00:00:00Z",
      },
    ],
    total: 1,
    generated_at: "2026-01-06T00:00:00Z",
  };

  it("GETs /extensions/feed with filters and page and forwards the feed untouched", async () => {
    const { fetchImpl, calls } = router({ "/extensions/feed": feed });
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl });

    await expect(
      api.getExtensionFeed({ type: "provider", status: "enabled", limit: 2 }),
    ).resolves.toEqual(feed);

    const url = new URL(calls[0] ?? "");
    expect(url.pathname).toBe(`${API_PREFIX}/extensions/feed`);
    expect(url.searchParams.get("type")).toBe("provider");
    expect(url.searchParams.get("status")).toBe("enabled");
    expect(url.searchParams.get("limit")).toBe("2");
  });

  it("omits the query string when no filters or page are supplied", async () => {
    const { fetchImpl, calls } = router({ "/extensions/feed": feed });
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl });

    await expect(api.getExtensionFeed()).resolves.toEqual(feed);
    expect(new URL(calls[0] ?? "").search).toBe("");
  });

  it("normalizes a backend failure into an ApiError", async () => {
    const failing = createHttpApiClient("http://localhost:8000", {
      fetchImpl: (async () =>
        jsonResponse(
          { error: { code: "validation_error", message: "Feed limit must be between 1 and 200." } },
          { status: 422 },
        )) as typeof fetch,
    });
    await expect(failing.getExtensionFeed({ limit: 0 })).rejects.toMatchObject({
      status: 422,
      code: "validation_error",
      message: "Feed limit must be between 1 and 200.",
    });
  });
});

describe("createHttpApiClient operation stats", () => {
  const stats = {
    total: 10,
    streaming: 3,
    with_provider: 2,
    without_provider: 8,
    total_settings: 8,
    unique_output_types: 6,
    by_output_type: [
      { asset_type: "video", operations: 3 },
      { asset_type: "image", operations: 2 },
    ],
    by_input_type: [{ asset_type: "image", operations: 6 }],
    generated_at: "2026-01-06T00:00:00Z",
  };

  it("GETs /operations/stats and forwards the snapshot untouched", async () => {
    const { fetchImpl, calls } = router({ "/operations/stats": stats });
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl });

    await expect(api.getOperationStats()).resolves.toEqual(stats);

    const url = new URL(calls[0] ?? "");
    expect(url.pathname).toBe(`${API_PREFIX}/operations/stats`);
    expect(url.search).toBe("");
  });

  it("normalizes a backend failure into an ApiError", async () => {
    const failing = createHttpApiClient("http://localhost:8000", {
      fetchImpl: (async () =>
        jsonResponse(
          { error: { code: "internal_error", message: "boom" } },
          { status: 500 },
        )) as typeof fetch,
    });
    await expect(failing.getOperationStats()).rejects.toMatchObject({
      status: 500,
      code: "internal_error",
      message: "boom",
    });
  });
});

describe("createHttpApiClient operation feed", () => {
  const feed = {
    items: [
      {
        operation_id: "image-to-video",
        title: "Image to video",
        description: "Animate a first frame.",
        schema_version: "v1",
        input_types: ["image"],
        output_types: ["video"],
        settings_count: 2,
        streaming: true,
        provider_ids: ["prov-a"],
        provider_count: 1,
      },
    ],
    total: 1,
    generated_at: "2026-01-06T00:00:00Z",
  };

  it("GETs /operations/feed with filters and page and forwards the feed untouched", async () => {
    const { fetchImpl, calls } = router({ "/operations/feed": feed });
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl });

    await expect(
      api.getOperationFeed({ streaming: false, provider_id: "prov-a", limit: 2 }),
    ).resolves.toEqual(feed);

    const url = new URL(calls[0] ?? "");
    expect(url.pathname).toBe(`${API_PREFIX}/operations/feed`);
    expect(url.searchParams.get("streaming")).toBe("false");
    expect(url.searchParams.get("provider_id")).toBe("prov-a");
    expect(url.searchParams.get("limit")).toBe("2");
  });

  it("omits the query string when no filters or page are supplied", async () => {
    const { fetchImpl, calls } = router({ "/operations/feed": feed });
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl });

    await expect(api.getOperationFeed()).resolves.toEqual(feed);
    expect(new URL(calls[0] ?? "").search).toBe("");
  });

  it("normalizes a backend failure into an ApiError", async () => {
    const failing = createHttpApiClient("http://localhost:8000", {
      fetchImpl: (async () =>
        jsonResponse(
          { error: { code: "validation_error", message: "Feed limit must be between 1 and 200." } },
          { status: 422 },
        )) as typeof fetch,
    });
    await expect(failing.getOperationFeed({ limit: 0 })).rejects.toMatchObject({
      status: 422,
      code: "validation_error",
      message: "Feed limit must be between 1 and 200.",
    });
  });
});

describe("createHttpApiClient asset feed", () => {
  const feed = {
    items: [
      {
        asset_id: "0b5c1e2a-2000-4000-8000-000000000001",
        project_id: "11111111-1111-4111-8111-111111111111",
        project_name: "Moonshot",
        type: "image",
        name: "Design frame",
        status: "ready",
        version: 3,
        size_bytes: 2_048_000,
        created_at: "2026-01-05T00:00:00Z",
        updated_at: "2026-01-06T00:00:00Z",
      },
    ],
    total: 8,
    generated_at: "2026-01-06T00:00:00Z",
  };

  it("GETs /assets/feed with the scope and page and forwards the feed untouched", async () => {
    const { fetchImpl, calls } = router({ "/assets/feed": feed });
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl });

    await expect(
      api.getAssetFeed({ projectId: "11111111-1111-4111-8111-111111111111", limit: 2 }),
    ).resolves.toEqual(feed);

    const url = new URL(calls[0] ?? "");
    expect(url.pathname).toBe(`${API_PREFIX}/assets/feed`);
    expect(url.searchParams.get("project_id")).toBe("11111111-1111-4111-8111-111111111111");
    expect(url.searchParams.get("limit")).toBe("2");
  });

  it("omits the query string when no scope or page is supplied", async () => {
    const { fetchImpl, calls } = router({ "/assets/feed": feed });
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl });

    await expect(api.getAssetFeed()).resolves.toEqual(feed);
    expect(new URL(calls[0] ?? "").search).toBe("");
  });

  it("normalizes a backend failure into an ApiError", async () => {
    const failing = createHttpApiClient("http://localhost:8000", {
      fetchImpl: (async () =>
        jsonResponse(
          { error: { code: "project_not_found", message: "Project not found." } },
          { status: 404 },
        )) as typeof fetch,
    });
    await expect(failing.getAssetFeed({ projectId: "bad" })).rejects.toMatchObject({
      status: 404,
      code: "project_not_found",
      message: "Project not found.",
    });
  });
});

describe("createHttpApiClient job feed", () => {
  const feed = {
    items: [
      {
        job_id: "0b5c1e2a-3000-4000-8000-000000000001",
        project_id: "11111111-1111-4111-8111-111111111111",
        project_name: "Moonshot",
        operation_id: "dataset-prep",
        status: "running",
        progress: 0.45,
        attempt: 4,
        created_by: "0b5c1e2a-4000-4000-8000-000000000001",
        created_at: "2026-01-05T00:00:00Z",
        started_at: "2026-01-05T00:01:00Z",
        finished_at: null,
      },
    ],
    total: 8,
    generated_at: "2026-01-06T00:00:00Z",
  };

  it("GETs /jobs/feed with the scope, status and page and forwards the feed untouched", async () => {
    const { fetchImpl, calls } = router({ "/jobs/feed": feed });
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl });

    await expect(
      api.getJobFeed({
        projectId: "11111111-1111-4111-8111-111111111111",
        status: "running",
        limit: 2,
      }),
    ).resolves.toEqual(feed);

    const url = new URL(calls[0] ?? "");
    expect(url.pathname).toBe(`${API_PREFIX}/jobs/feed`);
    expect(url.searchParams.get("project_id")).toBe("11111111-1111-4111-8111-111111111111");
    expect(url.searchParams.get("status")).toBe("running");
    expect(url.searchParams.get("limit")).toBe("2");
  });

  it("omits the query string when no scope, status or page is supplied", async () => {
    const { fetchImpl, calls } = router({ "/jobs/feed": feed });
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl });

    await expect(api.getJobFeed()).resolves.toEqual(feed);
    expect(new URL(calls[0] ?? "").search).toBe("");
  });

  it("normalizes a backend failure into an ApiError", async () => {
    const failing = createHttpApiClient("http://localhost:8000", {
      fetchImpl: (async () =>
        jsonResponse(
          { error: { code: "project_not_found", message: "Project not found." } },
          { status: 404 },
        )) as typeof fetch,
    });
    await expect(failing.getJobFeed({ projectId: "bad" })).rejects.toMatchObject({
      status: 404,
      code: "project_not_found",
      message: "Project not found.",
    });
  });
});

describe("createHttpApiClient conversation feed", () => {
  const feed = {
    items: [
      {
        conversation_id: "0b5c1e2a-5000-4000-8000-000000000001",
        project_id: "11111111-1111-4111-8111-111111111111",
        project_name: "Moonshot",
        title: "s01 sequence plan",
        message_count: 3,
        last_message_role: "assistant",
        last_message_excerpt: "Dataset prep is 45% complete.",
        created_at: "2026-01-05T00:00:00Z",
        updated_at: "2026-01-06T00:00:00Z",
      },
    ],
    total: 4,
    generated_at: "2026-01-06T00:00:00Z",
  };

  it("GETs /conversations/feed with the scope and page and forwards the snapshot untouched", async () => {
    const { fetchImpl, calls } = router({ "/conversations/feed": feed });
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl });

    await expect(
      api.getConversationFeed({ projectId: "11111111-1111-4111-8111-111111111111", limit: 2 }),
    ).resolves.toEqual(feed);

    const url = new URL(calls[0] ?? "");
    expect(url.pathname).toBe(`${API_PREFIX}/conversations/feed`);
    expect(url.searchParams.get("project_id")).toBe("11111111-1111-4111-8111-111111111111");
    expect(url.searchParams.get("limit")).toBe("2");
  });

  it("omits the query string when no scope or page is supplied", async () => {
    const { fetchImpl, calls } = router({ "/conversations/feed": feed });
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl });

    await expect(api.getConversationFeed()).resolves.toEqual(feed);
    expect(new URL(calls[0] ?? "").search).toBe("");
  });

  it("normalizes a backend failure into an ApiError", async () => {
    const failing = createHttpApiClient("http://localhost:8000", {
      fetchImpl: (async () =>
        jsonResponse(
          { error: { code: "project_not_found", message: "Project not found." } },
          { status: 404 },
        )) as typeof fetch,
    });
    await expect(failing.getConversationFeed({ projectId: "bad" })).rejects.toMatchObject({
      status: 404,
      code: "project_not_found",
      message: "Project not found.",
    });
  });
});

describe("createHttpApiClient publish feed", () => {
  const feed = {
    items: [
      {
        asset_id: "0b5c1e2a-2000-4000-8000-000000000011",
        asset_name: "moonAstronaut.safetensors",
        asset_type: "lora",
        project_id: "11111111-1111-4111-8111-111111111111",
        project_name: "Moonshot",
        version: 1,
        size_bytes: 2_048_000,
        published_at: "2026-01-06T00:00:00Z",
      },
    ],
    total: 4,
    generated_at: "2026-01-06T00:00:00Z",
  };

  it("GETs /publishes with the scope and page and forwards the snapshot untouched", async () => {
    const { fetchImpl, calls } = router({ "/publishes": feed });
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl });

    await expect(
      api.getPublishFeed({ projectId: "11111111-1111-4111-8111-111111111111", limit: 2 }),
    ).resolves.toEqual(feed);

    const url = new URL(calls[0] ?? "");
    expect(url.pathname).toBe(`${API_PREFIX}/publishes`);
    expect(url.searchParams.get("project_id")).toBe("11111111-1111-4111-8111-111111111111");
    expect(url.searchParams.get("limit")).toBe("2");
  });

  it("omits the query string when no scope or page is supplied", async () => {
    const { fetchImpl, calls } = router({ "/publishes": feed });
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl });

    await expect(api.getPublishFeed()).resolves.toEqual(feed);
    expect(new URL(calls[0] ?? "").search).toBe("");
  });

  it("normalizes a backend failure into an ApiError", async () => {
    const failing = createHttpApiClient("http://localhost:8000", {
      fetchImpl: (async () =>
        jsonResponse(
          { error: { code: "project_not_found", message: "Project not found." } },
          { status: 404 },
        )) as typeof fetch,
    });
    await expect(failing.getPublishFeed({ projectId: "bad" })).rejects.toMatchObject({
      status: 404,
      code: "project_not_found",
      message: "Project not found.",
    });
  });
});

describe("createHttpApiClient upload feed", () => {
  const feed = {
    items: [
      {
        upload_id: "0b5c1e2a-7000-4000-8000-000000000004",
        project_id: "11111111-1111-4111-8111-111111111111",
        project_name: "Moonshot",
        filename: "shot_02_plates.mov",
        content_type: "video/quicktime",
        status: "pending",
        declared_size: 1_400_000,
        size_bytes: 700_000,
        created_at: "2026-01-06T00:00:00Z",
        expires_at: "2026-01-08T00:00:00Z",
      },
    ],
    total: 4,
    generated_at: "2026-01-06T00:00:00Z",
  };

  it("GETs /uploads/feed with the scope and page and forwards the snapshot untouched", async () => {
    const { fetchImpl, calls } = router({ "/uploads/feed": feed });
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl });

    await expect(
      api.getUploadFeed({ projectId: "11111111-1111-4111-8111-111111111111", limit: 2 }),
    ).resolves.toEqual(feed);

    const url = new URL(calls[0] ?? "");
    expect(url.pathname).toBe(`${API_PREFIX}/uploads/feed`);
    expect(url.searchParams.get("project_id")).toBe("11111111-1111-4111-8111-111111111111");
    expect(url.searchParams.get("limit")).toBe("2");
  });

  it("omits the query string when no scope or page is supplied", async () => {
    const { fetchImpl, calls } = router({ "/uploads/feed": feed });
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl });

    await expect(api.getUploadFeed()).resolves.toEqual(feed);
    expect(new URL(calls[0] ?? "").search).toBe("");
  });

  it("normalizes a backend failure into an ApiError", async () => {
    const failing = createHttpApiClient("http://localhost:8000", {
      fetchImpl: (async () =>
        jsonResponse(
          { error: { code: "project_not_found", message: "Project not found." } },
          { status: 404 },
        )) as typeof fetch,
    });
    await expect(failing.getUploadFeed({ projectId: "bad" })).rejects.toMatchObject({
      status: 404,
      code: "project_not_found",
      message: "Project not found.",
    });
  });
});

describe("createHttpApiClient organization overview (C226)", () => {
  const orgId = "11111111-1111-4111-8111-111111111111";
  const overview = {
    org_id: orgId,
    name: "Studio Northlight",
    slug: "studio-northlight",
    created_at: "2026-01-01T00:00:00.000Z",
    counts: { members: 3, projects: 2 },
    by_role: [
      { role: "owner", members: 1 },
      { role: "admin", members: 0 },
      { role: "member", members: 2 },
      { role: "viewer", members: 0 },
    ],
    recent_members: [],
    recent_projects: [],
    generated_at: "2026-01-04T00:00:00.000Z",
  };

  it("GETs the org overview path and forwards the recent-limit query", async () => {
    const { fetchImpl, calls } = router({
      [`/orgs/${orgId}/overview`]: overview,
    });
    const api = createHttpApiClient("http://localhost:8000", { fetchImpl });

    await expect(api.getOrganizationOverview(orgId, { recentLimit: 3 })).resolves.toEqual(overview);
    await expect(api.getOrganizationOverview(orgId)).resolves.toEqual(overview);

    const first = new URL(calls[0] ?? "");
    expect(first.pathname).toBe(`${API_PREFIX}/orgs/${orgId}/overview`);
    expect(first.searchParams.get("recent_limit")).toBe("3");
    const second = new URL(calls[1] ?? "");
    expect(second.search).toBe("");
  });

  it("maps a 404 to undefined but surfaces other failures", async () => {
    const missing = createHttpApiClient("http://localhost:8000", {
      fetchImpl: (async () =>
        jsonResponse(
          { error: { code: "organization_not_found", message: "missing" } },
          { status: 404 },
        )) as typeof fetch,
    });
    await expect(missing.getOrganizationOverview(orgId)).resolves.toBeUndefined();

    const failing = createHttpApiClient("http://localhost:8000", {
      fetchImpl: (async () =>
        jsonResponse({ error: { code: "internal_error", message: "boom" } }, {
          status: 500,
        })) as typeof fetch,
    });
    await expect(failing.getOrganizationOverview(orgId)).rejects.toMatchObject({
      status: 500,
      code: "internal_error",
    });
  });
});
