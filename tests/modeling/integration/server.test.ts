// Verifies the retained conversation boundary and removal of engineering HTTP workflows.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { createApiServer } from "../../../src/main/modeling/index.js";
import { createInMemoryAuthStore } from "../../../src/main/modeling/auth/in-memory-auth-store.js";
import { createProviderConfigStore } from "../../../src/main/modeling/provider-configs/provider-config-store.js";
import { createRunRecordStore } from "../../../src/main/modeling/runs/records/run-record-store.js";
import { createFileDocumentLibrary } from "../../../src/main/modeling/documents/library/document-library.js";
import { createInMemoryLlmScheduler } from "../../../src/main/modeling/adapters/llm/llm-scheduler.js";

test("projects expose one conversation workflow and reject removed engineering APIs", async t => {
  const root = await mkdtemp(join(tmpdir(), "softjl-conversation-only-"));
  const authStore = createInMemoryAuthStore();
  const owner = authStore.createUser({ username: "owner", displayName: "Owner", passwordHash: "test" })!;
  const outsider = authStore.createUser({ username: "outsider", displayName: "Other", passwordHash: "test" })!;
  const cookie = (userId: string) => `uml_session=${authStore.createSession({ userId, ipAddress: null, userAgent: "test" }).id}`;
  const headers = { cookie: cookie(owner.id) };
  const { project } = authStore.createProject({ ownerUserId: owner.id, name: "图书管理", description: null });
  const providerConfigs = createProviderConfigStore({ secret: "test" });
  const config = providerConfigs.create({ name: "Test", baseUrl: "https://example.test", apiKey: "test", defaultModel: "test", allowedModels: ["test"], createdBy: "test" });
  const scheduler = createInMemoryLlmScheduler(); scheduler.run = async () => { throw new Error("test provider failure"); };
  const runs = createRunRecordStore();
  const app = await createApiServer({ nodeEnv: "test", authStore, providerConfigStore: providerConfigs, runRecordStore: runs,
    documentLibrary: createFileDocumentLibrary(root), llmScheduler: scheduler,
    llmTransport: { async *streamChatCompletion() { throw new Error("No external traffic"); } },
    renderClient: async () => { throw new Error("No rendering"); }, pngRenderClient: async () => { throw new Error("No rendering"); } });
  t.after(async () => { await app.close(); assert.ok(resolve(root).startsWith(resolve(tmpdir()) + sep)); await rm(root, { recursive: true, force: true }); });
  const url = `/api/projects/${project.id}/standard`;
  assert.equal((await app.inject({ url })).statusCode, 401);
  assert.ok([403, 404].includes((await app.inject({ url, headers: { cookie: cookie(outsider.id) } })).statusCode));
  assert.equal((await app.inject({ url, headers })).statusCode, 200);
  const created = await app.inject({ method: "POST", url: "/api/projects", headers, payload: { name: "新项目" } });
  assert.equal(created.statusCode, 201, created.body); assert.equal(Object.hasOwn(created.json().project, "projectMode"), false);
  for (const projectMode of ["standard", "professional"]) assert.equal((await app.inject({ method: "POST", url: "/api/projects", headers, payload: { name: "旧请求", projectMode } })).statusCode, 400);
  for (const [method, endpoint] of [
    ["POST", "/api/runs"], ["POST", "/api/design-runs"], ["POST", "/api/document-runs"], ["POST", "/api/feasibility-runs"],
    ["GET", `/api/projects/${project.id}/workspace`], ["PUT", `/api/projects/${project.id}/workspace`],
    ["POST", `/api/projects/${project.id}/runs/old/retry`], ["POST", `/api/projects/${project.id}/runs/old/cancel`],
    ["POST", `/api/projects/${project.id}/code`], ["POST", "/api/render/model"], ["POST", "/api/cases/library-seat/project"],
  ] as const) assert.equal((await app.inject({ method, url: endpoint, headers, ...(method !== "GET" ? { payload: {} } : {}) })).statusCode, 404, endpoint);
  const payload = { operation: "chat", requestId: "11111111-1111-4111-8111-111111111111", message: "梳理借阅需求", providerSettings: { providerConfigId: config.id, model: "test" } };
  const started = await app.inject({ method: "POST", url, headers, payload });
  assert.equal(started.statusCode, 202, started.body); assert.equal(started.json().state.conversation[0].text, payload.message);
  assert.equal(started.json().state.piSession, undefined);
  assert.equal((await app.inject({ method: "POST", url, headers, payload })).statusCode, 200);
  for (let attempt = 0; attempt < 200 && ![...runs.values()][0]?.terminal; attempt++) await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(runs.size, 1); assert.equal([...runs.values()][0]?.snapshot.operationType, "quick_modeling");
  assert.equal([...runs.values()][0]?.snapshot.status, "failed");
  const history = await app.inject({ url: `/api/projects/${project.id}/runs`, headers });
  assert.equal(history.statusCode, 200, history.body); assert.equal(history.json().runs[0].operationType, "quick_modeling");
});
