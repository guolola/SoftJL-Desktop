// Exercises actual filesystem-backed local persistence and the desktop API boundary without calling a model.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startDesktopBackend } from "./server.js";
test("desktop has no login, rejects unrelated clients, and persists modeling projects across restarts without retired coding endpoints", async () => {
  const root = await mkdtemp(join(tmpdir(), "softjl-desktop-")),
    dataDir = join(root, "data");
  const options = {
    dataDir,
    secret: "isolated-test-key",
    capability: "desktop-test-capability",
    directorySelectionCapability: "native-directory-test-capability",
    jarPath: "unused",
    javaPath: "unused",
  };
  let server: Awaited<ReturnType<typeof startDesktopBackend>> | undefined;
  const headers = { "x-softjl-desktop": options.capability };
  try {
    server = await startDesktopBackend(options);
    assert.equal((await server.app.inject({ url: "/api/desktop/integrations" })).statusCode, 403);
    const integrations = (await server.app.inject({ url: "/api/desktop/integrations", headers })).json();
    assert.equal(integrations.servers.length, 6);
    assert.equal(integrations.skills.length, 7);
    const rejected = await server.app.inject({ method: "PUT", url: "/api/desktop/integrations/mcp/dbhub", headers,
      payload: { name: "DBHub", description: "test", enabled: true, exposure: "codemode", config: integrations.servers.find((item: { id: string }) => item.id === "dbhub").config } });
    assert.equal(rejected.statusCode, 400); assert.match(rejected.json().message, /环境变量/u);
    assert.equal(
      (await server.app.inject({ url: "/api/projects" })).statusCode,
      403,
    );
    assert.deepEqual(
      (await server.app.inject({ url: "/api/projects", headers })).json()
        .projects,
      [],
    );
    assert.equal(
      (
        await server.app.inject({
          method: "POST",
          url: "/api/auth/register",
          headers,
          payload: {},
        })
      ).statusCode,
      404,
    );
    const created = await server.app.inject({
      method: "POST",
      url: "/api/projects",
      headers,
      payload: {
        name: "Local Project",
        description: null,
        projectMode: "standard",
      },
    });
    assert.equal(created.statusCode, 201, created.body);
    const id = created.json().project.id;
    await mkdir(join(root, "project-code"));
    const codeDirectory = await realpath(join(root, "project-code"));
    const workspaceUrl = `/api/desktop/projects/${id}/conversation-code`;
    assert.deepEqual((await server.app.inject({ url: workspaceUrl, headers })).json(), { directory: null, approvals: [], busy: false });
    assert.equal((await server.app.inject({ url: workspaceUrl })).statusCode, 403);
    assert.equal((await server.app.inject({ method: "POST", url: `${workspaceUrl}/approvals/expired`, headers, payload: { runId: "old-run", allow: true } })).statusCode, 409);
    assert.equal((await server.app.inject({ method: "POST", url: workspaceUrl, headers, payload: { directory: codeDirectory } })).statusCode, 403);
    assert.equal((await server.app.inject({ method: "POST", url: workspaceUrl, headers: { ...headers, "x-softjl-directory-selection": options.directorySelectionCapability }, payload: { directory: codeDirectory } })).statusCode, 200);
    assert.equal((await server.app.inject({ url: workspaceUrl, headers })).json().directory, codeDirectory);
    const professional = await server.app.inject({ method: "POST", url: "/api/projects", headers, payload: { name: "Engineering project", description: null, projectMode: "professional" } });
    const professionalWorkspaceUrl = `/api/desktop/projects/${professional.json().project.id}/conversation-code`;
    assert.equal((await server.app.inject({ method: "POST", url: professionalWorkspaceUrl, headers: { ...headers, "x-softjl-directory-selection": options.directorySelectionCapability }, payload: { directory: codeDirectory } })).statusCode, 200);
    for (const [method, url] of [
      ["GET", "/api/desktop/agents"],
      ["GET", "/api/desktop/projects/" + id + "/coding"],
      ["POST", "/api/desktop/projects/" + id + "/coding"],
      ["POST", "/api/desktop/projects/" + id + "/coding/agent"],
      ["PUT", "/api/desktop/projects/" + id + "/workspace"],
      ["POST", "/api/desktop/mcp/retired-task"],
    ] as const) {
      assert.equal((await server.app.inject({ method, url, headers, ...(method !== "GET" ? { payload: {} } : {}) })).statusCode, 404, url);
    }
    const tables = await server.db.query<{ table_name: string }>("select table_name from information_schema.tables where table_schema='public'");
    assert.ok(!tables.rows.some((row) => /^(desktop_coding_tasks|desktop_workspaces|mcp_)/u.test(row.table_name)));
    const firstOrigin = server.origin;
    await server.close();
    server = await startDesktopBackend(options);
    assert.equal((await server.app.inject({ url: workspaceUrl, headers })).json().directory, codeDirectory);
    assert.equal((await server.app.inject({ url: professionalWorkspaceUrl, headers })).json().directory, codeDirectory);
    assert.equal(server.origin, firstOrigin);
    assert.deepEqual((await server.app.inject({ url: workspaceUrl, headers })).json().approvals, []);
    assert.equal((await server.app.inject({ method: "DELETE", url: workspaceUrl, headers })).json().directory, null);
    assert.equal(
      (await server.app.inject({ url: "/api/projects", headers })).json()
        .projects.find((item: any) => item.id === id).name,
      "Local Project",
    );
    assert.equal(
      (
        await server.app.inject({
          method: "POST",
          url: "/api/projects/" + id + "/invitations",
          headers,
          payload: {},
        })
      ).statusCode,
      404,
    );
  } finally {
    await server?.close();
    await rm(root, { recursive: true, force: true });
  }
});
