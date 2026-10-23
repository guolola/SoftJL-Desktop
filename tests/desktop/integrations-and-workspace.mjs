// Verifies native folder grants and integration management against an isolated, built Electron application.
import assert from "node:assert/strict";
import { _electron as electron } from "playwright";
import { mkdir, mkdtemp, realpath } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../../", import.meta.url)));
await mkdir(join(root, ".cache", "integration-smoke"), { recursive: true });
const session = await mkdtemp(join(root, ".cache", "integration-smoke", "session-"));
const data = join(session, "data"); const folder = join(session, "code");
await mkdir(folder); const directory = await realpath(folder);
const env = { ...process.env, SOFTJL_DESKTOP_TEST_DATA_DIR: data, SOFTJL_DESKTOP_SMOKE: "1" };
delete env.ELECTRON_RUN_AS_NODE;
const options = { args: [root, "--user-data-dir=" + data], env, timeout: 60000 };
let app = await electron.launch(options);
const errors = [];
try {
  const page = await app.firstWindow({ timeout: 60000 });
  page.on("pageerror", error => errors.push(error.message));
  await page.waitForURL("**/projects", { timeout: 60000 });
  // Replace only the operating-system chooser; IPC trust checks, one-use grants and persistence remain real.
  await app.evaluate(({ dialog }, path) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] }); }, directory);
  const origin = new URL(page.url()).origin;
  await page.goto(origin + "/projects/new");
  await page.getByLabel("项目名称", { exact: true }).fill("Workspace integration check");
  await page.getByRole("button", { name: "选择文件夹", exact: true }).click();
  await page.waitForFunction(expected => document.querySelector("#project-workspace-directory")?.value === expected, directory);
  await page.screenshot({ path: join(session, "create-workspace.png"), fullPage: true });
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(url => /\/projects\/[^/]+$/u.test(url.pathname) && !url.pathname.endsWith("/new"), { timeout: 30000 });
  const projectId = new URL(page.url()).pathname.split("/").at(-1);
  const saved = await page.evaluate(async id => (await fetch(`/api/desktop/projects/${id}/conversation-code`)).json(), projectId);
  assert.equal(saved.directory, directory);
  const replay = await page.evaluate(async id => {
    const selected = await window.desktop.chooseProjectWorkspace();
    return (await Promise.allSettled([window.desktop.assignProjectWorkspace(id, selected.selectionId), window.desktop.assignProjectWorkspace(id, selected.selectionId)])).map(item => item.status);
  }, projectId);
  assert.deepEqual(replay.sort(), ["fulfilled", "rejected"]);
  await page.goto(origin + `/projects/${projectId}/settings`);
  await page.waitForFunction(expected => document.querySelector("#project-workspace-directory")?.value === expected, directory);
  await page.screenshot({ path: join(session, "project-workspace.png"), fullPage: true });

  await page.goto(origin + "/projects");
  await page.getByRole("button", { name: "用户菜单", exact: true }).first().click();
  await page.getByRole("menuitem", { name: "设置", exact: true }).click();
  const settings = page.getByRole("dialog", { name: "设置", exact: true });
  await settings.getByRole("tab", { name: "MCP 服务", exact: true }).click();
  await settings.getByRole("heading", { name: "MarkItDown", exact: true }).waitFor();
  assert.equal(await settings.getByRole("button", { name: "测试连接", exact: true }).count(), 6);
  await page.screenshot({ path: join(session, "mcp-settings.png") });
  await settings.getByRole("button", { name: "配置", exact: true }).nth(3).click();
  await settings.getByLabel("显示名称", { exact: true }).fill("Documentation connector");
  const savedMcp = page.waitForResponse(response => response.url().endsWith("/integrations/mcp/context7") && response.request().method() === "PUT");
  await settings.getByRole("button", { name: "保存配置", exact: true }).click();
  assert.equal((await savedMcp).status(), 200);
  await settings.getByRole("heading", { name: "Documentation connector", exact: true }).waitFor();
  await settings.getByRole("tab", { name: "Skills 技能", exact: true }).click();
  await settings.getByRole("heading", { name: "需求澄清与验收条件", exact: true }).waitFor();
  await page.screenshot({ path: join(session, "skill-settings.png") });
  await settings.getByRole("switch", { name: "启用 需求澄清与验收条件", exact: true }).click();
  await page.waitForFunction(async () => (await (await fetch("/api/desktop/integrations")).json()).skills.find(item => item.id === "requirements-discovery")?.enabled === false);
  await app.close(); app = await electron.launch(options);
  const restarted = await app.firstWindow({ timeout: 60000 });
  await restarted.waitForURL("**/projects", { timeout: 60000 });
  const persisted = await restarted.evaluate(async id => ({ workspace: await (await fetch(`/api/desktop/projects/${id}/conversation-code`)).json(), integrations: await (await fetch("/api/desktop/integrations")).json() }), projectId);
  assert.equal(persisted.workspace.directory, directory);
  assert.equal(persisted.integrations.servers.find(item => item.id === "context7").name, "Documentation connector");
  assert.equal(persisted.integrations.skills.find(item => item.id === "requirements-discovery").enabled, false);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ status: "passed", projectId, screenshots: session }));
} finally { await app.close(); }
