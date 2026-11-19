import { afterEach, describe, expect, it } from "vitest";

import type { StreamEvent } from "../../types";
import {
  ASSETS,
  ASSET_RELATIONSHIPS,
  COMMENTS,
  CONVERSATIONS,
  EXTENSIONS,
  JOBS,
  ORGANIZATIONS,
  ORGANIZATION_MEMBERS,
  ORCHESTRATION_PLANS,
  ORCHESTRATION_RUNS,
  PIPELINE_CHAINS,
  PRESENCE,
  PROJECTS,
  PROVIDERS,
  REFERENCE_NOW,
  USERS,
} from "./data";
import {
  clearMockFailures,
  fetchActivity,
  fetchActivityStats,
  fetchAsset,
  fetchAssetStats,
  fetchAssets,
  fetchAssetsByProject,
  fetchCapabilities,
  fetchCollaborationStats,
  fetchConversation,
  fetchComments,
  fetchConversations,
  fetchConversationStats,
  fetchCurrentUser,
  fetchDashboard,
  fetchExtension,
  fetchExtensions,
  fetchExtensionStats,
  fetchHomeSummary,
  fetchJob,
  fetchJobs,
  fetchJobsByProject,
  fetchLineageStats,
  fetchMessages,
  fetchOperations,
  fetchOrganizationStats,
  fetchPipelineStats,
  openConversationStream,
  sendMessage,
  setMockFailure,
  fetchOrganizations,
  fetchOrchestrationRun,
  fetchOrchestrationStats,
  fetchPresence,
  fetchProject,
  fetchProjectAudit,
  fetchProjectDetail,
  fetchProjectStats,
  fetchProjects,
  fetchProvider,
  fetchProviders,
  fetchProviderStats,
  fetchRecentAssets,
  fetchSearch,
  fetchStorageStats,
  fetchWorkflowTemplates,
  resetMockAssets,
  updateAsset,
} from "./mockApi";

afterEach(() => {
  resetMockAssets();
  clearMockFailures();
});

describe("mock API dashboard", () => {
  it("derives a populated snapshot from the authoritative seeds", async () => {
    const summary = await fetchDashboard();
    expect(summary.counts.projects).toBe(PROJECTS.length);
    expect(summary.counts.assets).toBeGreaterThan(0);
    expect(summary.recent_assets?.length).toBeGreaterThan(0);
    expect(summary.generated_at).toBeTruthy();
  });

  it("honours recent_limit and mirrors router validation", async () => {
    expect((await fetchDashboard({ recentLimit: 2 })).recent_assets).toHaveLength(2);
    await expect(fetchDashboard({ recentLimit: 0 })).rejects.toMatchObject({
      status: 422,
      code: "validation_error",
    });
    await expect(fetchDashboard({ recentLimit: 51 })).rejects.toMatchObject({ status: 422 });
  });

  it("surfaces the injectable failure state", async () => {
    setMockFailure("dashboard");
    await expect(fetchDashboard()).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });
  });
});

describe("mock API workspace activity (C29)", () => {
  const filmId = PROJECTS.find((project) => project.name.startsWith("Moonshot"))?.id ?? "";
  const emptyId = PROJECTS.find((project) => project.name.startsWith("Blank Slate"))?.id ?? "";
  const missingId = "00000000-0000-4000-8000-000000000000";

  it("derives a populated, newest-first feed from the authoritative seeds", async () => {
    const feed = await fetchActivity();
    expect((feed.events ?? []).length).toBeGreaterThan(0);
    expect(feed.total).toBeGreaterThanOrEqual(feed.events?.length ?? 0);
    const timestamps = (feed.events ?? []).map((event) => Date.parse(event.timestamp));
    expect(timestamps).toEqual([...timestamps].sort((a, b) => b - a));
    expect(new Set((feed.events ?? []).map((event) => event.kind)).size).toBeGreaterThan(1);
  });

  it("scopes to a project, filters by kind and caps with limit", async () => {
    const scoped = await fetchActivity({ projectId: filmId });
    expect((scoped.events ?? []).every((event) => event.project_id === filmId)).toBe(true);

    const jobsOnly = await fetchActivity({ projectId: filmId, kind: "job", limit: 2 });
    expect(jobsOnly.events).toHaveLength(2);
    expect(jobsOnly.events?.every((event) => event.kind === "job")).toBe(true);
    expect(jobsOnly.total).toBeGreaterThanOrEqual(jobsOnly.events?.length ?? 0);
  });

  it("returns an empty feed for a project with no activity and 404s for an unknown one", async () => {
    expect(await fetchActivity({ projectId: emptyId })).toEqual({ events: [], total: 0 });
    await expect(fetchActivity({ projectId: missingId })).rejects.toMatchObject({
      status: 404,
      code: "not_found",
    });
  });

  it("mirrors router validation and surfaces the injected failure state", async () => {
    await expect(fetchActivity({ kind: "bogus" as never })).rejects.toMatchObject({
      status: 422,
      code: "validation_error",
    });
    await expect(fetchActivity({ limit: 0 })).rejects.toMatchObject({ status: 422 });

    setMockFailure("activity");
    await expect(fetchActivity()).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });
  });
});

describe("mock API conversation stats (C45 follow-up)", () => {
  const filmId = PROJECTS.find((project) => project.name.startsWith("Moonshot"))?.id ?? "";
  const emptyId = PROJECTS.find((project) => project.name.startsWith("Blank Slate"))?.id ?? "";
  const missingId = "00000000-0000-4000-8000-000000000000";

  it("derives a populated snapshot from the authoritative seeds", async () => {
    const stats = await fetchConversationStats();
    expect(stats.total_conversations).toBe(3);
    expect(stats.total_messages).toBe(5);
    expect(stats.average_messages_per_conversation).toBeCloseTo(5 / 3, 3);
    expect(stats.last_activity_at).toBeTruthy();
    expect(stats.by_role?.reduce((sum, entry) => sum + entry.count, 0)).toBe(5);
    expect(stats.by_status?.reduce((sum, entry) => sum + entry.count, 0)).toBe(5);
    expect(stats.generated_at).toBeTruthy();
  });

  it("scopes conversations and messages to one project", async () => {
    const scoped = await fetchConversationStats({ projectId: filmId });
    const filmConversations = CONVERSATIONS.filter(
      (conversation) => conversation.project_id === filmId,
    );
    expect(scoped.total_conversations).toBe(filmConversations.length);
    expect(scoped.total_messages).toBeGreaterThan(0);
    expect(scoped.total_messages).toBeLessThan(5);
  });

  it("returns an empty snapshot for a project whose conversation has no messages", async () => {
    const stats = await fetchConversationStats({ projectId: emptyId });
    expect(stats.total_conversations).toBe(1);
    expect(stats.total_messages).toBe(0);
    expect(stats.average_messages_per_conversation).toBe(0);
    expect(stats.last_activity_at).toBeTruthy();
  });

  it("mirrors router validation, 404s unknown projects and surfaces the injected failure", async () => {
    await expect(fetchConversationStats({ projectId: "not-a-uuid" })).rejects.toMatchObject({
      status: 422,
      code: "validation_error",
    });
    await expect(fetchConversationStats({ projectId: missingId })).rejects.toMatchObject({
      status: 404,
      code: "not_found",
    });

    setMockFailure("conversationStats");
    await expect(fetchConversationStats()).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });
  });
});

describe("mock API asset stats (C49 follow-up)", () => {
  const filmId = PROJECTS.find((project) => project.name.startsWith("Moonshot"))?.id ?? "";
  const emptyId = PROJECTS.find((project) => project.name.startsWith("Blank Slate"))?.id ?? "";
  const missingId = "00000000-0000-4000-8000-000000000000";

  it("derives a populated snapshot from the authoritative asset seeds", async () => {
    const stats = await fetchAssetStats();
    expect(stats.total).toBe(ASSETS.filter((asset) => asset.status !== "deleted").length);
    expect(stats.total_size_bytes).toBeGreaterThan(0);
    expect(stats.total_versions).toBeGreaterThanOrEqual(stats.total);
    expect(stats.newest_asset_at).toBeTruthy();
    expect(stats.by_type?.reduce((sum, entry) => sum + entry.count, 0)).toBe(stats.total);
    expect(stats.by_status?.reduce((sum, entry) => sum + entry.count, 0)).toBe(stats.total);
    expect(stats.generated_at).toBeTruthy();
  });

  it("scopes every metric to one project and yields zeros for an empty one", async () => {
    const scoped = await fetchAssetStats({ projectId: filmId });
    expect(scoped.total).toBe(
      ASSETS.filter(
        (asset) => asset.project_id === filmId && asset.status !== "deleted",
      ).length,
    );
    expect(
      (scoped.by_type ?? []).reduce((sum, entry) => sum + entry.count, 0),
    ).toBe(scoped.total);

    const empty = await fetchAssetStats({ projectId: emptyId });
    expect(empty.total).toBe(0);
    expect(empty.newest_asset_at).toBeNull();
    expect(empty.total_size_bytes).toBe(0);
  });

  it("mirrors router validation, 404s unknown projects and surfaces the injected failure", async () => {
    await expect(fetchAssetStats({ projectId: "not-a-uuid" })).rejects.toMatchObject({
      status: 422,
      code: "validation_error",
    });
    await expect(fetchAssetStats({ projectId: missingId })).rejects.toMatchObject({
      status: 404,
      code: "not_found",
    });

    setMockFailure("assetStats");
    await expect(fetchAssetStats()).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });
  });
});

describe("mock API project stats (C53 follow-up)", () => {
  const orgId = PROJECTS[0]?.org_id ?? "";

  it("derives a populated snapshot from the authoritative seeds", async () => {
    const stats = await fetchProjectStats();
    expect(stats.total).toBe(PROJECTS.length);
    expect(stats.active + stats.archived).toBe(PROJECTS.length);
    expect(stats.by_lifecycle).toEqual([
      { lifecycle: "active", count: stats.active },
      { lifecycle: "archived", count: stats.archived },
    ]);
    expect(stats.total_assets).toBeGreaterThan(0);
    expect(stats.total_conversations).toBeGreaterThan(0);
    expect(stats.total_jobs).toBeGreaterThan(0);
    expect(stats.newest_project_at).toBeTruthy();
    expect(stats.generated_at).toBe(REFERENCE_NOW);
  });

  it("scopes every metric to one organization and zeroes an unknown org", async () => {
    const scoped = await fetchProjectStats({ orgId });
    expect(scoped.total).toBe(PROJECTS.filter((project) => project.org_id === orgId).length);

    const unknown = await fetchProjectStats({ orgId: "00000000-0000-4000-8000-000000000000" });
    expect(unknown.total).toBe(0);
    expect(unknown.by_lifecycle).toEqual([
      { lifecycle: "active", count: 0 },
      { lifecycle: "archived", count: 0 },
    ]);
    expect(unknown.newest_project_at).toBeNull();
  });

  it("mirrors router validation and surfaces the injected failure", async () => {
    await expect(fetchProjectStats({ orgId: "not-a-uuid" })).rejects.toMatchObject({
      status: 422,
      code: "validation_error",
    });

    setMockFailure("projectStats");
    await expect(fetchProjectStats()).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });
  });
});

describe("mock API organization stats (C69 follow-up)", () => {
  const orgId = ORGANIZATIONS[0]?.id ?? "";

  it("derives a populated snapshot from the authoritative auth seeds", async () => {
    const stats = await fetchOrganizationStats();
    expect(stats.total_organizations).toBe(ORGANIZATIONS.length);
    expect(stats.total_members).toBe(ORGANIZATION_MEMBERS.length);
    expect(stats.total_users).toBe(USERS.length);
    expect(stats.by_role?.reduce((sum, entry) => sum + entry.members, 0)).toBe(
      ORGANIZATION_MEMBERS.length,
    );
    expect(stats.by_organization?.reduce((sum, entry) => sum + entry.members, 0)).toBe(
      ORGANIZATION_MEMBERS.length,
    );
    expect(stats.average_members_per_org).toBe(ORGANIZATION_MEMBERS.length / ORGANIZATIONS.length);
    expect(stats.newest_org_at).toBeTruthy();
    expect(stats.generated_at).toBe(REFERENCE_NOW);
  });

  it("scopes members and orgs to one organization and zeroes an unknown org", async () => {
    const scoped = await fetchOrganizationStats({ orgId });
    expect(scoped.total_organizations).toBe(1);
    expect(scoped.total_members).toBe(ORGANIZATION_MEMBERS.filter((m) => m.org_id === orgId).length);
    expect(scoped.by_organization).toEqual([{ org_id: orgId, members: scoped.total_members }]);

    const unknown = await fetchOrganizationStats({ orgId: "00000000-0000-4000-8000-000000000000" });
    expect(unknown.total_organizations).toBe(0);
    expect(unknown.total_members).toBe(0);
    // The user total stays global even for an unknown org scope.
    expect(unknown.total_users).toBe(USERS.length);
    expect(unknown.by_organization).toEqual([]);
    expect(unknown.newest_org_at).toBeNull();
  });

  it("mirrors router validation and surfaces the injected failure", async () => {
    await expect(fetchOrganizationStats({ orgId: "not-a-uuid" })).rejects.toMatchObject({
      status: 422,
      code: "validation_error",
    });

    setMockFailure("organizationStats");
    await expect(fetchOrganizationStats()).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });
  });
});

describe("mock API pipeline stats (C73 follow-up)", () => {
  const filmId = PROJECTS.find((project) => project.name.startsWith("Moonshot"))?.id ?? "";
  const emptyId = PROJECTS.find((project) => project.name.startsWith("Blank Slate"))?.id ?? "";

  it("derives a populated snapshot from the authoritative chain seeds", async () => {
    const stats = await fetchPipelineStats();
    expect(stats.total_chains).toBe(PIPELINE_CHAINS.length);
    expect(stats.total_jobs).toBe(
      PIPELINE_CHAINS.reduce(
        (sum, item) => sum + (item.job_ids?.length ?? (item.job_id ? 1 : 0)),
        0,
      ),
    );
    expect(stats.by_kind?.map((entry) => entry.kind)).toEqual(["training", "shot", "splat"]);
    expect(stats.by_kind?.reduce((sum, entry) => sum + entry.chains, 0)).toBe(
      PIPELINE_CHAINS.length,
    );
    expect((stats.by_project ?? []).length).toBeGreaterThan(0);
    expect(stats.newest_chain_at).toBeTruthy();
    expect(stats.generated_at).toBe(REFERENCE_NOW);
  });

  it("scopes the snapshot to one project and zero-fills an unseeded project", async () => {
    const scoped = await fetchPipelineStats({ projectId: filmId });
    expect(scoped.total_chains).toBe(PIPELINE_CHAINS.filter((c) => c.project_id === filmId).length);
    expect(scoped.by_project).toEqual([{ project_id: filmId, chains: scoped.total_chains }]);

    const empty = await fetchPipelineStats({ projectId: emptyId });
    expect(empty.total_chains).toBe(0);
    expect(empty.by_project).toEqual([]);
    expect(empty.newest_chain_at).toBeNull();
    expect(empty.by_kind?.every((entry) => entry.chains === 0)).toBe(true);
  });

  it("mirrors router validation, the unknown-project 404 and the injected failure", async () => {
    await expect(fetchPipelineStats({ projectId: "not-a-uuid" })).rejects.toMatchObject({
      status: 422,
      code: "validation_error",
    });
    await expect(
      fetchPipelineStats({ projectId: "00000000-0000-4000-8000-000000000000" }),
    ).rejects.toMatchObject({ status: 404, code: "not_found" });

    setMockFailure("pipelineStats");
    await expect(fetchPipelineStats()).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });
  });
});

describe("mock API lineage stats (C77 follow-up)", () => {
  const filmId = PROJECTS.find((project) => project.name.startsWith("Moonshot"))?.id ?? "";
  const emptyId = PROJECTS.find((project) => project.name.startsWith("Blank Slate"))?.id ?? "";

  it("derives a populated snapshot from the authoritative relationship seeds", async () => {
    const stats = await fetchLineageStats();
    // The unknown-source link is excluded; every other seed has a live source.
    expect(stats.total_relationships).toBe(
      ASSET_RELATIONSHIPS.filter((rel) =>
        ASSETS.some((asset) => asset.id === rel.from_asset_id && asset.status !== "deleted"),
      ).length,
    );
    expect(stats.by_type?.reduce((sum, entry) => sum + entry.count, 0)).toBe(
      stats.total_relationships,
    );
    expect(stats.by_type?.map((entry) => entry.type)).toEqual([
      "derived_from",
      "variant_of",
      "uses_input",
      "related_to",
      "duplicate_of",
    ]);
    expect((stats.by_project ?? []).length).toBeGreaterThan(0);
    expect(stats.total_linked_assets).toBeGreaterThan(0);
    expect(stats.newest_relationship_at).toBeTruthy();
    expect(stats.generated_at).toBe(REFERENCE_NOW);
  });

  it("scopes the snapshot to one project and zero-fills an unseeded project", async () => {
    const scoped = await fetchLineageStats({ projectId: filmId });
    expect(scoped.by_project).toEqual([{ project_id: filmId, relationships: scoped.total_relationships }]);
    expect(scoped.total_relationships).toBeGreaterThan(0);

    const empty = await fetchLineageStats({ projectId: emptyId });
    expect(empty.total_relationships).toBe(0);
    expect(empty.total_linked_assets).toBe(0);
    expect(empty.by_project).toEqual([]);
    expect(empty.newest_relationship_at).toBeNull();
    expect(empty.by_type?.every((entry) => entry.count === 0)).toBe(true);
  });

  it("mirrors router validation, the unknown-project 404 and the injected failure", async () => {
    await expect(fetchLineageStats({ projectId: "not-a-uuid" })).rejects.toMatchObject({
      status: 422,
      code: "validation_error",
    });
    await expect(
      fetchLineageStats({ projectId: "00000000-0000-4000-8000-000000000000" }),
    ).rejects.toMatchObject({ status: 404, code: "not_found" });

    setMockFailure("lineageStats");
    await expect(fetchLineageStats()).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });
  });
});

describe("mock API collaboration stats (C81 follow-up)", () => {
  const filmId = PROJECTS.find((project) => project.name.startsWith("Moonshot"))?.id ?? "";
  const emptyId = PROJECTS.find((project) => project.name.startsWith("Blank Slate"))?.id ?? "";

  it("derives a populated snapshot from the authoritative presence/comment seeds", async () => {
    const stats = await fetchCollaborationStats();
    expect(stats.total_presence).toBe(PRESENCE.length);
    expect(stats.total_comments).toBe(COMMENTS.length);
    expect(stats.by_state?.reduce((sum, entry) => sum + entry.count, 0)).toBe(PRESENCE.length);
    expect(stats.by_state?.map((entry) => entry.state)).toEqual(["online", "away", "offline"]);
    expect((stats.by_project ?? []).length).toBeGreaterThan(0);
    expect(stats.total_participants).toBeGreaterThan(0);
    expect(stats.newest_presence_at).toBeTruthy();
    expect(stats.newest_comment_at).toBeTruthy();
    expect(stats.generated_at).toBe(REFERENCE_NOW);
  });

  it("scopes the snapshot to one project and zero-fills an unseeded project", async () => {
    const scoped = await fetchCollaborationStats({ projectId: filmId });
    expect(scoped.by_project).toEqual([
      {
        project_id: filmId,
        comments: COMMENTS.filter((comment) => comment.project_id === filmId).length,
        presence: PRESENCE.filter((entry) => entry.project_id === filmId).length,
      },
    ]);
    expect(scoped.total_presence).toBeGreaterThan(0);

    const empty = await fetchCollaborationStats({ projectId: emptyId });
    expect(empty.total_presence).toBe(0);
    expect(empty.total_comments).toBe(0);
    expect(empty.total_participants).toBe(0);
    expect(empty.by_project).toEqual([]);
    expect(empty.newest_presence_at).toBeNull();
    expect(empty.newest_comment_at).toBeNull();
    expect(empty.by_state?.every((entry) => entry.count === 0)).toBe(true);
  });

  it("mirrors router validation, the unknown-project 404 and the injected failure", async () => {
    await expect(fetchCollaborationStats({ projectId: "not-a-uuid" })).rejects.toMatchObject({
      status: 422,
      code: "validation_error",
    });
    await expect(
      fetchCollaborationStats({ projectId: "00000000-0000-4000-8000-000000000000" }),
    ).rejects.toMatchObject({ status: 404, code: "not_found" });

    setMockFailure("collaborationStats");
    await expect(fetchCollaborationStats()).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });
  });
});

describe("mock API activity stats (C89 follow-up)", () => {
  const filmId = PROJECTS.find((project) => project.name.startsWith("Moonshot"))?.id ?? "";
  const emptyId = PROJECTS.find((project) => project.name.startsWith("Blank Slate"))?.id ?? "";
  const publishCount = ASSETS.filter(
    (asset) => asset.metadata?.["publish_receipt"] !== undefined,
  ).length;

  it("derives a populated snapshot from the authoritative activity seeds", async () => {
    const stats = await fetchActivityStats();
    expect(stats.total_events).toBe(ASSETS.length + publishCount + JOBS.length + COMMENTS.length);
    expect(stats.by_kind).toEqual([
      { kind: "asset", count: ASSETS.length },
      { kind: "publish", count: publishCount },
      { kind: "job", count: JOBS.length },
      { kind: "comment", count: COMMENTS.length },
    ]);
    expect(stats.total_participants).toBeGreaterThan(0);
    expect((stats.by_project ?? []).length).toBeGreaterThan(0);
    expect(stats.newest_event_at).toBeTruthy();
    expect(stats.generated_at).toBe(REFERENCE_NOW);
  });

  it("scopes the snapshot to one project and zero-fills an unseeded project", async () => {
    const scoped = await fetchActivityStats({ projectId: filmId });
    expect(scoped.by_project).toEqual([
      {
        project_id: filmId,
        events: expect.any(Number),
        participants: expect.any(Number),
      },
    ]);
    expect(scoped.by_project?.[0]?.events).toBeGreaterThan(0);
    expect(scoped.total_events).toBe(scoped.by_project?.[0]?.events);

    const empty = await fetchActivityStats({ projectId: emptyId });
    expect(empty.total_events).toBe(0);
    expect(empty.total_participants).toBe(0);
    expect(empty.by_project).toEqual([]);
    expect(empty.newest_event_at).toBeNull();
    expect(empty.by_kind?.every((entry) => entry.count === 0)).toBe(true);
  });

  it("mirrors router validation, the unknown-project 404 and the injected failure", async () => {
    await expect(fetchActivityStats({ projectId: "not-a-uuid" })).rejects.toMatchObject({
      status: 422,
      code: "validation_error",
    });
    await expect(
      fetchActivityStats({ projectId: "00000000-0000-4000-8000-000000000000" }),
    ).rejects.toMatchObject({ status: 404, code: "not_found" });

    setMockFailure("activityStats");
    await expect(fetchActivityStats()).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });
  });
});

describe("mock API orchestration stats (C85 follow-up)", () => {
  const filmId = PROJECTS.find((project) => project.name.startsWith("Moonshot"))?.id ?? "";
  const emptyId = PROJECTS.find((project) => project.name.startsWith("Blank Slate"))?.id ?? "";

  it("derives a populated snapshot from the authoritative plan/run seeds", async () => {
    const stats = await fetchOrchestrationStats();
    expect(stats.total_plans).toBe(ORCHESTRATION_PLANS.length);
    expect(stats.total_runs).toBe(ORCHESTRATION_RUNS.length);
    expect(stats.total_steps).toBe(
      ORCHESTRATION_PLANS.reduce((sum, plan) => sum + (plan.steps ?? []).length, 0),
    );
    expect(stats.total_jobs_linked).toBe(
      ORCHESTRATION_RUNS.reduce((sum, run) => sum + (run.job_ids ?? []).length, 0),
    );
    expect(stats.by_stage?.map((entry) => entry.stage)).toEqual([
      "plan",
      "resolve",
      "submit",
      "await",
      "collect",
      "done",
    ]);
    expect(stats.by_stage?.reduce((sum, entry) => sum + entry.count, 0)).toBe(
      ORCHESTRATION_RUNS.length,
    );
    expect((stats.by_project ?? []).length).toBeGreaterThan(0);
    expect(stats.newest_plan_at).toBeTruthy();
    expect(stats.newest_run_at).toBeTruthy();
    expect(stats.generated_at).toBe(REFERENCE_NOW);
  });

  it("scopes the snapshot to one project and zero-fills an unseeded project", async () => {
    const scoped = await fetchOrchestrationStats({ projectId: filmId });
    expect(scoped.by_project).toEqual([
      {
        project_id: filmId,
        plans: ORCHESTRATION_PLANS.filter((plan) => plan.project_id === filmId).length,
        runs: ORCHESTRATION_RUNS.filter(
          (run) => ORCHESTRATION_PLANS.some((plan) => plan.plan_id === run.plan_id && plan.project_id === filmId),
        ).length,
      },
    ]);
    expect(scoped.total_plans).toBeGreaterThan(0);

    const empty = await fetchOrchestrationStats({ projectId: emptyId });
    expect(empty.total_plans).toBe(0);
    expect(empty.total_runs).toBe(0);
    expect(empty.total_steps).toBe(0);
    expect(empty.total_jobs_linked).toBe(0);
    expect(empty.by_project).toEqual([]);
    expect(empty.newest_plan_at).toBeNull();
    expect(empty.newest_run_at).toBeNull();
    expect(empty.by_stage?.every((entry) => entry.count === 0)).toBe(true);
  });

  it("mirrors router validation, the unknown-project 404 and the injected failure", async () => {
    await expect(fetchOrchestrationStats({ projectId: "not-a-uuid" })).rejects.toMatchObject({
      status: 422,
      code: "validation_error",
    });
    await expect(
      fetchOrchestrationStats({ projectId: "00000000-0000-4000-8000-000000000000" }),
    ).rejects.toMatchObject({ status: 404, code: "not_found" });

    setMockFailure("orchestrationStats");
    await expect(fetchOrchestrationStats()).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });
  });
});

describe("mock API provider stats (C57 follow-up)", () => {
  it("derives a populated snapshot from the authoritative provider seeds", async () => {
    const stats = await fetchProviderStats();
    expect(stats.total).toBe(PROVIDERS.length);
    expect(stats.available + stats.degraded + stats.unavailable).toBe(PROVIDERS.length);
    expect(stats.by_status).toEqual([
      { status: "available", count: stats.available },
      { status: "unavailable", count: stats.unavailable },
      { status: "degraded", count: stats.degraded },
    ]);
    expect(stats.by_location ?? []).toHaveLength(3);
    expect(stats.total_capabilities).toBeGreaterThan(0);
    expect(stats.unique_operations).toBeGreaterThan(0);
    expect(stats.by_operation ?? []).toHaveLength(stats.unique_operations);
    expect(stats.generated_at).toBe(REFERENCE_NOW);
  });

  it("narrows the snapshot to one location/status and zero-fills an empty slice", async () => {
    const cloud = await fetchProviderStats({ location: "cloud" });
    expect(cloud.total).toBe(PROVIDERS.filter((provider) => provider.location === "cloud").length);
    expect(cloud.by_location).toEqual([
      { location: "local", count: 0 },
      { location: "studio", count: 0 },
      { location: "cloud", count: cloud.total },
    ]);

    const degraded = await fetchProviderStats({ status: "degraded" });
    expect(degraded.total).toBe(PROVIDERS.filter((provider) => provider.status === "degraded").length);
    expect(degraded.available).toBe(0);
    expect(degraded.degraded).toBe(degraded.total);

    const empty = await fetchProviderStats({ location: "studio", status: "unavailable" });
    expect(empty.total).toBe(0);
    expect(empty.by_operation).toEqual([]);
  });

  it("mirrors router validation and surfaces the injected failure", async () => {
    await expect(fetchProviderStats({ location: "moon" as never })).rejects.toMatchObject({
      status: 422,
      code: "validation_error",
    });
    await expect(fetchProviderStats({ status: "busy" as never })).rejects.toMatchObject({
      status: 422,
      code: "validation_error",
    });

    setMockFailure("providerStats");
    await expect(fetchProviderStats()).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });
  });
});

describe("mock API extension stats (C61 follow-up)", () => {
  it("derives a populated snapshot from the authoritative extension seeds", async () => {
    const stats = await fetchExtensionStats();
    expect(stats.total_registered).toBe(EXTENSIONS.length);
    expect(stats.total_installed).toBe(EXTENSIONS.length);
    expect(stats.by_type?.filter((entry) => entry.count > 0)).toHaveLength(
      new Set(EXTENSIONS.map((extension) => extension.manifest.type)).size,
    );
    expect(stats.enabled).toBe(EXTENSIONS.filter((extension) => extension.status === "enabled").length);
    expect(stats.signed).toBe(EXTENSIONS.filter((extension) => extension.signed).length);
    expect(stats.verified).toBe(EXTENSIONS.filter((extension) => extension.verified).length);
    expect(stats.unique_permissions).toBeGreaterThan(0);
    expect(stats.by_permission ?? []).toHaveLength(stats.unique_permissions);
    expect(stats.total_capabilities).toBeGreaterThan(0);
    expect(stats.generated_at).toBe(REFERENCE_NOW);
  });

  it("narrows the type/status slices independently and zero-fills an empty slice", async () => {
    const ui = await fetchExtensionStats({ type: "ui" });
    expect(ui.total_registered).toBe(EXTENSIONS.filter((extension) => extension.manifest.type === "ui").length);
    expect(ui.total_installed).toBe(EXTENSIONS.length);

    const enabled = await fetchExtensionStats({ status: "enabled" });
    expect(enabled.total_installed).toBe(EXTENSIONS.filter((extension) => extension.status === "enabled").length);
    expect(enabled.total_registered).toBe(EXTENSIONS.length);

    const empty = await fetchExtensionStats({ type: "bundle", status: "update_available" });
    expect(empty.total_registered).toBe(0);
    expect(empty.total_installed).toBe(0);
    expect(empty.by_permission).toEqual([]);
  });

  it("mirrors router validation and surfaces the injected failure", async () => {
    await expect(fetchExtensionStats({ type: "mystery" as never })).rejects.toMatchObject({
      status: 422,
      code: "validation_error",
    });
    await expect(fetchExtensionStats({ status: "bogus" as never })).rejects.toMatchObject({
      status: 422,
      code: "validation_error",
    });

    setMockFailure("extensionStats");
    await expect(fetchExtensionStats()).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });
  });
});

describe("mock API home summary", () => {
  it("includes only active (non-archived) projects", async () => {
    const summary = await fetchHomeSummary();

    expect(summary.projects.length).toBeGreaterThan(0);
    // "Archive 2025" is the only archived seed project.
    expect(summary.projects.some((project) => project.name.startsWith("Archive"))).toBe(false);
  });

  it("counts assets per project", async () => {
    const summary = await fetchHomeSummary();

    for (const project of summary.projects) {
      expect(project.assetCount).toBeGreaterThanOrEqual(0);
    }
  });

  it("returns most recent assets first, capped at six", async () => {
    const summary = await fetchHomeSummary();
    const createdTimes = summary.recentAssets.map((asset) => Date.parse(asset.created_at));

    expect(summary.recentAssets.length).toBeLessThanOrEqual(6);
    const sortedDesc = [...createdTimes].sort((a, b) => b - a);
    expect(createdTimes).toEqual(sortedDesc);
  });

  it("surfaces only queued or running jobs as active", async () => {
    const summary = await fetchHomeSummary();

    expect(summary.activeJobs.length).toBeGreaterThan(0);
    expect(
      summary.activeJobs.every((job) => job.status === "queued" || job.status === "running"),
    ).toBe(true);
  });

  it("flattens provider capabilities into operation ids", async () => {
    const summary = await fetchHomeSummary();

    expect(summary.providers.length).toBeGreaterThan(0);
    for (const provider of summary.providers) {
      expect(Array.isArray(provider.operations)).toBe(true);
    }
  });
});

describe("mock API list helpers", () => {
  it("lists all projects including archived ones", async () => {
    const projects = await fetchProjects();
    expect(projects.some((project) => project.archived)).toBe(true);
  });

  it("fetches a single project by id", async () => {
    const projects = await fetchProjects();
    const target = projects[0];
    expect(target).toBeDefined();
    if (!target) return;
    await expect(fetchProject(target.id)).resolves.toMatchObject({ id: target.id });
    await expect(fetchProject("00000000-0000-4000-8000-000000000000")).resolves.toBeUndefined();
  });

  it("respects the recent-assets limit", async () => {
    const assets = await fetchRecentAssets(2);
    expect(assets.length).toBeLessThanOrEqual(2);
  });

  it("lists only the requested project's assets", async () => {
    const projects = await fetchProjects();
    const target = projects.find((project) => !project.archived);
    expect(target).toBeDefined();
    if (!target) return;
    const assets = await fetchAssetsByProject(target.id);
    expect(assets.every((asset) => asset.project_id === target.id)).toBe(true);
  });

  it("drills an empty project with zero assets and zero jobs", async () => {
    const projects = await fetchProjects();
    const empty = projects.find((project) => project.name.startsWith("Blank Slate"));
    expect(empty).toBeDefined();
    if (!empty) return;
    expect(empty.archived).toBe(false);
    await expect(fetchAssetsByProject(empty.id)).resolves.toEqual([]);
    await expect(fetchJobs(empty.id)).resolves.toEqual([]);
    await expect(fetchJobs(empty.id, "failed")).resolves.toEqual([]);
    const detail = await fetchProjectDetail(empty.id);
    expect(detail?.assets).toEqual([]);
    expect(detail?.jobs).toEqual([]);
  });

  it("covers archived-only filter state with archived projects present", async () => {
    const projects = await fetchProjects();
    const archived = projects.filter((project) => project.archived);
    expect(archived.length).toBeGreaterThan(0);
    expect(archived.every((project) => project.name.startsWith("Archive"))).toBe(true);
  });

  it("lists jobs with full lifecycle coverage", async () => {
    const jobs = await fetchJobs();
    const statuses = new Set(jobs.map((job) => job.status));
    for (const status of ["queued", "running", "succeeded", "failed", "canceled"] as const) {
      expect(statuses.has(status)).toBe(true);
    }
    const failed = jobs.find((job) => job.status === "failed");
    expect(failed?.error?.retryable).toBe(true);
  });

  it("filters jobs by status", async () => {
    const failed = await fetchJobs(undefined, "failed");
    expect(failed.length).toBeGreaterThan(0);
    expect(failed.every((job) => job.status === "failed")).toBe(true);
    const projects = await fetchProjects();
    const film = projects.find((project) => project.name.startsWith("Moonshot"));
    expect(film).toBeDefined();
    if (!film) return;
    const filmFailed = await fetchJobs(film.id, "failed");
    expect(filmFailed.every((job) => job.project_id === film.id && job.status === "failed")).toBe(true);
  });

  it("scopes jobs by project", async () => {
    const projects = await fetchProjects();
    const target = projects.find((project) => !project.archived);
    expect(target).toBeDefined();
    if (!target) return;
    const jobs = await fetchJobs(target.id);
    expect(jobs.every((job) => job.project_id === target.id)).toBe(true);
    const byProject = await fetchJobsByProject(target.id);
    expect(byProject).toEqual(jobs);
  });

  it("surfaces failed retryable jobs through detail and by-id queries", async () => {
    const projects = await fetchProjects();
    const film = projects.find((project) => project.name.startsWith("Moonshot"));
    expect(film).toBeDefined();
    if (!film) return;
    const detail = await fetchProjectDetail(film.id);
    const failed = detail?.jobs.find((job) => job.status === "failed");
    expect(failed?.error?.retryable).toBe(true);
    expect(failed?.error?.code).toBe("TRAIN_OOM");
    expect(failed).toBeDefined();
    if (!failed) return;
    await expect(fetchJob(failed.id)).resolves.toMatchObject({
      id: failed.id,
      status: "failed",
      error: { code: "TRAIN_OOM", retryable: true },
    });
    await expect(fetchJob("00000000-0000-4000-8000-000000000000")).resolves.toBeUndefined();
  });

  it("returns project detail with matching assets and jobs", async () => {
    const projects = await fetchProjects();
    const target = projects.find((project) => !project.archived);
    expect(target).toBeDefined();
    if (!target) return;
    const detail = await fetchProjectDetail(target.id);
    expect(detail?.project.id).toBe(target.id);
    expect(detail?.assets.every((asset) => asset.project_id === target.id)).toBe(true);
    expect(detail?.jobs.every((job) => job.project_id === target.id)).toBe(true);
  });

  it("returns undefined detail for unknown projects", async () => {
    await expect(fetchProjectDetail("00000000-0000-4000-8000-000000000000")).resolves.toBeUndefined();
  });

  it("covers the LoRA consistency chain on the film project", async () => {
    const projects = await fetchProjects();
    const film = projects.find((project) => project.name.startsWith("Moonshot"));
    expect(film).toBeDefined();
    if (!film) return;
    const assets = await fetchAssetsByProject(film.id);
    const types = new Set(assets.map((asset) => asset.type));
    for (const type of ["image", "dataset", "lora", "video", "splat", "scene", "resource"] as const) {
      expect(types.has(type)).toBe(true);
    }
    const loraIds = assets.filter((asset) => asset.type === "lora").map((asset) => asset.id);
    expect(loraIds).toHaveLength(3);

    const firstFrames = assets.filter((asset) =>
      (asset.tags ?? []).includes("first-frame"),
    );
    const lastFrames = assets.filter((asset) =>
      (asset.tags ?? []).includes("last-frame"),
    );
    expect(firstFrames.length).toBeGreaterThan(0);
    expect(lastFrames.length).toBeGreaterThan(0);

    const shots = ["s01_c01", "s01_c02", "s02_c01", "s02_c02"] as const;
    for (const shot of shots) {
      const video = assets.find(
        (asset) => asset.type === "video" && asset.metadata?.["shot"] === shot,
      );
      expect(video).toBeDefined();
      expect(String(video?.storage.key)).toContain("/Publish/");
      const receipt = video?.metadata?.["publish_receipt"];
      expect(typeof receipt).toBe("object");
      for (const loraId of loraIds) {
        expect(video?.parent_asset_ids).toContain(loraId);
      }
    }

    const flf2v = assets.find(
      (asset) => asset.type === "video" && asset.provenance?.operation_id === "flf2v",
    );
    expect(flf2v).toBeDefined();
    const flf2vLast = lastFrames.find((asset) =>
      (flf2v?.parent_asset_ids ?? []).includes(asset.id),
    );
    expect(flf2vLast).toBeDefined();

    const sequences = new Set(
      assets
        .filter((asset) => typeof asset.metadata?.["sequence"] === "string")
        .map((asset) => asset.metadata?.["sequence"]),
    );
    expect(sequences.has("s01")).toBe(true);
    expect(sequences.has("s02")).toBe(true);

    const published = assets.filter((asset) =>
      String(asset.storage.key).includes("/Publish/"),
    );
    expect(published.length).toBeGreaterThan(0);
    expect(
      published.every((asset) => {
        const receipt = asset.metadata?.["publish_receipt"] as
          | { comment?: unknown; publisher?: unknown; sidecar?: unknown }
          | undefined;
        return (
          typeof receipt?.comment === "string" &&
          typeof receipt?.publisher === "string" &&
          typeof receipt?.sidecar === "string"
        );
      }),
    ).toBe(true);
  });

  it("fetches assets and single assets by id", async () => {
    const assets = await fetchAssets();
    expect(assets.length).toBeGreaterThan(0);
    const createdTimes = assets.map((asset) => Date.parse(asset.created_at));
    expect(createdTimes).toEqual([...createdTimes].sort((a, b) => b - a));
    const target = assets[0];
    expect(target).toBeDefined();
    if (!target) return;
    await expect(fetchAsset(target.id)).resolves.toMatchObject({ id: target.id });
    await expect(
      fetchAsset("00000000-0000-4000-8000-000000000000"),
    ).resolves.toBeUndefined();
  });

  it("fetches providers and a single provider by id", async () => {
    const providers = await fetchProviders();
    expect(providers.length).toBeGreaterThan(0);
    const local = await fetchProvider("prov_local");
    expect(local?.name).toBe("Local Runtime");
    await expect(
      fetchProvider("00000000-0000-4000-8000-000000000000"),
    ).resolves.toBeUndefined();
  });

  it("lists workflow-template resources with filter queries", async () => {
    const templates = await fetchWorkflowTemplates();
    expect(templates.length).toBeGreaterThanOrEqual(3);
    expect(
      templates.every(
        (asset) => asset.type === "resource" && asset.metadata?.["template"] === true,
      ),
    ).toBe(true);
    expect(templates.map((a) => a.name)).toEqual([...templates.map((a) => a.name)].sort());
    const projects = await fetchProjects();
    const film = projects.find((project) => project.name.startsWith("Moonshot"));
    expect(film).toBeDefined();
    if (!film) return;
    const scoped = await fetchWorkflowTemplates(film.id);
    expect(scoped.every((asset) => asset.project_id === film.id)).toBe(true);
    await expect(fetchWorkflowTemplates("00000000-0000-4000-8000-000000000000")).resolves.toEqual([]);
  });

  it("seeds Ver_001/Ver_002 chains with Output/Publish keys and publish receipts", async () => {
    const v2Out = await fetchAsset("0b5c1e2a-2000-4000-8000-000000000028");
    const v2Pub = await fetchAsset("0b5c1e2a-2000-4000-8000-000000000029");
    expect(v2Out?.storage.key).toContain("/Shots/s01_c01/Ver_002/Compose/Output/");
    expect(v2Pub?.storage.key).toContain("/Shots/s01_c01/Ver_002/Compose/Publish/");
    const receipt = v2Pub?.metadata?.["publish_receipt"] as
      | { comment?: string; publisher?: string; sidecar?: string }
      | undefined;
    expect(receipt?.comment).toContain("supersedes");
    expect(typeof receipt?.publisher).toBe("string");
    expect(receipt?.sidecar).toBe("Publish/s01_c01_v002.sidecar.json");
    expect(v2Out?.metadata?.["publish_receipt"]).toBeUndefined();
  });

  it("covers single-item detail for new workflow-template and version seeds", async () => {
    const template = await fetchAsset("0b5c1e2a-2000-4000-8000-000000000030");
    expect(template?.type).toBe("resource");
    expect(template?.metadata?.["template"]).toBe(true);
    const templateMeta = template?.metadata?.["workflow_template"] as
      | { operation_id?: string }
      | undefined;
    expect(templateMeta?.operation_id).toBe("dataset-prep");

    await expect(fetchAsset("0b5c1e2a-2000-4000-8000-000000000031")).resolves.toMatchObject({
      type: "resource",
      name: "lora-train-template.json",
    });
    await expect(fetchAsset("ffffffff-0000-4000-8000-000000000000")).resolves.toBeUndefined();

    await expect(fetchJob("0b5c1e2a-3000-4000-8000-000000000016")).resolves.toMatchObject({
      status: "failed",
    });
    await expect(fetchJob("ffffffff-0000-4000-8000-000000000000")).resolves.toBeUndefined();
    await expect(fetchProvider("prov_train")).resolves.toMatchObject({
      id: "prov_train",
      location: "cloud",
    });
    await expect(fetchProvider("ffffffff-0000-4000-8000-000000000000")).resolves.toBeUndefined();
  });

  it("exposes a pipeline operation catalog with stable ids", async () => {
    const catalog = await fetchOperations();
    const ids = new Set((catalog.operations ?? []).map((operation) => operation.id));
    for (const id of [
      "text-to-image",
      "dataset-prep",
      "lora-train",
      "image-to-video",
      "flf2v",
      "upscale",
      "3d-reconstruction",
      "splat-train",
    ]) {
      expect(ids.has(id)).toBe(true);
    }
    expect(catalog.version).toBe("v1");
  });

  it("flattens provider capabilities and filters by operation", async () => {
    const all = await fetchCapabilities();
    expect(all.length).toBeGreaterThan(0);
    expect(all.every((row) => typeof row.provider_id === "string")).toBe(true);
    const train = await fetchCapabilities("lora-train");
    expect(train.length).toBeGreaterThan(0);
    expect(train.every((row) => row.operation_id === "lora-train")).toBe(true);
    await expect(fetchCapabilities("no-such-operation")).resolves.toEqual([]);
  });

  it("lists conversations by project and their messages in transcript order", async () => {
    const projects = await fetchProjects();
    const film = projects.find((project) => project.name.startsWith("Moonshot"));
    expect(film).toBeDefined();
    if (!film) return;

    const conversations = await fetchConversations(film.id);
    expect(conversations.length).toBeGreaterThan(0);
    expect(conversations.every((c) => c.project_id === film.id)).toBe(true);
    await expect(fetchConversations("00000000-0000-4000-8000-000000000000")).resolves.toEqual([]);

    const target = conversations[0];
    expect(target).toBeDefined();
    if (!target) return;
    await expect(fetchConversation(target.id)).resolves.toMatchObject({ id: target.id });
    await expect(
      fetchConversation("00000000-0000-4000-8000-000000000000"),
    ).resolves.toBeUndefined();

    const messages = await fetchMessages(target.id);
    expect(messages.length).toBeGreaterThan(0);
    const times = messages.map((message) => Date.parse(message.created_at));
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect((await fetchMessages(target.id, 1)).length).toBeLessThanOrEqual(1);
    await expect(fetchMessages("00000000-0000-4000-8000-000000000000")).resolves.toEqual([]);
  });

  it("seeds auth, orchestration, presence, comments, storage and extensions", async () => {
    const user = await fetchCurrentUser();
    expect(user.email).toContain("@");
    expect((await fetchOrganizations()).length).toBeGreaterThan(0);

    const runs = await fetchOrchestrationRun("0b5c1e2a-6000-4000-8000-000000000001");
    expect(runs?.job_ids?.length).toBeGreaterThan(0);
    await expect(fetchOrchestrationRun("missing")).resolves.toBeUndefined();

    const projects = await fetchProjects();
    const film = projects.find((project) => project.name.startsWith("Moonshot"));
    const empty = projects.find((project) => project.name.startsWith("Blank Slate"));
    expect(film).toBeDefined();
    expect(empty).toBeDefined();
    if (!film || !empty) return;

    expect((await fetchPresence(film.id)).length).toBeGreaterThan(0);
    await expect(fetchPresence(empty.id)).resolves.toEqual([]);
    expect((await fetchComments(film.id)).length).toBeGreaterThan(0);
    await expect(fetchComments(film.id, "missing-asset")).resolves.toEqual([]);
    await expect(fetchComments(empty.id)).resolves.toEqual([]);

    const stats = await fetchStorageStats(film.id);
    expect(stats.project_id).toBe(film.id);
    expect(stats.quota.limit).toBeGreaterThan(0);
    const emptyStats = await fetchStorageStats(empty.id);
    expect(emptyStats.object_count).toBe(0);

    const extensions = await fetchExtensions();
    expect(extensions.length).toBeGreaterThanOrEqual(3);
    expect(new Set(extensions.map((e) => e.status)).size).toBeGreaterThan(1);
    await expect(fetchExtension("comfyui-local-adapter")).resolves.toMatchObject({
      status: "enabled",
    });
    await expect(fetchExtension("missing")).resolves.toBeUndefined();
  });
});

describe("mock chat writes and streams", () => {
  const syntheticConversationId = "00000000-0000-4000-8000-000000000099";

  async function waitForEvents(events: readonly StreamEvent[], count: number): Promise<void> {
    const deadline = Date.now() + 5_000;
    while (events.length < count && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }

  it("sendMessage persists an authoritative message visible on refetch", async () => {
    const message = await sendMessage(syntheticConversationId, {
      content: "Make it so",
      operation_id: "text-to-image",
    });

    expect(message).toMatchObject({
      conversation_id: syntheticConversationId,
      role: "user",
      content: "Make it so",
      status: "complete",
      operation_id: "text-to-image",
    });
    expect(message.id).toMatch(/^0b5c1e2a-7000-4000-8000-\d{12}$/);
    await expect(fetchMessages(syntheticConversationId)).resolves.toEqual([message]);
    await expect(fetchMessages(syntheticConversationId, 1)).resolves.toEqual([message]);
    await expect(fetchMessages("00000000-0000-4000-8000-000000000098")).resolves.toEqual([]);
  });

  it("streams ordered events from the resume cursor and stops on close", async () => {
    const events: StreamEvent[] = [];
    const stream = openConversationStream("c1", 10);
    const unsubscribe = stream.onEvent((event) => events.push(event));
    await waitForEvents(events, 4);

    expect(events.map((event) => event.type)).toEqual([
      "message_start",
      "delta",
      "delta",
      "message_complete",
    ]);
    expect(events.map((event) => event.seq)).toEqual([11, 12, 13, 14]);
    unsubscribe();
    stream.close();

    const afterClose: StreamEvent[] = [];
    const closed = openConversationStream("c1");
    closed.onEvent((event) => afterClose.push(event));
    closed.close();
    await new Promise((resolve) => setTimeout(resolve, 120));
    expect(afterClose).toEqual([]);
  });

  it("exposes guardable error states that reset cleanly", async () => {
    try {
      setMockFailure("home");
      await expect(fetchHomeSummary()).rejects.toMatchObject({
        status: 503,
        code: "mock_failure",
      });

      setMockFailure("*");
      await expect(fetchProjects()).rejects.toMatchObject({ code: "mock_failure" });
      await expect(fetchMessages("c1")).rejects.toMatchObject({ code: "mock_failure" });
      await expect(sendMessage("c1", { content: "x" })).rejects.toMatchObject({
        code: "mock_failure",
      });

      setMockFailure("*", false);
      setMockFailure("stream");
      const events: StreamEvent[] = [];
      const stream = openConversationStream("c1");
      stream.onEvent((event) => events.push(event));
      await waitForEvents(events, 1);
      expect(events[0]).toMatchObject({ type: "error", error: "Mock stream failure" });
      stream.close();
    } finally {
      clearMockFailures();
    }

    await expect(fetchHomeSummary()).resolves.toBeDefined();
    await expect(fetchProjects()).resolves.toBeDefined();
  });
});

describe("mock API asset writes", () => {
  const MISSING_ID = "00000000-0000-4000-8000-000000000000";

  it("persists a name/tags/metadata patch and surfaces it on every read", async () => {
    const assets = await fetchAssets();
    const target = assets[0];
    expect(target).toBeDefined();
    if (!target) return;

    const updated = await updateAsset(target.id, {
      name: "Renamed frame",
      tags: ["reviewed", "ready"],
      metadata: { review_note: "looks good" },
    });

    expect(updated).toMatchObject({
      id: target.id,
      name: "Renamed frame",
      tags: ["reviewed", "ready"],
      metadata: { review_note: "looks good" },
    });
    expect(Date.parse(updated.updated_at)).toBeGreaterThan(Date.parse(target.updated_at));
    await expect(fetchAsset(target.id)).resolves.toMatchObject({ name: "Renamed frame" });
    expect((await fetchAssets()).find((asset) => asset.id === target.id)?.name).toBe(
      "Renamed frame",
    );
    expect(
      (await fetchAssetsByProject(target.project_id)).find((asset) => asset.id === target.id)
        ?.name,
    ).toBe("Renamed frame");
    const detail = await fetchProjectDetail(target.project_id);
    expect(detail?.assets.find((asset) => asset.id === target.id)?.name).toBe("Renamed frame");
    expect((await fetchRecentAssets(20)).find((asset) => asset.id === target.id)?.name).toBe(
      "Renamed frame",
    );
    expect((await fetchHomeSummary()).recentAssets.find((asset) => asset.id === target.id)?.name).toBe(
      "Renamed frame",
    );
  });

  it("treats null tags/metadata as no-change, matching the backend repository", async () => {
    const assets = await fetchAssets();
    const target = assets.find((asset) => (asset.tags ?? []).length > 0);
    expect(target).toBeDefined();
    if (!target) return;

    const updated = await updateAsset(target.id, {
      name: target.name,
      tags: null,
      metadata: null,
    });

    expect(updated.tags).toEqual(target.tags);
    expect(updated.metadata).toEqual(target.metadata);
  });

  it("rejects a null name, unknown ids and injected failure states", async () => {
    const assets = await fetchAssets();
    const target = assets[0];
    expect(target).toBeDefined();
    if (!target) return;

    await expect(updateAsset(target.id, { name: null })).rejects.toMatchObject({
      status: 400,
      code: "invalid_request",
      details: [{ field: "name", message: "name is required and cannot be null" }],
    });
    await expect(updateAsset(MISSING_ID, { name: "x" })).rejects.toMatchObject({
      status: 404,
      code: "not_found",
    });
    expect((await fetchAsset(target.id))?.name).toBe(target.name);

    setMockFailure("assets");
    await expect(updateAsset(target.id, { name: "x" })).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });
  });

  it("keeps seed fixtures pristine after a write is reset", async () => {
    const before = await fetchAssets();
    const target = before[0];
    expect(target).toBeDefined();
    if (!target) return;

    await updateAsset(target.id, { name: "Temporary" });
    expect((await fetchAsset(target.id))?.name).toBe("Temporary");

    resetMockAssets();
    expect((await fetchAsset(target.id))?.name).toBe(target.name);
  });
});

describe("mock API project audit (C20)", () => {
  const filmId = PROJECTS.find((project) => project.name.startsWith("Moonshot"))?.id ?? "";
  const emptyId = PROJECTS.find((project) => project.name.startsWith("Blank Slate"))?.id ?? "";
  const missingId = "00000000-0000-4000-8000-000000000000";

  it("returns a populated, newest-first feed for a production project", async () => {
    const trail = await fetchProjectAudit(filmId);
    expect(trail?.project_id).toBe(filmId);
    expect(trail?.events?.length ?? 0).toBeGreaterThan(0);
    const timestamps = (trail?.events ?? []).map((event) => Date.parse(event.timestamp));
    expect(timestamps).toEqual([...timestamps].sort((a, b) => b - a));
  });

  it("returns an empty feed for a project with no assets or jobs", async () => {
    expect(await fetchProjectAudit(emptyId)).toEqual({ project_id: emptyId, events: [] });
  });

  it("resolves unknown projects to undefined", async () => {
    expect(await fetchProjectAudit(missingId)).toBeUndefined();
  });

  it("supports kind and limit filters", async () => {
    const full = await fetchProjectAudit(filmId);
    const jobsOnly = await fetchProjectAudit(filmId, { kind: "job", limit: 2 });
    expect(jobsOnly?.events).toHaveLength(2);
    expect(jobsOnly?.events?.every((event) => event.kind === "job")).toBe(true);
    expect(full?.events?.length ?? 0).toBeGreaterThan(jobsOnly?.events?.length ?? 0);
  });

  it("surfaces the injected failure state as a normalized ApiError", async () => {
    setMockFailure("audit");
    await expect(fetchProjectAudit(filmId)).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });
  });
});

describe("mock API cross-domain search (C22)", () => {
  it("returns ranked matches derived from the seeded stores", async () => {
    const response = await fetchSearch("moon");
    expect(response.query).toBe("moon");
    expect((response.results ?? []).length).toBeGreaterThan(1);
    expect(response.results?.some((result) => result.kind === "project")).toBe(true);
    expect(response.results?.some((result) => result.kind === "asset")).toBe(true);
    // Highest-scoring match is the prefix project name.
    expect(response.results?.[0]).toMatchObject({ kind: "project", score: 1 });
  });

  it("filters by kind and caps results with limit", async () => {
    const assetsOnly = await fetchSearch("moon", { kind: "asset" });
    expect(assetsOnly.results?.length).toBeGreaterThan(0);
    expect(assetsOnly.results?.every((result) => result.kind === "asset")).toBe(true);

    const capped = await fetchSearch("moon", { limit: 2 });
    expect(capped.results).toHaveLength(2);
  });

  it("returns an empty feed for a query with no matches", async () => {
    expect(await fetchSearch("zzzz-no-such-thing")).toEqual({
      query: "zzzz-no-such-thing",
      results: [],
    });
  });

  it("mirrors router validation and the injectable failure state", async () => {
    await expect(fetchSearch("")).rejects.toMatchObject({ status: 422, code: "validation_error" });
    await expect(fetchSearch("ok", { limit: 500 })).rejects.toMatchObject({ status: 422 });

    setMockFailure("search");
    await expect(fetchSearch("moon")).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });
  });
});
