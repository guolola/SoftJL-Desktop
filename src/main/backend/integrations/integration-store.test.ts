// Verifies persistent settings, credential boundaries and per-turn Skill selection without external services.
import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { IntegrationStore } from "./integration-store.js";
import { loadStandardAgentResources } from "../../modeling/runs/pipelines/standard/standard-agent-resources.js";
import { SettingsManager } from "@earendil-works/pi-coding-agent";
import { createStandardResourceReadTool } from "../../modeling/runs/pipelines/standard/standard-modeling-knowledge.js";
import { mcpSaveSchema } from "../../../shared/contracts/agent-integrations.js";

test("recommended integrations persist, credentials are encrypted and omitted maps retain them", async t => {
  const directory = await mkdtemp(join(tmpdir(), "softjl-integrations-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = await IntegrationStore.open(directory, "test-key");
  const initial = await store.overview();
  assert.equal(initial.servers.length, 6); assert.equal(initial.skills.length, 7);
  assert.ok(initial.servers.every(item => !item.enabled));
  assert.ok(initial.servers.every(item => item.exposure === "direct"));
  assert.equal(mcpSaveSchema.parse({ name: "Docs", description: "", enabled: false, config: { type: "http", url: "https://example.test/mcp" } }).exposure, "direct");
  await store.saveServer("private-docs", { name: "Private docs", description: "test", enabled: true, exposure: "deferred", config: { type: "http", url: "https://example.test/mcp", headers: { Authorization: "Bearer private-test-credential" } } });
  assert.ok(!(await readFile(join(directory, "integrations.json"), "utf8")).includes("private-test-credential"));
  const view = (await store.overview()).servers.find(item => item.id === "private-docs")!;
  assert.deepEqual(view.headerKeys, ["Authorization"]); assert.equal(JSON.stringify(view).includes("private-test-credential"), false);
  await store.saveServer(view.id, { name: view.name, description: view.description, enabled: false, exposure: view.exposure, config: view.config });
  const reopened = await IntegrationStore.open(directory, "test-key");
  await reopened.saveServer(view.id, { name: view.name, description: view.description, enabled: true, exposure: view.exposure, config: view.config });
  const runtime = await reopened.runtimeSnapshot();
  const server = runtime.servers.find(item => item.id === view.id)!;
  assert.equal(server.config.type === "http" && server.config.headers?.Authorization, "Bearer private-test-credential");
  await assert.rejects(IntegrationStore.open(directory, "wrong-key"), /不兼容或无法解密/u);
});

test("missing prerequisites cannot be enabled and core skills cannot be replaced or deleted", async t => {
  const directory = await mkdtemp(join(tmpdir(), "softjl-integrations-")); t.after(() => rm(directory, { recursive: true, force: true }));
  const store = await IntegrationStore.open(directory, "test-key");
  for (const id of ["filesystem", "dbhub", "github"]) {
    const item = (await store.overview()).servers.find(item => item.id === id)!;
    await assert.rejects(store.saveServer(id, { name: item.name, description: item.description, enabled: true, exposure: item.exposure, config: item.config }), /请/u);
    assert.equal((await store.testServer(id)).ok, false);
  }
  const core = (await store.overview()).skills.find(item => item.required)!;
  await assert.rejects(store.deleteSkill(core.id), /不能删除/u);
  await assert.rejects(store.saveSkill(core.id, { name: core.id, description: "override", content: "override", enabled: false }), /不能覆盖/u);
  await assert.rejects(store.saveSkill("../escape", { name: "escape", description: "test", content: "test", enabled: true }));
  assert.ok(!(await store.runtimeSnapshot()).servers.length);
});

test("Skill snapshots load in Pi and remain isolated from later edits and unrelated files", async t => {
  const directory = await mkdtemp(join(tmpdir(), "softjl-integrations-")); t.after(() => rm(directory, { recursive: true, force: true }));
  const store = await IntegrationStore.open(directory, "test-key");
  await store.saveSkill("local-workflow", { name: "local-workflow", description: "When reviewing test cases", content: "# Workflow\nUse existing evidence.", enabled: true });
  const first = await store.runtimeSnapshot();
  const loader = await loadStandardAgentResources(directory, SettingsManager.inMemory(), "test", { managedSkillPaths: first.skillPaths });
  assert.equal(loader.getSkills().skills.length, 8);
  assert.deepEqual(loader.getSkills().diagnostics, []);
  const path = first.skillPaths.find(path => path.includes("local-workflow"))!;
  await store.saveSkill("local-workflow", { name: "local-workflow", description: "When reviewing test cases", content: "# Workflow\nChanged guidance.", enabled: false });
  assert.equal((await store.runtimeSnapshot()).skillPaths.some(path => path.includes("local-workflow")), false);
  assert.match(await readFile(join(path, "SKILL.md"), "utf8"), /Use existing evidence/u);
  const read = createStandardResourceReadTool(undefined, first.skillRoots);
  const result = await read.execute("read", { path: join(path, "SKILL.md") });
  assert.ok(result.content.some(part => part.type === "text" && part.text.includes("Use existing evidence")));
  await writeFile(join(directory, "secret.md"), "private");
  await assert.rejects(read.execute("escape", { path: join(directory, "secret.md") }), /只允许/u);
});
