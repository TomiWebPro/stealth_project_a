import { describe, expect, it } from "vitest";

import {
  DEFAULT_ROUTE,
  findNavItem,
  isRouteId,
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
});
