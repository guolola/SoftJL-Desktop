// Exercises approval responses through authenticated HTTP, including active-run and membership checks.
import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createStandardProjectState } from "../../../../shared/contracts/index.js";
import { ConversationCodingService } from "../../../backend/conversation/coding-service.js";
import { createInMemoryAuthStore } from "../../auth/in-memory-auth-store.js";
import { registerConversationCodingRoutes } from "./register-conversation-coding-routes.js";

test("only a project member can approve a current run, once; stopped reviews and directory changes are rejected", async t => {
  const root = await mkdtemp(join(tmpdir(), "softjl-coding-http-"));
  const directory = join(root, "project"), data = join(root, "data"); await Promise.all([mkdir(directory), mkdir(data)]);
  const auth = createInMemoryAuthStore(); const app = Fastify(); const controller = new AbortController();
  const owner = auth.createUser({ username: "owner", displayName: "Owner", passwordHash: "test" })!;
  const other = auth.createUser({ username: "other", displayName: "Other", passwordHash: "test" })!;
  const cookie = (id: string) => `uml_session=${auth.createSession({ userId: id, ipAddress: null, userAgent: "test" }).id}`;
  const headers = { cookie: cookie(owner.id) }, outsider = { cookie: cookie(other.id) };
  const { project } = auth.createProject({ ownerUserId: owner.id, name: "Coding", description: null, projectMode: "standard" });
  let selected: string | null = null;
  const service = new ConversationCodingService({ read: async () => selected, write: async (_, value) => { selected = value; } }, data);
  t.after(async () => { controller.abort(); service.close(); await app.close(); await rm(root, { recursive: true, force: true }); });
  await service.select(project.id, directory);
  const state = createStandardProjectState(); state.run = { id: "run", operation: "chat", status: "running", startedAt: "now" };
  const save = () => auth.saveProjectWorkspace({ projectId: project.id, baseVersion: auth.getProjectWorkspace(project.id).version, updatedByUserId: owner.id, state: { standardProject: state } });
  save(); const run = await service.open(project.id, "run", controller.signal, () => state); t.after(run.close);
  registerConversationCodingRoutes(app, auth, service, "native");
  const base = `/api/desktop/projects/${project.id}/conversation-code`;
  assert.equal((await app.inject({ url: base })).statusCode, 401);
  assert.equal((await app.inject({ method: "DELETE", url: base, headers })).statusCode, 409);
  for (const allow of [true, false]) {
    const waiting = service.request(project.id, { runId: "run", toolCallId: "call", tool: "project_write", title: "写入", directory, detail: "code" }, controller.signal);
    void waiting.catch(() => undefined);
    const review = (await service.status(project.id)).approvals[0]!;
    const url = `${base}/approvals/${review.id}`;
    assert.ok([403, 404].includes((await app.inject({ method: "POST", url, headers: outsider, payload: { runId: "run", allow } })).statusCode));
    assert.equal((await app.inject({ method: "POST", url, headers, payload: { runId: "old", allow } })).statusCode, 409);
    assert.equal((await app.inject({ method: "POST", url, headers, payload: { runId: "run", allow: "yes" } })).statusCode, 400);
    assert.equal((await app.inject({ method: "POST", url, headers, payload: { runId: "run", allow } })).statusCode, 200);
    if (allow) await waiting; else await assert.rejects(waiting, /用户拒绝/);
    assert.equal((await app.inject({ method: "POST", url, headers, payload: { runId: "run", allow } })).statusCode, 409);
  }
  const pending = service.request(project.id, { runId: "run", toolCallId: "last", tool: "project_command", title: "测试", directory, detail: "npm test" }, controller.signal);
  void pending.catch(() => undefined); const review = (await service.status(project.id)).approvals[0]!;
  state.run.status = "stopped"; save();
  assert.equal((await app.inject({ method: "POST", url: `${base}/approvals/${review.id}`, headers, payload: { runId: "run", allow: true } })).statusCode, 409);
  controller.abort(); await assert.rejects(pending, /取消/);
});
