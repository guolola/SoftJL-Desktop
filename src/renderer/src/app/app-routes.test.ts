import { describe, expect, it } from "vitest";

import { matchAppRoute } from "./app-routes.js";

describe("matchAppRoute dashboard", () => {
  it("sends the community entry to the project list", () => {
    expect(matchAppRoute("/")).toEqual({
      kind: "legacy-redirect",
      path: "/",
      to: "/projects",
    });
  });
  it("does not expose the retired exam placeholder", () => {
    expect(matchAppRoute("/exam")).toEqual({
      kind: "not-found",
      path: "/exam",
    });
  });
  it.each([
    "/features",
    "/workflow",
    "/cases",
    "/pricing",
    "/account/billing",
    "/billing/alipay/return",
    "/admin",
    "/organizations",
    "/courses",
    "/classes",
    "/teams",
  ])("excludes the hosted-only route %s", (path) => {
    expect(matchAppRoute(path)).toEqual({ kind: "not-found", path });
  });
  it.each(["lineage", "history", "settings", "documents"])(
    "matches the project %s page",
    (section) => {
      expect(matchAppRoute(`/projects/project%20one/${section}`)).toEqual({
        kind: "project-workspace",
        path: `/projects/project%20one/${section}`,
        projectId: "project one",
        section,
      });
    },
  );
  it("leaves retired tutorial routes to the server redirect", () => {
    expect(matchAppRoute("/tutorial")).toEqual({
      kind: "not-found",
      path: "/tutorial",
    });
  });
  it("matches the platform dashboard route", () => {
    expect(matchAppRoute("/dashboard")).toEqual({
      kind: "dashboard",
      path: "/dashboard",
    });
  });

  it("does not capture project paths", () => {
    expect(matchAppRoute("/projects").kind).toBe("projects-index");
  });
});

it.each(["/login", "/register"])(
  "desktop redirects %s directly to projects",
  (path) => {
    expect(matchAppRoute(path)).toEqual({
      kind: "legacy-redirect",
      path: "/",
      to: "/projects",
    });
  },
);
it.each(["/projects/local-project/code", "/projects/connections", "/account/connections", "/projects/local-project/members"])("desktop excludes retired route %s", (path) => {
  expect(matchAppRoute(path)).toEqual({ kind: "not-found", path });
});
