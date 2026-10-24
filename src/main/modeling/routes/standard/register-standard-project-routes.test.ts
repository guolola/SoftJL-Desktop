// Checks project-mode isolation, membership permissions and durable clarification through the real HTTP boundary.
import { modelReviewFixtures, standardModelFixture } from "../../../../shared/contracts/testing/index.js";
import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { createInMemoryAuthStore } from "../../auth/in-memory-auth-store.js";
import { createProviderConfigStore } from "../../provider-configs/provider-config-store.js";
import { createInMemoryLlmScheduler } from "../../adapters/llm/llm-scheduler.js";
import { registerStandardProjectRoutes } from "./register-standard-project-routes.js";
import { registerProjectRoutes } from "../projects/register-project-routes.js";
import { createFileDocumentLibrary } from "../../documents/library/document-library.js";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { createStandardProjectState, standardDiagramKinds, validateStandardModel, type StandardProjectState } from "../../../../shared/contracts/index.js";
import { ModelCatalog } from "../../provider-configs/model-catalog.js";
import { restoreStandardSession } from "../../runs/records/standard-agent-session.js";
import { createRunRecordStore } from "../../runs/records/run-record-store.js";
import { conversationTurnMarker } from "../../runs/records/standard-conversation-revision.js";

test("HTTP model edits retain native sequence fragments and reject obsolete, unknown and mismatched payloads", async t => {
  const app = Fastify(); const authStore = createInMemoryAuthStore();
  const owner = authStore.createUser({ username: "nativemodel", displayName: "Owner", passwordHash: "test" })!;
  const cookie = `uml_session=${authStore.createSession({ userId: owner.id, ipAddress: "127.0.0.1", userAgent: "test" }).id}`;
  const { project } = authStore.createProject({ ownerUserId: owner.id, name: "Models", description: null, });
  const state = createStandardProjectState();
  const model = validateStandardModel("sequence", modelReviewFixtures("design", "sequence")[1]!.model);
  state.diagrams.sequence = { id: "sequence", kind: "sequence", title: "业务时序", status: "completed", model };
  const workspace = authStore.getProjectWorkspace(project.id);
  authStore.saveProjectWorkspace({ projectId: project.id, baseVersion: workspace.version, updatedByUserId: owner.id, state: { standardProject: state } });
  let renders = 0;
  registerStandardProjectRoutes({ app, authStore, providerConfigs: createProviderConfigStore({ secret: "test" }), llmScheduler: createInMemoryLlmScheduler(),
    llmTransport: { async *streamChatCompletion() { throw new Error("Editing must not call a model"); } },
    renderClient: async artifact => { renders++; assert.match(artifact.source, /\balt\b/); assert.match(artifact.source, /\bloop\b/);
      return { svg: "<svg>native</svg>", renderMeta: { engine: "test", generatedAt: "now", sourceLength: artifact.source.length, durationMs: 1 } }; },
    pngRenderClient: async () => { throw new Error("No document conversion"); } });
  t.after(() => app.close());
  const url = `/api/projects/${project.id}/standard/diagrams/sequence`;
  const response = await app.inject({ method: "PUT", url, headers: { cookie }, payload: model });
  assert.equal(response.statusCode, 200, response.body);
  assert.deepEqual(response.json().state.diagrams.sequence.model, model);
  for (const payload of [{ nodes: [], edges: [] }, { ...model, unexpected: true }, standardModelFixture("class")]) {
    const invalid = await app.inject({ method: "PUT", url, headers: { cookie }, payload });
    assert.equal(invalid.statusCode, 400, invalid.body);
  }
  assert.equal(renders, 1, "invalid edits must fail before rendering or overwriting the saved model");
  const saved = authStore.getProjectWorkspace(project.id).state as { standardProject: StandardProjectState };
  assert.deepEqual(saved.standardProject.diagrams.sequence.model, model);
});

test("HTTP saves all eight current models and rejects old payloads before rendering or writing", async t => {
  const app = Fastify(); const authStore = createInMemoryAuthStore();
  const owner = authStore.createUser({ username: "eightmodels", displayName: "Owner", passwordHash: "test" })!;
  const cookie = `uml_session=${authStore.createSession({ userId: owner.id, ipAddress: "127.0.0.1", userAgent: "test" }).id}`;
  const { project } = authStore.createProject({ ownerUserId: owner.id, name: "Eight models", description: null, });
  const state = createStandardProjectState();
  for (const kind of standardDiagramKinds) state.diagrams[kind] = { id: kind, kind, title: kind, status: "completed", model: standardModelFixture(kind) };
  const workspace = authStore.getProjectWorkspace(project.id);
  authStore.saveProjectWorkspace({ projectId: project.id, baseVersion: workspace.version, updatedByUserId: owner.id, state: { standardProject: state } });
  const renders: string[] = [];
  registerStandardProjectRoutes({ app, authStore, providerConfigs: createProviderConfigStore({ secret: "test" }), llmScheduler: createInMemoryLlmScheduler(),
    llmTransport: { async *streamChatCompletion() { throw new Error("No LLM for structural edits"); } },
    renderClient: async artifact => { renders.push(artifact.modelId); return { svg: "<svg>current</svg>", renderMeta: { engine: "test", generatedAt: "now", sourceLength: artifact.source.length, durationMs: 1 } }; },
    pngRenderClient: async () => { throw new Error("No document conversion"); } });
  t.after(() => app.close());
  for (const kind of standardDiagramKinds) {
    const url = `/api/projects/${project.id}/standard/diagrams/${kind}`;
    const model = standardModelFixture(kind);
    const saved = await app.inject({ method: "PUT", url, headers: { cookie }, payload: model });
    assert.equal(saved.statusCode, 200, saved.body);
    assert.deepEqual(saved.json().state.diagrams[kind].model, JSON.parse(JSON.stringify(model)));
    for (const payload of [{ nodes: [], edges: [] }, { ...model, edges: [] }]) {
      const rejected = await app.inject({ method: "PUT", url, headers: { cookie }, payload });
      assert.equal(rejected.statusCode, 400, rejected.body);
    }
    const after = (await app.inject({ url: `/api/projects/${project.id}/standard`, headers: { cookie } })).json();
    assert.deepEqual(after.state.diagrams[kind].model, JSON.parse(JSON.stringify(model)));
  }
  assert.deepEqual(renders, [...standardDiagramKinds]);
});

test("model context reads canonical catalog capacity without requiring output metadata or starting a paid call", async t => {
  const app = Fastify(); const authStore = createInMemoryAuthStore();
  const owner = authStore.createUser({ username: "capacity", displayName: "Owner", passwordHash: "test" })!;
  const cookie = `uml_session=${authStore.createSession({ userId: owner.id, ipAddress: "127.0.0.1", userAgent: "test" }).id}`;
  const { project } = authStore.createProject({ ownerUserId: owner.id, name: "Capacity", description: null,  });
  const providerConfigs = createProviderConfigStore({ secret: "test" }); const model = "deepseek-v4.1-flash";
  const config = providerConfigs.create({ name: "test", baseUrl: "https://ai.comfly.org", apiKey: "test", defaultModel: model, allowedModels: [model], createdBy: "test" });
  const dir = await mkdtemp(join(tmpdir(), "uml-context-route-"));
  const previous = process.env.UML_STANDARD_CONTEXT_TOKENS; delete process.env.UML_STANDARD_CONTEXT_TOKENS;
  t.after(async () => {
    await app.close(); assert.ok(resolve(dir).startsWith(resolve(tmpdir()) + sep)); await rm(dir, { recursive: true, force: true });
    if (previous === undefined) delete process.env.UML_STANDARD_CONTEXT_TOKENS; else process.env.UML_STANDARD_CONTEXT_TOKENS = previous;
  });
  const modelCatalog = new ModelCatalog(join(dir, "catalog.json"), async () => ({ providers: [{ id: "empty" }, { id: "complete" }], models: [
    { provider: "empty", id: model, created_by: "deepseek" },
    { provider: "complete", id: `deepseek/${model}`, created_by: "deepseek", context_window: 1000000 },
  ] }));
  await modelCatalog.load(); await modelCatalog.refresh(); let calls = 0;
  registerStandardProjectRoutes({ app, authStore, providerConfigs, modelCatalog, llmScheduler: createInMemoryLlmScheduler(),
    llmTransport: { async *streamChatCompletion() { calls++; yield "unused"; } }, renderClient: async () => { throw new Error("unused"); }, pngRenderClient: async () => { throw new Error("unused"); } });
  const response = await app.inject({ url: `/api/projects/${project.id}/model-context?${new URLSearchParams({ providerConfigId: config.id, model })}`, headers: { cookie } });
  assert.equal(response.statusCode, 200, response.body);
  assert.equal(response.json().capacity.context, 1000000); assert.equal(response.json().capacity.output, null);
  assert.equal(response.json().capacity.source, "modelpedia"); assert.equal(response.json().contextBudget, 1000000); assert.equal(calls, 0);
  const engineering = authStore.createProject({ ownerUserId: owner.id, name: "Engineering", description: null,  }).project;
  const sharedUrl = `/api/projects/${engineering.id}/model-context?${new URLSearchParams({ providerConfigId: config.id, model })}`;
  const shared = await app.inject({ url: sharedUrl, headers: { cookie } });
  assert.equal(shared.statusCode, 200, shared.body);
  assert.deepEqual(shared.json(), response.json());
  assert.equal((await app.inject({ url: sharedUrl })).statusCode, 401);
  assert.equal(calls, 0);
});

test("acknowledges chat with its durable user message before model execution and never duplicates retries", async t => {
  const app = Fastify(); const authStore = createInMemoryAuthStore();
  const owner = authStore.createUser({ username: "ack", displayName: "Owner", passwordHash: "test" })!;
  const cookie = `uml_session=${authStore.createSession({ userId: owner.id, ipAddress: "127.0.0.1", userAgent: "test" }).id}`;
  const { project } = authStore.createProject({ ownerUserId: owner.id, name: "Chat", description: null,  });
  const providerConfigs = createProviderConfigStore({ secret: "test" });
  const config = providerConfigs.create({ name: "test", baseUrl: "https://example.test", apiKey: "test", defaultModel: "test", allowedModels: ["test"], createdBy: "test" });
  const scheduler = createInMemoryLlmScheduler();
  const runs = createRunRecordStore();
  let extensionStarts = 0;
  // Stop at the scheduling boundary: this test must never contact an external provider.
  scheduler.run = async () => { throw new Error("test queue stopped"); };
  registerStandardProjectRoutes({ app, runs, authStore, providerConfigs, llmScheduler: scheduler,
    agentExtensions: { extensionFactories: [pi => { pi.on("session_start", () => { extensionStarts++; }); }] },
    llmTransport: { async *streamChatCompletion() { throw new Error("unexpected model call"); } },
    renderClient: async () => { throw new Error("unexpected rendering"); }, pngRenderClient: async () => { throw new Error("unexpected rendering"); } });
  t.after(() => app.close());
  const url = `/api/projects/${project.id}/standard`;
  const requestId = "11111111-1111-4111-8111-111111111111";
  const payload = { operation: "chat", requestId, message: "你好", quote: { text: "引用内容" },
    attachments: [{ id: "file", name: "scope.txt", type: "document", contentType: "text/plain", text: "附件内容" }],
    providerSettings: { providerConfigId: config.id, model: "test" } };
  const started = await app.inject({ method: "POST", url, headers: { cookie }, payload });
  assert.equal(started.statusCode, 202, started.body);
  const acknowledged = started.json().state;
  assert.equal(acknowledged.conversation.length, 1);
  assert.deepEqual(acknowledged.conversation[0], { id: `user:${requestId}`, role: "user", text: "你好", status: "completed",
    createdAt: acknowledged.conversation[0].createdAt, quote: payload.quote, attachments: payload.attachments });
  assert.equal(acknowledged.piSession, undefined);
  assert.equal(acknowledged.acceptedCommands, undefined);
  const repeated = await app.inject({ method: "POST", url, headers: { cookie }, payload });
  assert.equal(repeated.statusCode, 200);
  assert.equal(runs.size, 1);
  const run = [...runs.values()][0];
  assert.equal(run.snapshot.runId, acknowledged.run.id);
  assert.equal(run.snapshot.operationType, "quick_modeling");
  assert.equal(run.metadata?.projectId, project.id);
  assert.equal(run.metadata?.userId, owner.id);
  // Failed model calls still occupy the same accepted-message task.
  for (let i = 0; i < 100 && !run.terminal; i++) await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(run.snapshot.status, "failed");
  assert.equal(extensionStarts, 1, "HTTP commands use the extensions supplied by server composition");
  assert.ok(run.metadata?.completedAt);
  const second = await app.inject({ method: "POST", url, headers: { cookie }, payload: { ...payload, requestId: "22222222-2222-4222-8222-222222222222", message: "再来一条消息" } });
  assert.equal(second.statusCode, 202, second.body);
  assert.equal(runs.size, 2);
  const persisted = (await app.inject({ url, headers: { cookie } })).json().state;
  assert.equal(persisted.conversation.filter((message: { role: string }) => message.role === "user").length, 2);
});

for (const alternative of [false, true]) test(`HTTP ${alternative ? "alternative" : "scope"} confirmation validates choice identifiers and persists new consent before the model runs`, async t => {
  const app = Fastify(); const authStore = createInMemoryAuthStore();
  const owner = authStore.createUser({ username: "scope", displayName: "Owner", passwordHash: "test" })!;
  const cookie = `uml_session=${authStore.createSession({ userId: owner.id, ipAddress: "127.0.0.1", userAgent: "test" }).id}`;
  const { project } = authStore.createProject({ ownerUserId: owner.id, name: "Scope", description: null, });
  const providerConfigs = createProviderConfigStore({ secret: "test" });
  const config = providerConfigs.create({ name: "test", baseUrl: "https://example.test", apiKey: "test", defaultModel: "test", allowedModels: ["test"], createdBy: "test" });
  const state = createStandardProjectState("考研自习室座位预约小程序");
  state.generationScope = { status: "confirmed", kinds: ["function", "usecase", "activity"] };
  if (alternative) state.unsupportedDiagramRequest = { models: ["UML 状态图"], messageId: "user:earlier", questionId: "scope" };
  state.rounds = [{ purpose: "generation_scope", answers: [], questions: [{ id: "scope", title: "是否新增领域模型？", multiple: false,
    options: ["是，加入并生成领域概念图", "不生成"], recommendation: "推荐新增", scopeChoices: [
      { id: "yes", label: "是，加入并生成领域概念图", kinds: ["er"], recommended: true },
      { id: "no", label: "不生成", kinds: [], recommended: false },
    ] }] }];
  const workspace = authStore.getProjectWorkspace(project.id);
  authStore.saveProjectWorkspace({ projectId: project.id, baseVersion: workspace.version, updatedByUserId: owner.id, state: { standardProject: state } });
  let scheduled = 0;
  const scheduler = createInMemoryLlmScheduler(); scheduler.run = async () => { scheduled++; throw new Error("test queue stopped"); };
  registerStandardProjectRoutes({ app, authStore, providerConfigs, llmScheduler: scheduler,
    llmTransport: { async *streamChatCompletion() { throw new Error("unexpected model call"); } },
    renderClient: async () => { throw new Error("unexpected rendering"); }, pngRenderClient: async () => { throw new Error("unexpected rendering"); } });
  t.after(() => app.close());
  const payload = { operation: "chat", requestId: "33333333-3333-4333-8333-333333333333", providerSettings: { providerConfigId: config.id, model: "test" } };
  const send = (answers: unknown[]) => app.inject({ method: "POST", url: `/api/projects/${project.id}/standard`, headers: { cookie }, payload: { ...payload, answers } });
  for (const selectedOptionIds of [["concept_er"], ["yes", "no"], undefined]) {
    const rejected = await send([{ questionId: "scope", answer: "同意", selectedOptionIds }]);
    assert.equal(rejected.statusCode, 409, rejected.body);
  }
  assert.equal(scheduled, 0);
  const stale = await send([{ questionId: "scope_old", answer: "同意", selectedOptionIds: ["yes"] }]);
  assert.equal(stale.statusCode, 409);
  assert.deepEqual((authStore.getProjectWorkspace(project.id).state.standardProject as StandardProjectState).generationScope, state.generationScope);
  const answers = [{ questionId: "scope", answer: "是，加入并生成领域概念图", selectedOptionIds: ["yes"] }];
  const accepted = await send(answers);
  assert.equal(accepted.statusCode, 202, accepted.body);
  assert.deepEqual(accepted.json().state.generationScope, { status: "confirmed", kinds: ["er"] });
  assert.equal(accepted.json().state.unsupportedDiagramRequest, undefined);
  assert.deepEqual(accepted.json().state.rounds[0].answers, answers);
  assert.deepEqual(accepted.json().state.conversation[0].answers, answers);
  const replay = await send(answers);
  assert.equal(replay.statusCode, 200, replay.body);
  assert.equal(replay.json().state.conversation.filter((message: { role: string }) => message.role === "user").length, 1);
});

test("revision commands require current history, valid user content and stored attachment capabilities before starting a model call", async t => {
  const app = Fastify(); const authStore = createInMemoryAuthStore();
  const owner = authStore.createUser({ username: "revision", displayName: "Owner", passwordHash: "test" })!;
  const cookie = `uml_session=${authStore.createSession({ userId: owner.id, ipAddress: "127.0.0.1", userAgent: "test" }).id}`;
  const { project } = authStore.createProject({ ownerUserId: owner.id, name: "Revision", description: null,  });
  const providerConfigs = createProviderConfigStore({ secret: "test" });
  const config = providerConfigs.create({ name: "test", baseUrl: "https://ai.comfly.org", apiKey: "test", defaultModel: "test", allowedModels: ["test"], createdBy: "test" });
  const providerSettings = { providerConfigId: config.id, model: "test" };
  const manager = restoreStandardSession(project.id);
  manager.appendCustomEntry(conversationTurnMarker, { messageId: "u", rounds: [] });
  const state: StandardProjectState = { ...createStandardProjectState(), piSession: { entries: manager.getEntries(), leafId: manager.getLeafId() }, conversation: [
    { id: "u", role: "user", text: "describe this image", status: "completed", createdAt: "now", attachments: [{ id: "f", name: "i.png", type: "image", contentType: "image/png", data: "iVBORw0KGgo=" }] },
    { id: "a", role: "assistant", text: "saved response", status: "completed", createdAt: "now" },
  ] };
  const workspace = authStore.getProjectWorkspace(project.id);
  authStore.saveProjectWorkspace({ projectId: project.id, baseVersion: workspace.version, updatedByUserId: owner.id, state: { standardProject: state } });
  let calls = 0;
  registerStandardProjectRoutes({ app, authStore, providerConfigs, llmScheduler: createInMemoryLlmScheduler(),
    llmTransport: { async *streamChatCompletion() { calls++; yield "unused"; } }, renderClient: async () => { throw new Error("unused"); }, pngRenderClient: async () => { throw new Error("unused"); } });
  t.after(() => app.close());
  const path = `/api/projects/${project.id}/standard`;
  const send = (payload: Record<string, unknown>) => app.inject({ method: "POST", url: path, headers: { cookie }, payload: { ...payload, providerSettings } });
  assert.equal((await send({ operation: "edit", messageId: "u", message: "new requirement" })).statusCode, 409);
  assert.equal((await send({ operation: "edit", messageId: "u", expectedHeadId: "stale", message: "new requirement" })).statusCode, 409);
  assert.equal((await send({ operation: "edit", messageId: "a", expectedHeadId: "a", message: "new requirement" })).statusCode, 409);
  assert.equal((await send({ operation: "edit", messageId: "u", expectedHeadId: "a", useRecommendations: true })).statusCode, 400);
  // Forged empty attachments cannot bypass checking the stored original image when regenerating.
  const regenerate = await send({ operation: "regenerate", messageId: "a", expectedHeadId: "a", attachments: [] });
  assert.equal(regenerate.statusCode, 400); assert.equal(regenerate.json().error.code, "VALIDATION_FAILED");
  const persisted = (await app.inject({ url: path, headers: { cookie } })).json().state;
  assert.deepEqual(persisted.conversation, state.conversation); assert.equal(persisted.run, undefined); assert.equal(calls, 0);
});

test("stop preserves completed artifacts and continuation resumes only the saved unfinished scope", async t => {
  const app = Fastify(); const authStore = createInMemoryAuthStore();
  const owner = authStore.createUser({ username: "resume", displayName: "Owner", passwordHash: "test" })!;
  const cookie = `uml_session=${authStore.createSession({ userId: owner.id, ipAddress: "127.0.0.1", userAgent: "test" }).id}`;
  const { project } = authStore.createProject({ ownerUserId: owner.id, name: "Recovery", description: "system",  });
  const providerConfigs = createProviderConfigStore({ secret: "test" });
  const config = providerConfigs.create({ name: "test", baseUrl: "https://ai.comfly.org", apiKey: "test", defaultModel: "test", allowedModels: ["test"], createdBy: "test" });
  const providerSettings = { providerConfigId: config.id, model: "test" };
  const state: StandardProjectState = { ...createStandardProjectState("system"), outline: { title: "System", summary: "Borrow", roles: [{ id: "user", name: "User", description: "Borrow" }], businesses: [{ id: "borrow", name: "Borrow", roleIds: ["user"], description: "Borrow", steps: ["Submit"], exceptions: [] }], entities: [{ id: "book", name: "Book", attributes: ["ID"] }], modules: ["Books"], relationships: [], assumptions: [] },
    diagrams: { function: { id: "function", kind: "function", title: "Keep", status: "completed", svg: "<svg>keep</svg>" }, class: { id: "class", kind: "class", title: "Class", status: "failed" } } };
  const workspace = authStore.getProjectWorkspace(project.id);
  authStore.saveProjectWorkspace({ projectId: project.id, baseVersion: workspace.version, updatedByUserId: owner.id, state: { standardProject: state } });
  let block = true; let calls = 0;
  registerStandardProjectRoutes({ app, authStore, providerConfigs, llmScheduler: createInMemoryLlmScheduler(),
    llmTransport: { async *streamChatCompletion(input) {
      calls++; assert.equal(JSON.parse(String(input.messages[1]!.content)).task.id, "class");
      if (block) await new Promise<void>((_, reject) => {
        const abort = () => reject(new Error("stopped")); input.abortSignal?.addEventListener("abort", abort, { once: true }); if (input.abortSignal?.aborted) abort();
      });
      yield JSON.stringify(standardModelFixture("class"));
    } },
    renderClient: async () => ({ svg: "<svg>new</svg>", renderMeta: { engine: "test", generatedAt: "now", sourceLength: 1, durationMs: 1 } }),
    pngRenderClient: async () => { throw new Error("No documents"); },
  });
  t.after(() => app.close());
  const path = `/api/projects/${project.id}/standard`;
  const start = await app.inject({ method: "POST", url: path, headers: { cookie }, payload: { operation: "retry", diagramId: "class", providerSettings } });
  assert.equal(start.statusCode, 202, start.body);
  for (let at = 0; calls === 0 && at < 100; at++) await new Promise(resolve => setTimeout(resolve, 5));
  const stopped = await app.inject({ method: "POST", url: `${path}/cancel`, headers: { cookie } });
  assert.equal(stopped.json().state.run.status, "stopped");
  assert.equal(stopped.json().state.diagrams.function.svg, "<svg>keep</svg>");
  const runId = stopped.json().state.run.id;
  for (let at = 0; at < 3; at++) assert.equal((await app.inject({ method: "GET", url: path, headers: { cookie } })).json().state.run.id, runId);
  assert.equal(calls, 1, "reconnecting reads never restart work");
  block = false;
  const continued = await app.inject({ method: "POST", url: path, headers: { cookie }, payload: { operation: "resume", resumeRunId: runId, providerSettings } });
  assert.equal(continued.statusCode, 202, continued.body);
  let finished = continued.json().state;
  for (let at = 0; at < 100; at++) { finished = (await app.inject({ method: "GET", url: path, headers: { cookie } })).json().state; if (finished.run.status !== "running") break; await new Promise(resolve => setTimeout(resolve, 5)); }
  assert.equal(finished.run.status, "completed"); assert.equal(finished.run.continuedFrom, runId);
  assert.equal(finished.diagrams.function.svg, "<svg>keep</svg>"); assert.equal(finished.diagrams.class.status, "completed"); assert.equal(calls, 2);
  const stale = await app.inject({ method: "POST", url: path, headers: { cookie }, payload: { operation: "resume", resumeRunId: runId, providerSettings } });
  assert.equal(stale.statusCode, 409); assert.equal(calls, 2);
});

// A real service replacement must unlock the persisted run without sending another model request.
test("reconciles a run left by a previous process and preserves its completed artifacts and continuation scope", async t => {
  const app = Fastify(); const authStore = createInMemoryAuthStore();
  const owner = authStore.createUser({ username: "restart", displayName: "Owner", passwordHash: "test" })!;
  const cookie = `uml_session=${authStore.createSession({ userId: owner.id, ipAddress: "127.0.0.1", userAgent: "test" }).id}`;
  const { project } = authStore.createProject({ ownerUserId: owner.id, name: "Restart", description: "Saved requirements",  });
  const workspace = authStore.getProjectWorkspace(project.id);
  const state: StandardProjectState = { ...createStandardProjectState("Saved requirements"),
    run: { id: "previous-process-run", operation: "chat", status: "running", startedAt: new Date(Date.now() - process.uptime() * 1000 - 60000).toISOString(), work: { ids: ["class"] } },
    conversation: [{ id: "partial", role: "assistant", text: "Partial response", status: "streaming", createdAt: "now" }],
    diagrams: { function: { id: "function", kind: "function", title: "Keep", status: "completed", svg: "<svg>keep</svg>" }, class: { id: "class", kind: "class", title: "Unfinished", status: "running", phase: "generating" } } };
  authStore.saveProjectWorkspace({ projectId: project.id, baseVersion: workspace.version, updatedByUserId: owner.id, state: { standardProject: state } });
  let calls = 0;
  registerStandardProjectRoutes({ app, authStore, providerConfigs: createProviderConfigStore({ secret: "test" }), llmScheduler: createInMemoryLlmScheduler(),
    llmTransport: { async *streamChatCompletion() { calls++; yield "unused"; } }, renderClient: async () => { throw new Error("unused"); }, pngRenderClient: async () => { throw new Error("unused"); } });
  t.after(() => app.close());
  const url = `/api/projects/${project.id}/standard`;
  const result = (await app.inject({ url, headers: { cookie } })).json().state;
  assert.equal(result.run.status, "stopped"); assert.equal(result.run.interruptionReason, "server_restart");
  assert.deepEqual(result.run.work.ids, ["class"]); assert.equal(result.run.id, "previous-process-run");
  assert.equal(result.diagrams.function.svg, "<svg>keep</svg>"); assert.equal(result.diagrams.class.status, "failed"); assert.equal(result.diagrams.class.phase, undefined);
  assert.equal(result.conversation[0].status, "failed"); assert.equal(result.description, "Saved requirements");
  assert.equal((await app.inject({ url, headers: { cookie } })).json().state.run.finishedAt, result.run.finishedAt);
  assert.equal(calls, 0, "recovery reads must not generate or restart anything");
  // An obsolete terminal presentation is returned as stored; reads no longer migrate it.
  const stoppedWorkspace = authStore.getProjectWorkspace(project.id);
  const stoppedState = stoppedWorkspace.state.standardProject as StandardProjectState;
  stoppedState.conversation![0]!.status = "streaming";
  authStore.saveProjectWorkspace({ projectId: project.id, baseVersion: stoppedWorkspace.version,
    updatedByUserId: owner.id, state: { standardProject: stoppedState } });
  const storedVersion = authStore.getProjectWorkspace(project.id).version;
  assert.equal((await app.inject({ url, headers: { cookie } })).json().state.conversation[0].status, "streaming");
  assert.equal(authStore.getProjectWorkspace(project.id).version, storedVersion);
});
