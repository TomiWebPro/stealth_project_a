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
