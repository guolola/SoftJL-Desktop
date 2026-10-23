// Exercises real Pi tools against temporary directories, explicit reviews and actual PowerShell child processes.
import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, parse } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import { createStandardProjectState } from "../../../shared/contracts/index.js";
import { ConversationCodingService, scopedPath } from "./coding-service.js";

async function setup(t: TestContext) {
  const temporary = await mkdtemp(join(tmpdir(), "softjl-conversation-"));
  const root = join(temporary, "project"), data = join(temporary, "data"), outside = join(temporary, "outside");
  await Promise.all([root, data, outside].map(path => mkdir(path)));
  const directories = new Map<string, string>();
  const service = new ConversationCodingService({ read: async id => directories.get(id) ?? null,
    write: async (id, path) => { if (path === null) directories.delete(id); else directories.set(id, path); } }, data);
  const controller = new AbortController();
  t.after(async () => { controller.abort(); service.close(); await rm(temporary, { recursive: true, force: true }); });
  await service.select("p", root);
  const run = await service.open("p", "run", controller.signal, () => createStandardProjectState("借阅系统"));
  t.after(run.close);
  const tools = new Map<string, ToolDefinition<any, any, any>>();
  await run.extension({ registerTool: (tool: ToolDefinition<any, any, any>) => tools.set(tool.name, tool), on: () => {} } as never);
  const invoke = (name: string, input: unknown) => {
    const result = tools.get(name)!.execute(`call-${name}`, input, controller.signal, undefined, { cwd: outside } as never);
    void result.catch(() => undefined);
    return result;
  };
  const approval = async () => {
    for (let i = 0; i < 200; i++) { const review = (await service.status("p")).approvals[0]; if (review) return review; await delay(10); }
    throw new Error("未出现审批");
  };
  const allow = async () => { const review = await approval(); service.approve("p", "run", review.id, true); return review; };
  return { root, outside, data, service, controller, run, tools, invoke, approval, allow };
}

test("native file write and exact edit require approval and ignore the Pi session cwd", async t => {
  const s = await setup(t);
  const writing = s.invoke("project_write", { path: "src/index.ts", content: "export const value = 1;\n" });
  const review = await s.approval();
  assert.match(review.warning!, /缺少模型、测试用例、需求规格说明书、软件设计说明书/);
  assert.deepEqual(review.changes, [{ oldText: "", newText: "export const value = 1;\n" }]);
  await assert.rejects(readFile(join(s.root, "src/index.ts")), { code: "ENOENT" });
  s.service.approve("p", "run", review.id, true);
  await writing;
  assert.equal(await readFile(join(s.root, "src/index.ts"), "utf8"), "export const value = 1;\n");
  await assert.rejects(readFile(join(s.outside, "src/index.ts")), { code: "ENOENT" });
  assert.throws(() => s.service.approve("p", "run", review.id, true), /失效/);
  const editing = s.invoke("project_edit", { path: "src/index.ts", edits: [{ oldText: "value = 1", newText: "value = 2" }] });
  await s.allow(); await editing;
  const reading = s.invoke("project_read", { path: "src/index.ts" }); await s.allow();
  assert.match(JSON.stringify(await reading), /value = 2/);
  const listing = s.invoke("project_list", { path: "src" }); await s.allow();
  assert.match(JSON.stringify(await listing), /index.ts/);
});

test("denial is single-use, cannot be replayed, and cancellation drops pending reviews without writing", async t => {
  const s = await setup(t);
  const input = { path: "denied.ts", content: "must not exist" };
  const writing = s.invoke("project_write", input);
  const review = await s.approval();
  assert.throws(() => s.service.approve("other", "run", review.id, true), /失效/);
  assert.throws(() => s.service.approve("p", "old-run", review.id, true), /失效/);
  s.service.approve("p", "run", review.id, false);
  await assert.rejects(writing, /用户拒绝/);
  await assert.rejects(s.invoke("project_write", input), /不得再次请求/);
  const pending = s.invoke("project_write", { path: "cancelled.ts", content: "no" });
  await s.approval(); s.controller.abort();
  await assert.rejects(pending, /取消/);
  assert.equal((await s.service.status("p")).approvals.length, 0);
  await assert.rejects(readFile(join(s.root, "denied.ts")), { code: "ENOENT" });
  await assert.rejects(readFile(join(s.root, "cancelled.ts")), { code: "ENOENT" });
});

test("directory traversal, absolute escapes and junctions are rejected before an approval", async t => {
  const s = await setup(t);
  await writeFile(join(s.outside, "secret.txt"), "outside");
  for (const path of ["../outside/secret.txt", join(s.outside, "secret.txt")])
    await assert.rejects(s.invoke("project_read", { path }), /只能访问/);
  await symlink(s.outside, join(s.root, "linked"), process.platform === "win32" ? "junction" : "dir");
  await assert.rejects(s.invoke("project_write", { path: "linked/new.txt", content: "escape" }), /不能通过链接/);
  assert.equal((await s.service.status("p")).approvals.length, 0);
  assert.equal(await scopedPath(await realpath(s.root), "safe/new.ts"), join(await realpath(s.root), "safe/new.ts"));
});

test("approvals cannot overwrite concurrent edits or follow a junction swapped during the review", async t => {
  const s = await setup(t);
  await writeFile(join(s.root, "existing.ts"), "before");
  const writing = s.invoke("project_write", { path: "existing.ts", content: "after" });
  await s.approval(); await writeFile(join(s.root, "existing.ts"), "user change"); await s.allow();
  await assert.rejects(writing, /等待审批时已变化/);
  assert.equal(await readFile(join(s.root, "existing.ts"), "utf8"), "user change");
  await mkdir(join(s.root, "safe"));
  const swapping = s.invoke("project_write", { path: "safe/new.ts", content: "no" });
  await s.approval(); await rm(join(s.root, "safe"), { recursive: true });
  await symlink(s.outside, join(s.root, "safe"), process.platform === "win32" ? "junction" : "dir");
  await s.allow(); await assert.rejects(swapping, /不能通过链接/);
  await assert.rejects(readFile(join(s.outside, "new.ts")), { code: "ENOENT" });
});

test("directory grants are per-project, block changes during a run, and expose no tools until selected", async t => {
  const s = await setup(t);
  assert.equal((await s.service.status("other")).directory, null);
  await assert.rejects(s.service.select("p", s.outside), /先停止/);
  s.run.close();
  await assert.rejects(s.service.select("p", parse(s.root).root), /具体项目/);
  await assert.rejects(s.service.select("p", s.data), /应用数据/);
  await s.service.select("p", null);
  const noGrant = await s.service.open("p", "second", new AbortController().signal, () => createStandardProjectState());
  const registered: string[] = [];
  await noGrant.extension({ registerTool: (tool: { name: string }) => registered.push(tool.name), on: () => {} } as never);
  assert.deepEqual(registered, []); noGrant.close();
});

test("actual PowerShell commands run in the selected directory and preserve nonzero exits", async t => {
  const s = await setup(t);
  for (const code of [0, 7]) {
    const command = s.invoke("project_command", { command: `node -e "console.log(process.cwd()); process.exit(${code})"`, timeout: 30 });
    const review = await s.allow(); assert.match(review.warning!, /当前 Windows 用户权限/);
    const result = await command;
    assert.equal(result.structuredContent.exit_code, code);
    assert.match(result.structuredContent.output.toLowerCase(), /softjl-conversation/);
    assert.ok(result.structuredContent.output.toLowerCase().includes("project"));
    assert.equal(Boolean(result.isError), code !== 0);
  }
});

test("cancelling an approved command terminates its child process tree", async t => {
  const s = await setup(t);
  await writeFile(join(s.root, "runner.cjs"), `const {spawn}=require('node:child_process');const fs=require('node:fs');const child=spawn(process.execPath,['-e',"setTimeout(()=>require('node:fs').writeFileSync('escaped-after-cancel.txt','bad'),1800)"]);fs.writeFileSync('started.txt',String(child.pid));setInterval(()=>{},1000);`);
  const running = s.invoke("project_command", { command: "node runner.cjs", timeout: 30 });
  await s.allow();
  let started = false;
  for (let i = 0; i < 300; i++) { try { await readFile(join(s.root, "started.txt")); started = true; break; } catch { await delay(10); } }
  assert.equal(started, true, "actual child process started");
  s.controller.abort(); await assert.rejects(running, /aborted|取消/i);
  await delay(2100);
  await assert.rejects(readFile(join(s.root, "escaped-after-cancel.txt")), { code: "ENOENT" });
});
