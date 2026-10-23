// Checks the built desktop's coding reviews and command results using controlled UI responses, without a provider or real project edits.
import assert from "node:assert/strict";
import { join } from "node:path";

export async function verifyConversationCoding(page, projectId, screenshots) {
  const projectPath = `/projects/${encodeURIComponent(projectId)}`;
  const stateUrl = new URL(`/api${projectPath}/standard`, page.url()).href;
  const codingUrl = new URL(`/api/desktop/projects/${encodeURIComponent(projectId)}/conversation-code`, page.url()).href;
  const snapshot = await page.evaluate(async url => (await fetch(url)).json(), stateUrl);
  snapshot.state.run = { id: "coding-smoke-run", operation: "chat", status: "running", startedAt: new Date().toISOString() };
  snapshot.state.conversation = [{ id: "coding-user", role: "user", text: "根据当前设计实现借阅上限并执行测试。", createdAt: new Date().toISOString(), status: "completed" }];
  const directory = "C:\\example-project\\library";
  const status = { directory, busy: true, approvals: [] };
  let accepted = 0;
  const serveState = route => route.fulfill({ json: snapshot });
  const serveCoding = route => route.fulfill({ json: status });
  const decide = async route => {
    assert.deepEqual(route.request().postDataJSON(), { runId: "coding-smoke-run", allow: true });
    accepted++;
    const tool = snapshot.state.conversation.at(-1).tools[0];
    tool.status = "completed"; status.approvals = [];
    if (accepted === 2) {
      Object.assign(tool, { output: "borrowing limit: PASS\n1 test passed", exitCode: 0, durationMs: 800, directory });
      snapshot.state.run.status = "completed"; status.busy = false;
    }
    await route.fulfill({ json: { ok: true } });
  };
  await page.route(stateUrl, serveState); await page.route(codingUrl, serveCoding); await page.route(`${codingUrl}/approvals/*`, decide);
  try {
    await page.goto(new URL(projectPath, page.url()).href);
    await page.locator('[data-slot="generation-loader"]').waitFor();
    assert.equal(await page.getByRole("button", { name: "更换代码目录" }).isDisabled(), true);
    snapshot.state.conversation.push({ id: "coding-edit", role: "assistant", text: "", createdAt: new Date().toISOString(), status: "completed",
      tools: [{ id: "coding-edit-call", name: "project_edit", request: "limit.ts", status: "running" }] });
    status.approvals = [{ id: "edit-review", runId: "coding-smoke-run", toolCallId: "coding-edit-call", tool: "project_edit", title: "修改项目文件", directory,
      path: "limit.ts", detail: "修改借阅上限", warning: "当前缺少模型、测试用例和说明书，建议先补齐，也可继续编码。", changes: [{ oldText: "export const limit = 4;", newText: "export const limit = 5;" }] }];
    await page.locator('[data-slot="code-diff"]').waitFor();
    await page.locator('[data-slot="generation-loader"]').waitFor({ state: "hidden" });
    assert.ok((await page.locator('[data-slot="code-diff"]').innerText()).includes("export const limit = 5;"));
    if (screenshots) await page.screenshot({ path: join(screenshots, "coding-approval.png"), animations: "disabled" });
    await page.getByRole("button", { name: "仍然继续并允许本次操作" }).click();
    await page.locator('[data-slot="approval-card"]').waitFor({ state: "hidden" });
    snapshot.state.conversation.push({ id: "coding-test", role: "assistant", text: "", createdAt: new Date().toISOString(), status: "completed",
      tools: [{ id: "coding-test-call", name: "project_command", request: "npm test", status: "running" }] });
    status.approvals = [{ id: "command-review", runId: "coding-smoke-run", toolCallId: "coding-test-call", tool: "project_command", title: "运行命令或测试", directory,
      detail: "npm test", warning: "命令以当前 Windows 用户权限运行，可能访问目录外资源。" }];
    await page.getByRole("button", { name: "允许本次操作", exact: true }).click();
    await page.locator('[data-slot="terminal-block"][data-state="done"]').waitFor();
    assert.equal(accepted, 2);
    assert.ok((await page.locator('[data-slot="terminal-block"]').innerText()).includes("退出码 0"));
    if (screenshots) await page.screenshot({ path: join(screenshots, "coding-test-result.png"), animations: "disabled" });
  } finally {
    await page.unroute(stateUrl, serveState); await page.unroute(codingUrl, serveCoding); await page.unroute(`${codingUrl}/approvals/*`, decide);
    await page.goto(new URL(projectPath, page.url()).href);
  }
}
