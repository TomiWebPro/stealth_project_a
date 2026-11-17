import { describe, expect, it } from "vitest";

import {
  DEFAULT_ROUTE,
  buildRoutePath,
  findNavItem,
  isRouteId,
  parseRoutePath,
  pathToRoute,
  routeToPath,
} from "./routes";

describe("routes", () => {
  it("maps routes to canonical paths", () => {
    expect(routeToPath(DEFAULT_ROUTE)).toBe("/");
    expect(routeToPath("assets")).toBe("/assets");
  });

  it("resolves paths back to routes, defaulting safely", () => {
    expect(pathToRoute("/")).toBe(DEFAULT_ROUTE);
    expect(pathToRoute("/projects")).toBe("projects");
    expect(pathToRoute("/projects/")).toBe("projects");
    expect(pathToRoute("/unknown")).toBe(DEFAULT_ROUTE);
  });

  it("round-trips every navigable route through path helpers", () => {
    for (const route of [
      "home",
      "chat",
      "projects",
      "assets",
      "jobs",
      "workspaces",
      "extensions",
      "providers",
      "settings",
    ] as const) {
      expect(isRouteId(route)).toBe(true);
      expect(pathToRoute(routeToPath(route))).toBe(route);
    }
  });

  it("finds nav items and rejects unknown routes", () => {
    expect(findNavItem("home")?.label).toBe("Home");
    expect(isRouteId("nope")).toBe(false);
  });

  it("parses and builds entity deep links without changing RouteId", () => {
    expect(parseRoutePath("/projects/project-42")).toEqual({
      route: "projects",
      projectId: "project-42",
    });
    expect(parseRoutePath("/assets/asset-9/")).toEqual({ route: "assets", assetId: "asset-9" });
    expect(parseRoutePath("/chat/conv-1")).toEqual({ route: "chat", conversationId: "conv-1" });
    expect(parseRoutePath("/unknown/deep")).toEqual({ route: DEFAULT_ROUTE });
    expect(buildRoutePath("projects", { projectId: "project-42" })).toBe("/projects/project-42");
    expect(buildRoutePath("assets", { assetId: "asset-9" })).toBe("/assets/asset-9");
    expect(buildRoutePath("chat", { conversationId: "conv-1" })).toBe("/chat/conv-1");
    expect(buildRoutePath("settings")).toBe("/settings");
  });

  it("keeps legacy path helpers consistent with deep-link parsing", () => {
    expect(pathToRoute("/projects/project-42")).toBe("projects");
    expect(parseRoutePath(routeToPath("jobs")).route).toBe("jobs");
  });
});
