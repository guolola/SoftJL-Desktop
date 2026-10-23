// Verifies the desktop dialog bridge, not a second implementation of plugin permission policy.
import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { ExtensionUIContext } from "@earendil-works/pi-coding-agent";
import { ConversationCodingService } from "./coding-service.js";

async function setup(t: test.TestContext) {
  const root = await mkdtemp(join(tmpdir(), "softjl-dialog-"));
  const data = join(root, "data"), code = join(root, "code"); await Promise.all([mkdir(data), mkdir(code)]);
  let directory: string | null = null;
  const service = new ConversationCodingService({ read: async () => directory, write: async (_, value) => { directory = value; } }, data);
  const controller = new AbortController();
  t.after(async () => { service.close(); await rm(root, { recursive: true, force: true }); });
  const run = await service.open("p", "run", controller.signal);
  const ui = run.createUI({} as ExtensionUIContext);
  return { service, controller, run, ui, code, data };
}
test("plugin selects return the exact option and reject stale, foreign and invented answers", async t => {
  const s = await setup(t);
  const answer = s.ui.select("Permission", ["Allow once", "Allow session", "Deny"]);
  const prompt = (await s.service.status("p")).approvals[0]!;
  for (const [project, run] of [["other", "run"], ["p", "old"]]) assert.throws(() => s.service.answer(project!, run!, prompt.id, "Allow once"), /失效/);
  assert.throws(() => s.service.answer("p", "run", prompt.id, "invented"), /选项/);
  s.service.answer("p", "run", prompt.id, "Allow session");
  assert.equal(await answer, "Allow session");
  assert.throws(() => s.service.answer("p", "run", prompt.id, "Allow once"), /失效/);
});
test("abort, close and plugin timeout dismiss prompts without approving", async t => {
  const s = await setup(t);
  assert.equal(await s.ui.select("Timed", ["Yes"], { timeout: 5 }), undefined);
  const input = s.ui.input("Question"); s.controller.abort(); assert.equal(await input, undefined);
  assert.deepEqual((await s.service.status("p")).approvals, []);
  s.run.close(); assert.equal((await s.service.status("p")).busy, false);
});
test("editor bridge preserves multiline prefill and user edits", async t => {
  const s = await setup(t);
  const response = s.ui.editor("Instructions", "first\nsecond");
  const prompt = (await s.service.status("p")).approvals[0]!;
  assert.equal(prompt.initialValue, "first\nsecond");
  assert.equal(prompt.multiline, true);
  s.service.answer("p", "run", prompt.id, "first\nchanged");
  assert.equal(await response, "first\nchanged");
});
test("questions work without a code directory and native tools require a selected directory", async t => {
  const s = await setup(t);
  const registered: string[] = [];
  await s.run.extension({ on() {}, registerTool: (tool: { name: string }) => registered.push(tool.name) } as never);
  assert.deepEqual(registered, []);
  const input = s.ui.input("Project name"); const prompt = (await s.service.status("p")).approvals[0]!;
  s.service.answer("p", "run", prompt.id, "Library"); assert.equal(await input, "Library");
  await assert.rejects(s.service.select("p", s.code), /先停止/);
  s.run.close(); await s.service.select("p", s.code);
  const run = await s.service.open("p", "next", new AbortController().signal);
  await run.extension({ on() {}, registerTool: (tool: { name: string }) => registered.push(tool.name) } as never);
  assert.ok(registered.includes("write") && registered.includes("powershell")); assert.ok(!registered.some(name => name.startsWith("project_")));
  run.close(); await assert.rejects(s.service.select("p", s.data), /应用数据/);
});
