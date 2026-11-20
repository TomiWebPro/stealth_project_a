import { afterEach, describe, expect, it } from "vitest";

import type { StreamEvent } from "../../types";
import { extensionId } from "../extensionFeed";
import {
  ASSETS,
  ASSET_RELATIONSHIPS,
  ASSET_VERSIONS,
  COMMENTS,
  CONVERSATIONS,
  EXTENSIONS,
  JOBS,
  JOB_EVENTS,
  JOB_RETRIES,
  MESSAGES,
  OPERATION_CATALOG,
  ORGANIZATIONS,
  ORGANIZATION_MEMBERS,
  ORCHESTRATION_PLANS,
  ORCHESTRATION_RUNS,
  PIPELINE_CHAINS,
  PRESENCE,
  PROJECTS,
  PROVIDERS,
  REFERENCE_NOW,
  UPLOADS,
  USERS,
} from "./data";
import {
  clearMockFailures,
  fetchActivity,
  fetchActivityStats,
  fetchAsset,
  fetchAssetOverview,
  fetchAssetStats,
  fetchAssets,
  fetchAssetsByProject,
  fetchCapabilities,
  fetchChainOverview,
  fetchCollaborationFeed,
  fetchCollaborationStats,
  fetchConversation,
  fetchComments,
  fetchConversations,
  fetchConversationStats,
  fetchConversationFeed,
  fetchConversationOverview,
  fetchCurrentUser,
  fetchDashboard,
  fetchEventStats,
  fetchExtension,
  fetchExtensions,
  fetchExtensionOverview,
  fetchExtensionStats,
  fetchHomeSummary,
  fetchJob,
  fetchJobLogs,
  fetchJobOverview,
  fetchJobQueue,
  fetchJobs,
  fetchJobsByProject,
  fetchLineageStats,
  fetchMessages,
  fetchOperations,
  fetchOperationOverview,
  fetchOrganizationOverview,
  fetchOrganizationStats,
  fetchPipelineStats,
  fetchProjectOverview,
  openConversationStream,
  sendMessage,
  setMockFailure,
  fetchOrganizations,
  fetchOrchestrationRun,
  fetchOrchestrationStats,
  fetchPlanOverview,
  fetchRunOverview,
  fetchPresence,
  fetchProject,
  fetchProjectAudit,
  fetchProjectDetail,
  fetchProjectStats,
  fetchProjects,
  fetchProvider,
  fetchProviders,
  fetchProviderFeed,
  fetchProviderOverview,
  fetchProviderStats,
  fetchPublishFeed,
  fetchRecentAssets,
  fetchRetryFeed,
  fetchRetryStats,
  fetchSearch,
  fetchSearchStats,
  fetchStorageStats,
  fetchUploadFeed,
  fetchUploadOverview,
  fetchUploadStats,
  fetchVersionOverview,
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

describe("mock API organization overview (C226 follow-up)", () => {
  const orgId = ORGANIZATIONS[0]?.id ?? "";

  it("derives a populated snapshot from the authoritative auth/project seeds", async () => {
    const overview = await fetchOrganizationOverview(orgId);
    expect(overview).toBeDefined();
    expect(overview?.generated_at).toBe(REFERENCE_NOW);
    expect(overview?.org_id).toBe(orgId);
    expect(overview?.name).toBe(ORGANIZATIONS[0]?.name);
    expect(overview?.slug).toBe(ORGANIZATIONS[0]?.slug);
    expect(overview?.counts.members).toBe(
      ORGANIZATION_MEMBERS.filter((member) => member.org_id === orgId).length,
    );
    expect(overview?.counts.projects).toBe(
      PROJECTS.filter((project) => project.org_id === orgId).length,
    );
    expect(overview?.by_role?.reduce((sum, bucket) => sum + bucket.members, 0)).toBe(
      overview?.counts.members,
    );
    expect(overview?.recent_members?.length).toBeLessThanOrEqual(5);
    expect(overview?.recent_members?.[0]).not.toHaveProperty("org_id");
  });

  it("bounds the recent lists without bounding the whole-scope counts", async () => {
    const whole = await fetchOrganizationOverview(orgId);
    const limited = await fetchOrganizationOverview(orgId, { recentLimit: 1 });
    expect(limited?.counts).toEqual(whole?.counts);
    expect(limited?.recent_members).toHaveLength(1);
    expect(limited?.recent_projects).toHaveLength(1);
  });

  it("resolves an unknown org to undefined and mirrors router validation/failure", async () => {
    await expect(
      fetchOrganizationOverview("00000000-0000-4000-8000-000000000000"),
    ).resolves.toBeUndefined();
    await expect(fetchOrganizationOverview("not-a-uuid")).rejects.toMatchObject({
      status: 422,
      code: "validation_error",
    });
    await expect(fetchOrganizationOverview(orgId, { recentLimit: 0 })).rejects.toMatchObject({
      status: 422,
      code: "validation_error",
    });

    setMockFailure("organizationOverview");
    await expect(fetchOrganizationOverview(orgId)).rejects.toMatchObject({
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

describe("mock API provider feed (C185 follow-up)", () => {
  it("derives a deterministic feed from the authoritative provider seeds", async () => {
    const feed = await fetchProviderFeed();
    expect(feed.total).toBe(PROVIDERS.length);
    expect(feed.items).toHaveLength(PROVIDERS.length);
    expect((feed.items ?? []).map((item) => item.name)).toEqual(
      [...PROVIDERS].map((provider) => provider.name).sort(),
    );
    const local = feed.items?.find((item) => item.provider_id === "prov_local");
    expect(local).toMatchObject({
      provider_id: "prov_local",
      name: "Local Runtime",
      location: "local",
      status: "available",
      operation_ids: ["image-to-image", "text-to-image", "upscale"],
      capability_count: 3,
    });
    expect(feed.generated_at).toBe(REFERENCE_NOW);
  });

  it("filters, pages and keeps the whole-scope total", async () => {
    const cloud = await fetchProviderFeed({ location: "cloud" });
    expect(cloud.total).toBe(2);
    const paged = await fetchProviderFeed({ limit: 1 });
    expect(paged.total).toBe(PROVIDERS.length);
    expect(paged.items).toHaveLength(1);
    expect(await fetchProviderFeed({ location: "local", status: "degraded" })).toMatchObject({
      items: [],
      total: 0,
    });
  });

  it("mirrors router validation and surfaces the injected failure", async () => {
    await expect(fetchProviderFeed({ location: "moon" as never })).rejects.toMatchObject({
      status: 422,
      code: "validation_error",
    });
    await expect(fetchProviderFeed({ status: "busy" as never })).rejects.toMatchObject({
      status: 422,
      code: "validation_error",
    });
    await expect(fetchProviderFeed({ limit: 0 })).rejects.toMatchObject({
      status: 422,
      code: "validation_error",
    });

    setMockFailure("providerFeed");
    await expect(fetchProviderFeed()).rejects.toMatchObject({
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

describe("mock API search index stats (C93 follow-up)", () => {
  const filmId = PROJECTS.find((project) => project.name.startsWith("Moonshot"))?.id ?? "";
  const emptyId = PROJECTS.find((project) => project.name.startsWith("Blank Slate"))?.id ?? "";
  const liveAssets = ASSETS.filter((asset) => asset.status !== "deleted");

  it("derives a populated snapshot from the authoritative document seeds", async () => {
    const stats = await fetchSearchStats();
    expect(stats.by_kind).toEqual([
      { kind: "project", count: PROJECTS.length },
      { kind: "asset", count: liveAssets.length },
      { kind: "conversation", count: CONVERSATIONS.length },
    ]);
    expect(stats.total_documents).toBe(PROJECTS.length + liveAssets.length + CONVERSATIONS.length);
    expect(stats.newest_document_at).toBeTruthy();
    expect(stats.generated_at).toBe(REFERENCE_NOW);
  });

  it("scopes the snapshot to one project, counting the project itself", async () => {
    const scoped = await fetchSearchStats({ projectId: filmId });
    expect(scoped.by_kind?.[0]).toEqual({ kind: "project", count: 1 });
    expect(scoped.total_documents).toBe(
      (scoped.by_kind ?? []).reduce((sum, bucket) => sum + bucket.count, 0),
    );

    // A project with no assets still counts itself plus any conversations,
    // mirroring the backend's scoped-project document selection.
    const empty = await fetchSearchStats({ projectId: emptyId });
    const emptyConversations = CONVERSATIONS.filter(
      (conversation) => conversation.project_id === emptyId,
    ).length;
    expect(empty.by_kind).toEqual([
      { kind: "project", count: 1 },
      { kind: "asset", count: 0 },
      { kind: "conversation", count: emptyConversations },
    ]);
    expect(empty.total_documents).toBe(1 + emptyConversations);
    expect(empty.newest_document_at).toBeTruthy();
  });

  it("mirrors router validation, the unknown-project 404 and the injected failure", async () => {
    await expect(fetchSearchStats({ projectId: "not-a-uuid" })).rejects.toMatchObject({
      status: 422,
      code: "validation_error",
    });
    await expect(
      fetchSearchStats({ projectId: "00000000-0000-4000-8000-000000000000" }),
    ).rejects.toMatchObject({ status: 404, code: "not_found" });

    setMockFailure("searchStats");
    await expect(fetchSearchStats()).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });
  });
});

describe("mock API upload statistics (C97 follow-up)", () => {
  const filmId = PROJECTS.find((project) => project.name.startsWith("Moonshot"))?.id ?? "";
  const emptyId = PROJECTS.find((project) => project.name.startsWith("Blank Slate"))?.id ?? "";

  it("derives the authoritative snapshot from the upload ticket seeds", async () => {
    const stats = await fetchUploadStats();
    const completed = UPLOADS.filter((ticket) => ticket.status === "complete");
    const pending = UPLOADS.filter((ticket) => ticket.status === "pending");

    expect(stats.total_tickets).toBe(UPLOADS.length);
    expect(stats.pending).toBe(pending.length);
    expect(stats.completed).toBe(completed.length);
    expect(stats.bytes_uploaded).toBe(
      completed.reduce((sum, ticket) => sum + ticket.size_bytes, 0),
    );
    expect(stats.by_status).toEqual([
      { status: "pending", count: pending.length },
      { status: "complete", count: completed.length },
    ]);
    expect(stats.by_project?.length).toBeGreaterThan(0);
    expect(stats.newest_upload_at).toBeTruthy();
    expect(stats.generated_at).toBe(REFERENCE_NOW);
  });

  it("scopes the snapshot to one project and zero-fills an unseeded project", async () => {
    const scoped = await fetchUploadStats({ projectId: filmId });
    expect(scoped.total_tickets).toBe(
      UPLOADS.filter((ticket) => ticket.project_id === filmId).length,
    );
    expect(scoped.by_project).toHaveLength(1);

    const empty = await fetchUploadStats({ projectId: emptyId });
    expect(empty.total_tickets).toBe(0);
    expect(empty.bytes_uploaded).toBe(0);
    expect(empty.by_status?.every((bucket) => bucket.count === 0)).toBe(true);
    expect(empty.by_project).toEqual([]);
    expect(empty.newest_upload_at).toBeNull();
  });

  it("mirrors router validation, the unknown-project 404 and the injected failure", async () => {
    await expect(fetchUploadStats({ projectId: "not-a-uuid" })).rejects.toMatchObject({
      status: 422,
      code: "validation_error",
    });
    await expect(
      fetchUploadStats({ projectId: "00000000-0000-4000-8000-000000000000" }),
    ).rejects.toMatchObject({ status: 404, code: "not_found" });

    setMockFailure("uploadStats");
    await expect(fetchUploadStats()).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });
  });
});

describe("mock API conversation feed (C133 follow-up)", () => {
  const filmId = PROJECTS.find((project) => project.name.startsWith("Moonshot"))?.id ?? "";
  // The brand project has no seeded conversations, so its feed is genuinely empty.
  const noConversationsId = PROJECTS.find((project) => project.name.startsWith("Northlight"))?.id ?? "";

  it("derives a newest-first feed with joined project names, previews and whole-scope totals", async () => {
    const feed = await fetchConversationFeed();
    expect(feed.generated_at).toBe(REFERENCE_NOW);
    expect(feed.total).toBe(CONVERSATIONS.length);
    expect((feed.items ?? []).length).toBe(CONVERSATIONS.length);

    const dates = (feed.items ?? []).map((item) => item.updated_at);
    expect([...dates].sort().reverse()).toEqual(dates);
    for (const item of feed.items ?? []) {
      const project = PROJECTS.find((candidate) => candidate.id === item.project_id);
      expect(item.project_name).toBe(project?.name ?? "Unknown project");
      expect(item.title).toBeTruthy();
    }
    const withMessages = (feed.items ?? []).find((item) => item.message_count > 0);
    expect(withMessages?.last_message_role).toBeTruthy();
    expect(withMessages?.last_message_excerpt).toBeTruthy();
    const empty = (feed.items ?? []).find((item) => item.message_count === 0);
    expect(empty?.last_message_role).toBeNull();
    expect(empty?.last_message_excerpt).toBeNull();
  });

  it("scopes to one project and bounds the page without changing the total", async () => {
    const full = await fetchConversationFeed();
    const paged = await fetchConversationFeed({ limit: 2 });
    expect(paged.total).toBe(full.total);
    expect((paged.items ?? []).length).toBe(2);
    expect((paged.items ?? []).map((item) => item.conversation_id)).toEqual(
      (full.items ?? []).slice(0, 2).map((item) => item.conversation_id),
    );

    const scoped = await fetchConversationFeed({ projectId: filmId });
    expect((scoped.items ?? []).every((item) => item.project_id === filmId)).toBe(true);

    const empty = await fetchConversationFeed({ projectId: noConversationsId });
    expect(empty).toMatchObject({ items: [], total: 0 });
  });

  it("mirrors router validation, 404s unknown projects and surfaces the injected failure", async () => {
    await expect(fetchConversationFeed({ projectId: "not-a-uuid" })).rejects.toMatchObject({
      status: 422,
      code: "validation_error",
    });
    for (const limit of [0, 201]) {
      await expect(fetchConversationFeed({ limit })).rejects.toMatchObject({
        status: 422,
        code: "validation_error",
      });
    }
    await expect(
      fetchConversationFeed({ projectId: "00000000-0000-4000-8000-000000000000" }),
    ).rejects.toMatchObject({ status: 404, code: "not_found" });

    setMockFailure("conversationFeed");
    await expect(fetchConversationFeed()).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });
  });
});

describe("mock API upload feed (C129 follow-up)", () => {
  const filmId = PROJECTS.find((project) => project.name.startsWith("Moonshot"))?.id ?? "";
  const emptyId = PROJECTS.find((project) => project.name.startsWith("Blank Slate"))?.id ?? "";

  it("derives a newest-first feed with joined project names and whole-scope totals", async () => {
    const feed = await fetchUploadFeed();
    expect(feed.generated_at).toBe(REFERENCE_NOW);
    expect(feed.total).toBe(UPLOADS.length);
    expect((feed.items ?? []).length).toBe(UPLOADS.length);

    const dates = (feed.items ?? []).map((item) => item.created_at);
    expect([...dates].sort().reverse()).toEqual(dates);
    for (const item of feed.items ?? []) {
      const project = PROJECTS.find((candidate) => candidate.id === item.project_id);
      expect(item.project_name).toBe(project?.name ?? "Unknown project");
      expect(item.filename).toBeTruthy();
      expect(item.content_type).toBeTruthy();
      expect(item.expires_at).toBeTruthy();
    }
  });

  it("scopes to one project and bounds the page without changing the total", async () => {
    const full = await fetchUploadFeed();
    const paged = await fetchUploadFeed({ limit: 2 });
    expect(paged.total).toBe(full.total);
    expect((paged.items ?? []).length).toBe(2);
    expect((paged.items ?? []).map((item) => item.upload_id)).toEqual(
      (full.items ?? []).slice(0, 2).map((item) => item.upload_id),
    );

    const scoped = await fetchUploadFeed({ projectId: filmId });
    expect((scoped.items ?? []).every((item) => item.project_id === filmId)).toBe(true);

    const empty = await fetchUploadFeed({ projectId: emptyId });
    expect(empty).toMatchObject({ items: [], total: 0 });
  });

  it("mirrors router validation, 404s unknown projects and surfaces the injected failure", async () => {
    await expect(fetchUploadFeed({ projectId: "not-a-uuid" })).rejects.toMatchObject({
      status: 422,
      code: "validation_error",
    });
    for (const limit of [0, 201]) {
      await expect(fetchUploadFeed({ limit })).rejects.toMatchObject({
        status: 422,
        code: "validation_error",
      });
    }
    await expect(
      fetchUploadFeed({ projectId: "00000000-0000-4000-8000-000000000000" }),
    ).rejects.toMatchObject({ status: 404, code: "not_found" });

    setMockFailure("uploadFeed");
    await expect(fetchUploadFeed()).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });
  });
});

describe("mock API event stream statistics (C101 follow-up)", () => {
  const filmId = PROJECTS.find((project) => project.name.startsWith("Moonshot"))?.id ?? "";
  const emptyId = PROJECTS.find((project) => project.name.startsWith("Blank Slate"))?.id ?? "";

  it("derives the authoritative snapshot from the job event seeds", async () => {
    const stats = await fetchEventStats();
    const jobIds = new Set(JOB_EVENTS.map((entry) => entry.job_id));

    expect(stats.total_events).toBe(JOB_EVENTS.length);
    expect(stats.total_jobs).toBe(jobIds.size);
    expect(stats.by_type?.map((bucket) => bucket.type)).toEqual([
      "status",
      "progress",
      "intermediate",
      "result",
      "error",
      "log",
    ]);
    expect(stats.by_type?.reduce((sum, bucket) => sum + bucket.count, 0)).toBe(JOB_EVENTS.length);
    expect(stats.by_job?.length).toBeGreaterThan(0);
    expect(stats.newest_event_at).toBeTruthy();
    expect(stats.generated_at).toBe(REFERENCE_NOW);
  });

  it("scopes events to one project (skipping orphan jobs) and zero-fills an unseeded project", async () => {
    const jobProjects = new Map(JOBS.map((job) => [job.id, job.project_id]));
    const filmEventCount = JOB_EVENTS.filter(
      (entry) => jobProjects.get(entry.job_id) === filmId,
    ).length;

    const scoped = await fetchEventStats({ projectId: filmId });
    expect(scoped.total_events).toBe(filmEventCount);
    expect(scoped.total_jobs).toBeGreaterThan(0);
    expect(scoped.by_job?.every((entry) => jobProjects.get(entry.job_id) === filmId)).toBe(true);

    const empty = await fetchEventStats({ projectId: emptyId });
    expect(empty.total_events).toBe(0);
    expect(empty.total_jobs).toBe(0);
    expect(empty.by_type?.every((bucket) => bucket.count === 0)).toBe(true);
    expect(empty.by_job).toEqual([]);
    expect(empty.newest_event_at).toBeNull();
  });

  it("mirrors router validation, the unknown-project 404 and the injected failure", async () => {
    await expect(fetchEventStats({ projectId: "not-a-uuid" })).rejects.toMatchObject({
      status: 422,
      code: "validation_error",
    });
    await expect(
      fetchEventStats({ projectId: "00000000-0000-4000-8000-000000000000" }),
    ).rejects.toMatchObject({ status: 404, code: "not_found" });

    setMockFailure("eventStats");
    await expect(fetchEventStats()).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });
  });
});

describe("mock API per-job execution log (C117 follow-up)", () => {
  const failedJobId = JOBS.find((job) => job.status === "failed")?.id ?? "";

  it("derives a chronological, level-filtered, paginated log from the event seeds", async () => {
    const frame = await fetchJobLogs(failedJobId);
    const expected = JOB_EVENTS.filter((entry) => entry.job_id === failedJobId);

    expect(frame?.job_id).toBe(failedJobId);
    expect(frame?.total).toBe(expected.length);
    expect((frame?.entries ?? []).map((entry) => entry.seq)).toEqual(
      expected.map((entry) => entry.seq),
    );
    expect(frame?.entries?.[0]?.level).toBe("info");
    expect(frame?.entries?.at(-1)?.level).toBe("error");
    expect(frame?.entries?.at(-1)?.error).toMatchObject({ code: "TRAIN_OOM" });
    expect(frame?.next_seq).toBe((expected.at(-1)?.seq ?? 0) + 1);

    const errors = await fetchJobLogs(failedJobId, { level: "error" });
    expect((errors?.entries ?? []).map((entry) => entry.seq)).toEqual([2]);
    expect(errors?.total).toBe(1);

    const page = await fetchJobLogs(failedJobId, { sinceSeq: 1, limit: 1 });
    expect((page?.entries ?? []).map((entry) => entry.seq)).toEqual([1]);
    expect(page?.next_seq).toBe(2);
    expect(page?.total).toBe(expected.length);
  });

  it("resolves an unknown job to undefined and mirrors router 422 validation", async () => {
    await expect(fetchJobLogs("00000000-0000-4000-8000-000000000000")).resolves.toBeUndefined();
    await expect(fetchJobLogs("not-a-uuid")).rejects.toMatchObject({
      status: 422,
      code: "validation_error",
    });
    await expect(fetchJobLogs(failedJobId, { level: "verbose" as never })).rejects.toMatchObject({
      status: 422,
      code: "validation_error",
    });
    await expect(fetchJobLogs(failedJobId, { sinceSeq: -1 })).rejects.toMatchObject({
      status: 422,
      code: "validation_error",
    });
    await expect(fetchJobLogs(failedJobId, { limit: 201 })).rejects.toMatchObject({
      status: 422,
      code: "validation_error",
    });

    setMockFailure("jobLogs");
    await expect(fetchJobLogs(failedJobId)).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });
  });
});

describe("mock API job dispatch queue (C121 follow-up)", () => {
  const filmId = PROJECTS.find((project) => project.name.startsWith("Moonshot"))?.id ?? "";
  const emptyId = PROJECTS.find((project) => project.name.startsWith("Blank Slate"))?.id ?? "";

  it("derives the active FIFO queue with whole-queue counters from the job seeds", async () => {
    const view = await fetchJobQueue();
    const expected = JOBS.filter(
      (job) => job.status === "queued" || job.status === "running",
    ).sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));

    expect(view.total).toBe(expected.length);
    expect(view.waiting).toBe(expected.filter((job) => job.status === "queued").length);
    expect(view.running).toBe(expected.filter((job) => job.status === "running").length);
    expect(view.generated_at).toBe(REFERENCE_NOW);
    expect((view.entries ?? []).map((entry) => entry.job_id)).toEqual(expected.map((job) => job.id));
    expect((view.entries ?? [])[0]?.position).toBe(1);
    expect((view.entries ?? []).at(-1)?.position).toBe(expected.length);
  });

  it("bounds the page, scopes to one project and returns an empty view for an idle project", async () => {
    const full = await fetchJobQueue();
    const paged = await fetchJobQueue({ limit: 2 });
    expect(paged.total).toBe(full.total);
    expect((paged.entries ?? []).map((entry) => entry.position)).toEqual([1, 2]);

    const scoped = await fetchJobQueue({ projectId: filmId });
    expect((scoped.entries ?? []).length).toBeGreaterThan(0);
    expect((scoped.entries ?? []).every((entry) => entry.project_id === filmId)).toBe(true);

    const empty = await fetchJobQueue({ projectId: emptyId });
    expect(empty).toMatchObject({ total: 0, waiting: 0, running: 0, entries: [] });
  });

  it("mirrors router validation, 404s unknown projects and surfaces the injected failure", async () => {
    await expect(fetchJobQueue({ projectId: "not-a-uuid" })).rejects.toMatchObject({
      status: 422,
      code: "validation_error",
    });
    for (const limit of [0, 201]) {
      await expect(fetchJobQueue({ limit })).rejects.toMatchObject({
        status: 422,
        code: "validation_error",
      });
    }
    await expect(
      fetchJobQueue({ projectId: "00000000-0000-4000-8000-000000000000" }),
    ).rejects.toMatchObject({ status: 404, code: "not_found" });

    setMockFailure("jobQueue");
    await expect(fetchJobQueue()).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });
  });
});

describe("mock API asset overview (C205 follow-up)", () => {
  const rootAsset =
    ASSETS.find((asset) => asset.metadata?.["publish_receipt"] !== undefined) ?? ASSETS[0];
  const assetId = rootAsset?.id ?? "";

  it("derives a populated snapshot with identity, counts and recent versions", async () => {
    const overview = await fetchAssetOverview(assetId);
    expect(overview).toBeDefined();
    expect(overview?.generated_at).toBe(REFERENCE_NOW);
    expect(overview?.asset_id).toBe(assetId);
    expect(overview?.asset_name).toBe(rootAsset?.name);
    expect(overview?.project_id).toBe(rootAsset?.project_id);
    expect(overview?.published).toBe(true);
    expect(overview?.counts.versions).toBe(
      ASSET_VERSIONS.filter((version) => version.asset_id === assetId).length,
    );
    expect(overview?.counts.comments).toBe(
      COMMENTS.filter((comment) => comment.asset_id === assetId).length,
    );
    expect(overview?.counts.tags).toBe(rootAsset?.tags?.length ?? 0);
    const keys = (overview?.recent_versions ?? []).map((item) => item.version);
    expect(keys).toEqual([...keys].sort((a, b) => b - a));
  });

  it("bounds the recent-version list without changing the totals", async () => {
    const whole = await fetchAssetOverview(assetId);
    const limited = await fetchAssetOverview(assetId, { recentLimit: 1 });
    expect(limited?.counts).toEqual(whole?.counts);
    expect(limited?.recent_versions).toHaveLength(1);
  });

  it("mirrors router validation, the unknown-asset 404 and the injected failure", async () => {
    await expect(fetchAssetOverview("not-a-uuid")).rejects.toMatchObject({
      status: 422,
      code: "validation_error",
    });
    await expect(fetchAssetOverview(assetId, { recentLimit: 0 })).rejects.toMatchObject({
      status: 422,
      code: "validation_error",
    });
    await expect(
      fetchAssetOverview("00000000-0000-4000-8000-000000000000"),
    ).resolves.toBeUndefined();

    setMockFailure("assetOverview");
    await expect(fetchAssetOverview(assetId)).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });
  });
});

describe("mock API conversation overview (C209 follow-up)", () => {
  const film = CONVERSATIONS.find((conversation) => conversation.message_count && conversation.message_count > 0);
  const empty = CONVERSATIONS.find((conversation) => conversation.message_count === 0);
  const conversationId = film?.id ?? "";

  it("derives a populated snapshot with identity, counts and a last-message preview", async () => {
    const overview = await fetchConversationOverview(conversationId);
    expect(overview).toBeDefined();
    expect(overview?.generated_at).toBe(REFERENCE_NOW);
    expect(overview?.conversation_id).toBe(conversationId);
    expect(overview?.title).toBe(film?.title);
    expect(overview?.message_count).toBe(film?.message_count);
    expect(overview?.counts.total).toBe(
      MESSAGES.filter((message) => message.conversation_id === conversationId).length,
    );
    expect((overview?.counts.by_role ?? []).reduce((sum, row) => sum + row.count, 0)).toBe(
      overview?.counts.total,
    );
    expect((overview?.counts.by_status ?? []).reduce((sum, row) => sum + row.count, 0)).toBe(
      overview?.counts.total,
    );
    expect(overview?.last_message_role).toBe("assistant");
    expect(overview?.last_message_excerpt).toContain("Dataset prep");
  });

  it("derives a zero-filled snapshot for an empty conversation", async () => {
    const overview = await fetchConversationOverview(empty?.id ?? "");
    expect(overview?.counts.total).toBe(0);
    expect((overview?.counts.by_role ?? []).every((row) => row.count === 0)).toBe(true);
    expect((overview?.counts.by_status ?? []).every((row) => row.count === 0)).toBe(true);
    expect(overview?.last_message_role).toBeNull();
    expect(overview?.last_message_excerpt).toBeNull();
    expect(overview?.recent_messages).toEqual([]);
  });

  it("bounds the recent-message list without changing the totals", async () => {
    const whole = await fetchConversationOverview(conversationId);
    const limited = await fetchConversationOverview(conversationId, { recentLimit: 1 });
    expect(limited?.counts).toEqual(whole?.counts);
    expect(limited?.recent_messages).toHaveLength(1);
    expect(limited?.last_message_excerpt).toBe(whole?.last_message_excerpt);
  });

  it("mirrors router validation, the unknown-conversation 404 and the injected failure", async () => {
    await expect(fetchConversationOverview("not-a-uuid")).rejects.toMatchObject({
      status: 422,
      code: "validation_error",
    });
    await expect(fetchConversationOverview(conversationId, { recentLimit: 0 })).rejects.toMatchObject({
      status: 422,
      code: "validation_error",
    });
    await expect(
      fetchConversationOverview("00000000-0000-4000-8000-000000000000"),
    ).resolves.toBeUndefined();

    setMockFailure("conversationOverview");
    await expect(fetchConversationOverview(conversationId)).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });
  });
});

describe("mock API job overview (C213 follow-up)", () => {
  const jobId = JOB_EVENTS[0]?.job_id ?? "";
  const quietJobId = JOBS.find((job) => !JOB_EVENTS.some((event) => event.job_id === job.id))?.id ?? "";

  it("derives a populated snapshot with identity, event/retry counts and recent events", async () => {
    const overview = await fetchJobOverview(jobId);
    expect(overview).toBeDefined();
    expect(overview?.generated_at).toBe(REFERENCE_NOW);
    expect(overview?.job_id).toBe(jobId);
    expect(overview?.counts.events).toBe(
      JOB_EVENTS.filter((event) => event.job_id === jobId).length,
    );
    expect(overview?.counts.retries).toBe(
      JOB_RETRIES.filter((entry) => entry.job_id === jobId).length,
    );
    expect((overview?.counts.by_event_type ?? []).reduce((sum, row) => sum + row.count, 0)).toBe(
      overview?.counts.events,
    );
    expect((overview?.recent_events ?? []).length).toBeGreaterThan(0);
  });

  it("derives a zero-filled snapshot for a job with no events or retries", async () => {
    const overview = await fetchJobOverview(quietJobId);
    expect(overview?.counts.events).toBe(0);
    expect(overview?.counts.retries).toBe(0);
    expect((overview?.counts.by_event_type ?? []).every((row) => row.count === 0)).toBe(true);
    expect(overview?.recent_events).toEqual([]);
  });

  it("bounds the recent-event list without changing the totals", async () => {
    const whole = await fetchJobOverview(jobId);
    const limited = await fetchJobOverview(jobId, { recentLimit: 1 });
    expect(limited?.counts).toEqual(whole?.counts);
    expect(limited?.recent_events).toHaveLength(1);
  });

  it("mirrors router validation, the unknown-job 404 and the injected failure", async () => {
    await expect(fetchJobOverview("not-a-uuid")).rejects.toMatchObject({
      status: 422,
      code: "validation_error",
    });
    await expect(fetchJobOverview(jobId, { recentLimit: 0 })).rejects.toMatchObject({
      status: 422,
      code: "validation_error",
    });
    await expect(
      fetchJobOverview("00000000-0000-4000-8000-000000000000"),
    ).resolves.toBeUndefined();

    setMockFailure("jobOverview");
    await expect(fetchJobOverview(jobId)).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });
  });
});

describe("mock API provider overview (C217 follow-up)", () => {
  const providerId = PROVIDERS.find((provider) => provider.capabilities?.length)?.id ?? "";

  it("derives a populated snapshot with identity, advertised operations and catalog bindings", async () => {
    const overview = await fetchProviderOverview(providerId);
    expect(overview).toBeDefined();
    expect(overview?.generated_at).toBe(REFERENCE_NOW);
    expect(overview?.provider_id).toBe(providerId);
    const provider = PROVIDERS.find((candidate) => candidate.id === providerId);
    expect(overview?.name).toBe(provider?.name);
    expect(overview?.location).toBe(provider?.location);
    expect(overview?.status).toBe(provider?.status);
    expect(overview?.counts.capabilities).toBe(provider?.capabilities?.length);
    expect(overview?.operation_ids).toEqual(
      [...new Set((provider?.capabilities ?? []).map((capability) => capability.operation_id))].sort(),
    );
    expect((overview?.catalog_operations ?? []).length).toBeGreaterThan(0);
    expect(overview?.counts.advertised_operations).toBe(overview?.operation_ids?.length);
  });

  it("resolves an unknown provider to undefined and injects a failure", async () => {
    await expect(fetchProviderOverview("missing-provider")).resolves.toBeUndefined();

    setMockFailure("providerOverview");
    await expect(fetchProviderOverview(providerId)).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });
  });
});

describe("mock API operation overview (C230 follow-up)", () => {
  const operationId = OPERATION_CATALOG.operations?.[0]?.id ?? "";

  it("derives a populated snapshot with catalog identity, shape and provider bindings", async () => {
    const overview = await fetchOperationOverview(operationId);
    const spec = OPERATION_CATALOG.operations?.find((operation) => operation.id === operationId);
    expect(overview).toBeDefined();
    expect(overview?.generated_at).toBe(REFERENCE_NOW);
    expect(overview?.operation_id).toBe(operationId);
    expect(overview?.title).toBe(spec?.title);
    expect(overview?.schema_version).toBe(spec?.schema_version);
    expect(overview?.setting_keys).toEqual(
      (spec?.settings ?? []).map((setting) => setting.key).sort(),
    );
    expect(overview?.counts.settings).toBe(spec?.settings?.length ?? 0);
    expect((overview?.provider_bindings ?? []).length).toBeGreaterThan(0);
    expect(overview?.counts.provider_bindings).toBe(overview?.provider_bindings?.length);
    expect(overview?.counts.matching_providers).toBe(
      (overview?.provider_bindings ?? []).filter((binding) => binding.schema_match).length,
    );
  });

  it("resolves an unknown operation to undefined and injects a failure", async () => {
    await expect(fetchOperationOverview("missing-operation")).resolves.toBeUndefined();

    setMockFailure("operationOverview");
    await expect(fetchOperationOverview(operationId)).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });
  });
});

describe("mock API chain overview (C234 follow-up)", () => {
  const chainId = PIPELINE_CHAINS[0]?.id ?? "";
  const chain = PIPELINE_CHAINS.find((candidate) => candidate.id === chainId);

  it("derives a populated snapshot from the chain/job/asset/project seeds", async () => {
    const overview = await fetchChainOverview(chainId, { recentLimit: 2 });
    expect(overview).toBeDefined();
    expect(overview?.generated_at).toBe(REFERENCE_NOW);
    expect(overview?.chain_id).toBe(chainId);
    expect(overview?.project_id).toBe(chain?.project_id);
    expect(overview?.kind).toBe(chain?.kind);
    expect(overview?.counts.jobs).toBeGreaterThan(0);
    expect(overview?.counts.assets).toBeGreaterThan(0);
    expect((overview?.recent_jobs ?? []).length).toBeLessThanOrEqual(2);
    expect((overview?.recent_assets ?? []).length).toBeLessThanOrEqual(2);
  });

  it("rejects a malformed id / limit and resolves an unknown chain to undefined", async () => {
    await expect(fetchChainOverview("not-a-uuid")).rejects.toMatchObject({
      status: 422,
      code: "validation_error",
    });
    await expect(fetchChainOverview(chainId, { recentLimit: 0 })).rejects.toMatchObject({
      status: 422,
      code: "validation_error",
    });
    await expect(
      fetchChainOverview("00000000-0000-4000-8000-000000000000"),
    ).resolves.toBeUndefined();
  });

  it("injects a failure for the chainOverview domain", async () => {
    setMockFailure("chainOverview");
    await expect(fetchChainOverview(chainId)).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });
  });
});

describe("mock API plan overview (C238 follow-up)", () => {
  const planId = ORCHESTRATION_PLANS[0]?.plan_id ?? "";
  const plan = ORCHESTRATION_PLANS.find((candidate) => candidate.plan_id === planId);

  it("derives a populated snapshot from the plan/run/project seeds", async () => {
    const overview = await fetchPlanOverview(planId, { recentLimit: 2 });
    expect(overview).toBeDefined();
    expect(overview?.generated_at).toBe(REFERENCE_NOW);
    expect(overview?.plan_id).toBe(planId);
    expect(overview?.project_id).toBe(plan?.project_id);
    expect(overview?.goal).toBe(plan?.goal ?? null);
    expect(overview?.counts.steps).toBe((plan?.steps ?? []).length);
    expect(overview?.counts.runs).toBeGreaterThanOrEqual(0);
    expect((overview?.recent_runs ?? []).length).toBeLessThanOrEqual(2);
    expect(overview?.by_stage).toHaveLength(6);
  });

  it("rejects a malformed id / limit and resolves an unknown plan to undefined", async () => {
    await expect(fetchPlanOverview("not-a-uuid")).rejects.toMatchObject({
      status: 422,
      code: "validation_error",
    });
    await expect(fetchPlanOverview(planId, { recentLimit: 0 })).rejects.toMatchObject({
      status: 422,
      code: "validation_error",
    });
    await expect(
      fetchPlanOverview("00000000-0000-4000-8000-000000000000"),
    ).resolves.toBeUndefined();
  });

  it("injects a failure for the planOverview domain", async () => {
    setMockFailure("planOverview");
    await expect(fetchPlanOverview(planId)).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });
  });
});

describe("mock API run overview (C242 follow-up)", () => {
  const runId = ORCHESTRATION_RUNS[0]?.run_id ?? "";
  const run = ORCHESTRATION_RUNS.find((candidate) => candidate.run_id === runId);
  const plan = ORCHESTRATION_PLANS.find((candidate) => candidate.plan_id === run?.plan_id);

  it("derives a populated snapshot from the run/plan/job/project seeds", async () => {
    const overview = await fetchRunOverview(runId, { recentLimit: 2 });
    expect(overview).toBeDefined();
    expect(overview?.generated_at).toBe(REFERENCE_NOW);
    expect(overview?.run_id).toBe(runId);
    expect(overview?.plan_id).toBe(run?.plan_id);
    expect(overview?.project_id).toBe(plan?.project_id ?? null);
    expect(overview?.plan_goal).toBe(plan?.goal ?? null);
    expect(overview?.counts.jobs_linked).toBe((run?.job_ids ?? []).length);
    expect((overview?.recent_jobs ?? []).length).toBeLessThanOrEqual(2);
    expect(overview?.by_status).toHaveLength(5);
  });

  it("rejects a malformed id / limit and resolves an unknown run to undefined", async () => {
    await expect(fetchRunOverview("not-a-uuid")).rejects.toMatchObject({
      status: 422,
      code: "validation_error",
    });
    await expect(fetchRunOverview(runId, { recentLimit: 0 })).rejects.toMatchObject({
      status: 422,
      code: "validation_error",
    });
    await expect(
      fetchRunOverview("00000000-0000-4000-8000-000000000000"),
    ).resolves.toBeUndefined();
  });

  it("injects a failure for the runOverview domain", async () => {
    setMockFailure("runOverview");
    await expect(fetchRunOverview(runId)).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });
  });
});

describe("mock API upload overview (C246 follow-up)", () => {
  const uploadId = UPLOADS[0]?.upload_id ?? "";
  const upload = UPLOADS.find((candidate) => candidate.upload_id === uploadId);

  it("derives a populated snapshot from the upload/project seeds", async () => {
    const overview = await fetchUploadOverview(uploadId);
    expect(overview).toBeDefined();
    expect(overview?.generated_at).toBe(REFERENCE_NOW);
    expect(overview?.upload_id).toBe(uploadId);
    expect(overview?.filename).toBe(upload?.filename);
    expect(overview?.counts.project_tickets).toBeGreaterThanOrEqual(1);
    expect(overview?.progress).toBeGreaterThanOrEqual(0);
    expect(overview?.progress).toBeLessThanOrEqual(1);
  });

  it("rejects a malformed id and resolves an unknown ticket to undefined", async () => {
    await expect(fetchUploadOverview("not-a-uuid")).rejects.toMatchObject({
      status: 422,
      code: "validation_error",
    });
    await expect(
      fetchUploadOverview("00000000-0000-4000-8000-000000000000"),
    ).resolves.toBeUndefined();
  });

  it("injects a failure for the uploadOverview domain", async () => {
    setMockFailure("uploadOverview");
    await expect(fetchUploadOverview(uploadId)).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });
  });
});

describe("mock API version overview (C250 follow-up)", () => {
  const assetId = ASSETS[0]?.id ?? "";
  const targetVersion = ASSETS[0]?.version ?? 1;

  it("derives a populated snapshot from the version/asset/project seeds", async () => {
    const overview = await fetchVersionOverview(assetId, targetVersion);
    expect(overview).toBeDefined();
    expect(overview?.generated_at).toBe(REFERENCE_NOW);
    expect(overview?.asset_id).toBe(assetId);
    expect(overview?.version).toBe(targetVersion);
    expect(overview?.is_latest).toBe(true);
    expect(overview?.counts.asset_versions).toBeGreaterThanOrEqual(1);
    expect(overview?.storage).toEqual(ASSETS[0]?.storage);
  });

  it("bounds the sibling list without changing whole-asset counts", async () => {
    const overview = await fetchVersionOverview(assetId, targetVersion, { recentLimit: 1 });
    expect(overview?.recent_versions).toHaveLength(1);
    expect(overview?.counts.asset_versions).toBeGreaterThanOrEqual(1);
  });

  it("rejects a malformed id/version/limit and resolves an unknown asset/version to undefined", async () => {
    await expect(fetchVersionOverview("not-a-uuid", 1)).rejects.toMatchObject({
      status: 422,
      code: "validation_error",
    });
    await expect(fetchVersionOverview(assetId, 0)).rejects.toMatchObject({
      status: 422,
      code: "validation_error",
    });
    await expect(fetchVersionOverview(assetId, 1, { recentLimit: 51 })).rejects.toMatchObject({
      status: 422,
      code: "validation_error",
    });
    await expect(
      fetchVersionOverview("00000000-0000-4000-8000-000000000000", 1),
    ).resolves.toBeUndefined();
    await expect(fetchVersionOverview(assetId, 9999)).resolves.toBeUndefined();
  });

  it("injects a failure for the versionOverview domain", async () => {
    setMockFailure("versionOverview");
    await expect(fetchVersionOverview(assetId, targetVersion)).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });
  });
});

describe("mock API extension overview (C222 follow-up)", () => {
  const firstId = extensionId(EXTENSIONS[0]?.manifest.id ?? "");

  it("derives a populated snapshot with manifest identity, trust and declared scope", async () => {
    const overview = await fetchExtensionOverview(firstId);
    expect(overview).toBeDefined();
    expect(overview?.generated_at).toBe(REFERENCE_NOW);
    expect(overview?.extension_id).toBe(firstId);
    const extension = EXTENSIONS.find((candidate) => extensionId(candidate.manifest.id) === firstId);
    expect(overview?.manifest_id).toBe(extension?.manifest.id);
    expect(overview?.name).toBe(extension?.manifest.name);
    expect(overview?.publisher).toBe(extension?.manifest.publisher);
    expect(overview?.type).toBe(extension?.manifest.type);
    expect(overview?.status).toBe(extension?.status);
    expect(overview?.permissions).toEqual(
      [...new Set((extension?.manifest.requirements.permissions ?? []).map((permission) => permission.name))].sort(),
    );
    expect(overview?.counts.permissions).toBe(overview?.permissions?.length);
    expect(overview?.counts.capabilities).toBe(overview?.capabilities?.length);
    expect(overview?.counts.provider_ids).toBe(overview?.provider_ids?.length);
  });

  it("resolves an unknown extension to undefined and injects a failure", async () => {
    await expect(fetchExtensionOverview("00000000-0000-4000-8000-000000000000")).resolves.toBeUndefined();

    setMockFailure("extensionOverview");
    await expect(fetchExtensionOverview(firstId)).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });
  });
});

describe("mock API project overview (C201 follow-up)", () => {
  const filmId = PROJECTS.find((project) => project.name.startsWith("Moonshot"))?.id ?? "";
  const emptyId = PROJECTS.find((project) => project.name.startsWith("Blank Slate"))?.id ?? "";

  it("derives a populated snapshot with identity, counts and recent lists", async () => {
    const overview = await fetchProjectOverview(filmId);
    expect(overview).toBeDefined();
    expect(overview?.generated_at).toBe(REFERENCE_NOW);
    expect(overview?.project_id).toBe(filmId);
    expect(overview?.project_name).toBeTruthy();
    expect(["active", "archived"]).toContain(overview?.lifecycle);
    expect(overview?.counts.assets).toBeGreaterThan(0);
    expect(overview?.counts.jobs).toBeGreaterThan(0);
    expect(overview?.counts.assets).toBe(
      ASSETS.filter((a) => a.project_id === filmId && a.status !== "deleted").length,
    );
    // Newest-first by (created_at, id).
    for (const list of [overview?.recent_jobs ?? [], overview?.recent_assets ?? []]) {
      const keys = list.map((item) => `${item.created_at}|${item.id}`);
      expect(keys).toEqual([...keys].sort().reverse());
    }
    expect((overview?.recent_jobs ?? []).every((item) => item.project_id === filmId)).toBe(true);
    expect((overview?.recent_assets ?? []).every((item) => item.project_id === filmId)).toBe(true);
  });

  it("zero-fills an unseeded project and bounds the recent lists", async () => {
    const empty = await fetchProjectOverview(emptyId);
    // "Blank Slate" has no assets/jobs but does seed a conversation; assert the
    // counts against the authoritative seeds rather than hard-coding zeros.
    expect(empty?.counts).toEqual({
      assets: 0,
      conversations: CONVERSATIONS.filter((c) => c.project_id === emptyId).length,
      jobs: 0,
      comments: COMMENTS.filter((c) => c.project_id === emptyId).length,
      publishes: 0,
      versions: 0,
      collaborators: new Set(
        PRESENCE.filter((p) => p.project_id === emptyId).map((p) => p.user_id),
      ).size,
    });
    expect(empty?.recent_jobs).toEqual([]);
    expect(empty?.recent_assets).toEqual([]);

    const whole = await fetchProjectOverview(filmId);
    const limited = await fetchProjectOverview(filmId, { recentLimit: 1 });
    expect(limited?.counts).toEqual(whole?.counts);
    expect(limited?.recent_jobs).toHaveLength(1);
    expect(limited?.recent_assets).toHaveLength(1);
  });

  it("mirrors router validation, the unknown-project 404 and the injected failure", async () => {
    await expect(fetchProjectOverview("not-a-uuid")).rejects.toMatchObject({
      status: 422,
      code: "validation_error",
    });
    await expect(fetchProjectOverview(filmId, { recentLimit: 0 })).rejects.toMatchObject({
      status: 422,
      code: "validation_error",
    });
    await expect(
      fetchProjectOverview("00000000-0000-4000-8000-000000000000"),
    ).resolves.toBeUndefined();

    setMockFailure("projectOverview");
    await expect(fetchProjectOverview(filmId)).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });
  });
});

describe("mock API job retry statistics (C105 follow-up)", () => {
  const filmId = PROJECTS.find((project) => project.name.startsWith("Moonshot"))?.id ?? "";
  const emptyId = PROJECTS.find((project) => project.name.startsWith("Blank Slate"))?.id ?? "";

  it("derives the authoritative snapshot from the retry ledger seeds", async () => {
    const stats = await fetchRetryStats();
    const jobIds = new Set(JOBS.map((job) => job.id));
    const attributed = JOB_RETRIES.filter((entry) => jobIds.has(entry.job_id));

    expect(stats.total_retries).toBe(attributed.length);
    expect(stats.total_jobs).toBe(new Set(attributed.map((entry) => entry.job_id)).size);
    expect(stats.by_status?.map((bucket) => bucket.status)).toEqual([
      "queued",
      "running",
      "succeeded",
      "failed",
      "canceled",
    ]);
    expect(stats.by_status?.reduce((sum, bucket) => sum + bucket.jobs, 0)).toBe(stats.total_jobs);
    expect(stats.by_project?.reduce((sum, entry) => sum + entry.retries, 0)).toBe(
      stats.total_retries,
    );
    expect(stats.newest_retry_at).toBeTruthy();
    expect(stats.generated_at).toBe(REFERENCE_NOW);
  });

  it("scopes retries to one project (skipping orphans) and zero-fills an unseeded project", async () => {
    const jobProjects = new Map(JOBS.map((job) => [job.id, job.project_id]));
    const filmRetries = JOB_RETRIES.filter(
      (entry) => jobProjects.get(entry.job_id) === filmId,
    ).length;

    const scoped = await fetchRetryStats({ projectId: filmId });
    expect(scoped.total_retries).toBe(filmRetries);
    expect(scoped.total_jobs).toBeGreaterThan(0);
    expect(scoped.by_project?.every((entry) => entry.project_id === filmId)).toBe(true);

    const empty = await fetchRetryStats({ projectId: emptyId });
    expect(empty.total_retries).toBe(0);
    expect(empty.total_jobs).toBe(0);
    expect(empty.by_status?.every((bucket) => bucket.jobs === 0)).toBe(true);
    expect(empty.by_project).toEqual([]);
    expect(empty.newest_retry_at).toBeNull();
  });

  it("mirrors router validation, the unknown-project 404 and the injected failure", async () => {
    await expect(fetchRetryStats({ projectId: "not-a-uuid" })).rejects.toMatchObject({
      status: 422,
      code: "validation_error",
    });
    await expect(
      fetchRetryStats({ projectId: "00000000-0000-4000-8000-000000000000" }),
    ).rejects.toMatchObject({ status: 404, code: "not_found" });

    setMockFailure("retryStats");
    await expect(fetchRetryStats()).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });
  });
});

describe("mock API collaboration feed (C197 follow-up)", () => {
  const filmId = PROJECTS.find((project) => project.name.startsWith("Moonshot"))?.id ?? "";
  const emptyId = PROJECTS.find((project) => project.name.startsWith("Blank Slate"))?.id ?? "";

  it("derives a newest-first feed of presence and comment signals with joined project names", async () => {
    const feed = await fetchCollaborationFeed();
    expect(feed.generated_at).toBe(REFERENCE_NOW);
    expect(feed.total).toBe(PRESENCE.length + COMMENTS.length);
    expect((feed.items ?? []).map((item) => item.signal).sort()).toEqual(
      [...Array(PRESENCE.length).fill("presence"), ...Array(COMMENTS.length).fill("comment")].sort(),
    );
    for (const item of feed.items ?? []) {
      expect(item.project_name).toBeTruthy();
      expect(item.occurred_at).toBeTruthy();
      if (item.signal === "presence") {
        expect(item.state).toBeTruthy();
        expect(item.body).toBeNull();
        expect(item.asset_id).toBeNull();
      } else {
        expect(item.state).toBeNull();
        expect(item.body).toBeTruthy();
      }
    }
    // Newest-first by (occurred_at, signal_id, signal, project_id).
    const keys = (feed.items ?? []).map(
      (item) => `${item.occurred_at}|${item.signal_id}|${item.signal}|${item.project_id}`,
    );
    expect(keys).toEqual([...keys].sort().reverse());
  });

  it("filters to one signal kind", async () => {
    const presence = await fetchCollaborationFeed({ signal: "presence" });
    expect(presence.total).toBe(PRESENCE.length);
    expect(presence.items?.every((item) => item.signal === "presence")).toBe(true);

    const comments = await fetchCollaborationFeed({ signal: "comment" });
    expect(comments.total).toBe(COMMENTS.length);
    expect(comments.items?.every((item) => item.signal === "comment")).toBe(true);
  });

  it("scopes to one project, zero-fills an unseeded project and bounds the page", async () => {
    const scoped = await fetchCollaborationFeed({ projectId: filmId });
    expect(scoped.total).toBeGreaterThan(0);
    expect(scoped.items?.every((item) => item.project_id === filmId)).toBe(true);

    const empty = await fetchCollaborationFeed({ projectId: emptyId });
    expect(empty).toEqual({ items: [], total: 0, generated_at: REFERENCE_NOW });

    const whole = await fetchCollaborationFeed();
    const limited = await fetchCollaborationFeed({ limit: 1 });
    expect(limited.total).toBe(whole.total);
    expect(limited.items ?? []).toHaveLength(1);
  });

  it("mirrors router validation, the unknown-project 404 and the injected failure", async () => {
    await expect(fetchCollaborationFeed({ projectId: "not-a-uuid" })).rejects.toMatchObject({
      status: 422,
      code: "validation_error",
    });
    await expect(fetchCollaborationFeed({ signal: "bogus" as never })).rejects.toMatchObject({
      status: 422,
      code: "validation_error",
    });
    await expect(fetchCollaborationFeed({ limit: 0 })).rejects.toMatchObject({
      status: 422,
      code: "validation_error",
    });
    await expect(
      fetchCollaborationFeed({ projectId: "00000000-0000-4000-8000-000000000000" }),
    ).rejects.toMatchObject({ status: 404, code: "not_found" });

    setMockFailure("collaborationFeed");
    await expect(fetchCollaborationFeed()).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });
  });
});

describe("mock API job retry feed (C193 follow-up)", () => {
  const filmId = PROJECTS.find((project) => project.name.startsWith("Moonshot"))?.id ?? "";
  const emptyId = PROJECTS.find((project) => project.name.startsWith("Blank Slate"))?.id ?? "";

  it("derives a newest-first retry feed with joined project names and whole-scope totals", async () => {
    const feed = await fetchRetryFeed();
    const jobById = new Map(JOBS.map((job) => [job.id, job]));
    const attributed = JOB_RETRIES.filter((entry) => jobById.has(entry.job_id));
    const expectedJobs = new Set(attributed.map((entry) => entry.job_id));

    expect(feed.generated_at).toBe(REFERENCE_NOW);
    expect(feed.total).toBe(expectedJobs.size);
    expect((feed.items ?? []).map((item) => item.job_id).length).toBeLessThanOrEqual(feed.total);
    for (const item of feed.items ?? []) {
      const job = jobById.get(item.job_id)!;
      expect(item.project_id).toBe(job.project_id);
      expect(item.operation_id).toBe(job.operation_id);
      expect(item.retries).toBeGreaterThan(0);
      expect(item.project_name).toBeTruthy();
      expect(item.retried_at).toBeTruthy();
    }
    // Newest-first by (retried_at, job_id).
    const keys = (feed.items ?? []).map((item) => `${item.retried_at}|${item.job_id}`);
    expect(keys).toEqual([...keys].sort().reverse());
  });

  it("counts duplicate ledger entries as retries for one job", async () => {
    const feed = await fetchRetryFeed();
    const twice = JOB_RETRIES.filter(
      (entry) => entry.job_id === "0b5c1e2a-3000-4000-8000-000000000016",
    ).length;
    const item = feed.items?.find(
      (row) => row.job_id === "0b5c1e2a-3000-4000-8000-000000000016",
    );
    expect(twice).toBeGreaterThan(1);
    expect(item?.retries).toBe(twice);
  });

  it("scopes to one project, zero-fills an unseeded project and bounds the page", async () => {
    const scoped = await fetchRetryFeed({ projectId: filmId });
    expect(scoped.total).toBeGreaterThan(0);
    expect(scoped.items?.every((item) => item.project_id === filmId)).toBe(true);

    const empty = await fetchRetryFeed({ projectId: emptyId });
    expect(empty).toEqual({ items: [], total: 0, generated_at: REFERENCE_NOW });

    const whole = await fetchRetryFeed();
    const limited = await fetchRetryFeed({ limit: 1 });
    expect(limited.total).toBe(whole.total);
    expect(limited.items ?? []).toHaveLength(1);
  });

  it("mirrors router validation, the unknown-project 404 and the injected failure", async () => {
    await expect(fetchRetryFeed({ projectId: "not-a-uuid" })).rejects.toMatchObject({
      status: 422,
      code: "validation_error",
    });
    await expect(fetchRetryFeed({ limit: 0 })).rejects.toMatchObject({
      status: 422,
      code: "validation_error",
    });
    await expect(
      fetchRetryFeed({ projectId: "00000000-0000-4000-8000-000000000000" }),
    ).rejects.toMatchObject({ status: 404, code: "not_found" });

    setMockFailure("retryFeed");
    await expect(fetchRetryFeed()).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });
  });
});

describe("mock API publish feed (C125 follow-up)", () => {
  const filmId = PROJECTS.find((project) => project.name.startsWith("Moonshot"))?.id ?? "";
  const emptyId = PROJECTS.find((project) => project.name.startsWith("Blank Slate"))?.id ?? "";

  it("derives a newest-first feed with joined project names and whole-scope totals", async () => {
    const feed = await fetchPublishFeed();
    expect(feed.generated_at).toBe(REFERENCE_NOW);
    expect(feed.total).toBeGreaterThan(0);
    expect((feed.items ?? []).length).toBeGreaterThan(0);
    expect((feed.items ?? []).length).toBeLessThanOrEqual(feed.total);

    const dates = (feed.items ?? []).map((item) => item.published_at);
    expect([...dates].sort().reverse()).toEqual(dates);
    for (const item of feed.items ?? []) {
      const project = PROJECTS.find((candidate) => candidate.id === item.project_id);
      expect(item.project_name).toBe(project?.name ?? "Unknown project");
    }
  });

  it("scopes to one project and bounds the page without changing the total", async () => {
    const full = await fetchPublishFeed();
    const paged = await fetchPublishFeed({ limit: 2 });
    expect(paged.total).toBe(full.total);
    expect((paged.items ?? []).length).toBeLessThanOrEqual(2);
    expect((paged.items ?? []).map((item) => item.asset_id)).toEqual(
      (full.items ?? []).slice(0, 2).map((item) => item.asset_id),
    );

    const scoped = await fetchPublishFeed({ projectId: filmId });
    expect((scoped.items ?? []).every((item) => item.project_id === filmId)).toBe(true);

    const empty = await fetchPublishFeed({ projectId: emptyId });
    expect(empty).toMatchObject({ items: [], total: 0 });
  });

  it("mirrors router validation, 404s unknown projects and surfaces the injected failure", async () => {
    await expect(fetchPublishFeed({ projectId: "not-a-uuid" })).rejects.toMatchObject({
      status: 422,
      code: "validation_error",
    });
    for (const limit of [0, 201]) {
      await expect(fetchPublishFeed({ limit })).rejects.toMatchObject({
        status: 422,
        code: "validation_error",
      });
    }
    await expect(
      fetchPublishFeed({ projectId: "00000000-0000-4000-8000-000000000000" }),
    ).rejects.toMatchObject({ status: 404, code: "not_found" });

    setMockFailure("publishFeed");
    await expect(fetchPublishFeed()).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });
  });
});
