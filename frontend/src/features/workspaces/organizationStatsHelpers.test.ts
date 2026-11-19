import { describe, expect, it } from "vitest";
import type { OrganizationStats } from "../../lib/types";
import {
  formatOrganizationAverage,
  hasOrganizationStatsData,
  organizationAverageLabel,
  organizationMemberRows,
  organizationRoleRows,
  organizationStatsCards,
  organizationStatsGeneratedAtLabel,
  organizationStatsRelativeLabel,
  shortOrganizationId,
} from "./organizationStatsHelpers";

const NOW = Date.parse("2026-01-01T01:00:00Z");

const ORG_A = "11111111-1111-4111-8111-111111111111";
const ORG_B = "22222222-2222-4222-8222-222222222222";

const populated: OrganizationStats = {
  total_organizations: 2,
  total_members: 5,
  total_users: 7,
  by_role: [
    { role: "owner", members: 2 },
    { role: "admin", members: 1 },
    { role: "member", members: 1 },
    { role: "viewer", members: 1 },
  ],
  by_organization: [
    { org_id: ORG_A, members: 4 },
    { org_id: ORG_B, members: 1 },
  ],
  average_members_per_org: 2.5,
  newest_org_at: "2026-01-01T00:30:00Z",
  generated_at: "2026-01-01T00:59:30Z",
};

const empty: OrganizationStats = {
  total_organizations: 0,
  total_members: 0,
  total_users: 0,
  by_role: [
    { role: "owner", members: 0 },
    { role: "admin", members: 0 },
    { role: "member", members: 0 },
    { role: "viewer", members: 0 },
  ],
  by_organization: [],
  average_members_per_org: 0,
  newest_org_at: null,
  generated_at: "2026-01-01T00:00:00Z",
};

describe("organization stats formatters", () => {
  it("formats per-org averages with safe fallbacks and up to three decimals", () => {
    expect(formatOrganizationAverage(2.5)).toBe("2.5");
    expect(formatOrganizationAverage(1.2345)).toBe("1.235");
    expect(formatOrganizationAverage(0)).toBe("0");
    expect(formatOrganizationAverage(undefined)).toBe("—");
    expect(formatOrganizationAverage(null)).toBe("—");
    expect(formatOrganizationAverage(Number.NaN)).toBe("—");
    expect(formatOrganizationAverage(-1)).toBe("—");
  });

  it("shortens long org ids and keeps short ones intact", () => {
    expect(shortOrganizationId(ORG_A)).toBe("11111111…");
    expect(shortOrganizationId("short")).toBe("short");
  });

  it("formats relative labels and treats invalid timestamps as raw values", () => {
    expect(organizationStatsRelativeLabel(null)).toBe("");
    expect(organizationStatsRelativeLabel(undefined)).toBe("");
    expect(organizationStatsRelativeLabel("2026-01-01T00:30:00Z", NOW)).toBe("30 minutes ago");
    expect(organizationStatsRelativeLabel("not-a-date", NOW)).toBe("not-a-date");
  });
});

describe("organizationStatsCards", () => {
  it("derives the three workspace counters plus newest-org recency in a stable order", () => {
    const cards = organizationStatsCards(populated, NOW);
    expect(cards.map((card) => card.key)).toEqual([
      "organizations",
      "members",
      "users",
      "newest",
    ]);
    expect(cards.map((card) => card.value)).toEqual(["2", "5", "7", "30 minutes ago"]);
  });

  it("zero-fills every counter when the snapshot is absent or empty", () => {
    expect(organizationStatsCards(undefined, NOW).map((card) => card.value)).toEqual([
      "0",
      "0",
      "0",
      "—",
    ]);
    expect(organizationStatsCards(empty, NOW)[3]?.value).toBe("—");
  });
});

describe("organizationRoleRows", () => {
  it("returns a complete zero-filled owner/admin/member/viewer breakdown with shares", () => {
    const rows = organizationRoleRows(populated);
    expect(rows.map((row) => row.role)).toEqual(["owner", "admin", "member", "viewer"]);
    expect(rows[0]).toMatchObject({ label: "Owner", count: 2, percent: 40, fraction: 0.4, tone: "accent" });
    expect(rows[1]).toMatchObject({ label: "Admin", count: 1, percent: 20, fraction: 0.2, tone: "info" });
    expect(rows[3]).toMatchObject({ label: "Viewer", count: 1, percent: 20 });
  });

  it("ignores malformed entries and never divides by zero on empty snapshots", () => {
    const rows = organizationRoleRows({
      ...populated,
      by_role: [
        { role: "owner", members: Number.NaN },
        { role: "admin", members: 4 },
      ],
    });
    expect(rows[0]?.count).toBe(0);
    expect(rows[1]?.percent).toBe(100);
    expect(organizationRoleRows(undefined).every((row) => row.fraction === 0)).toBe(true);
    expect(organizationRoleRows(empty).every((row) => row.percent === 0)).toBe(true);
  });
});

describe("organizationMemberRows", () => {
  it("derives per-org shares with friendly names and a short-id fallback", () => {
    const rows = organizationMemberRows(populated, { [ORG_B]: "Effects Studio" });
    expect(rows.map((row) => row.orgId)).toEqual([ORG_A, ORG_B]);
    expect(rows[0]).toMatchObject({ label: "11111111…", count: 4, percent: 80, fraction: 0.8 });
    expect(rows[1]).toMatchObject({ label: "Effects Studio", count: 1, percent: 20, fraction: 0.2 });
  });

  it("re-sorts unsafely ordered entries and zero-fills when absent", () => {
    const rows = organizationMemberRows({
      ...populated,
      by_organization: [
        { org_id: ORG_B, members: 1 },
        { org_id: ORG_A, members: 4 },
      ],
    });
    expect(rows.map((row) => row.orgId)).toEqual([ORG_A, ORG_B]);
    expect(organizationMemberRows(undefined)).toEqual([]);
    expect(organizationMemberRows(empty)).toEqual([]);
  });
});

describe("organizationAverageLabel and hasOrganizationStatsData", () => {
  it("formats the derived average safely", () => {
    expect(organizationAverageLabel(populated)).toBe("2.5");
    expect(organizationAverageLabel(undefined)).toBe("—");
  });

  it("detects empty snapshots across all three counters", () => {
    expect(hasOrganizationStatsData(populated)).toBe(true);
    expect(hasOrganizationStatsData(empty)).toBe(false);
    expect(hasOrganizationStatsData(undefined)).toBe(false);
    expect(hasOrganizationStatsData({ ...empty, total_users: 3 })).toBe(true);
  });

  it("derives a generated-at footer label", () => {
    expect(organizationStatsGeneratedAtLabel(populated, NOW)).toBe("30 seconds ago");
    expect(organizationStatsGeneratedAtLabel(undefined, NOW)).toBe("");
  });
});
