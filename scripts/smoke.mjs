// Launches the actual Electron app with isolated data and checks the no-login modeling flow.
import { _electron as electron } from "playwright";
import { mkdtemp, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { verifyQuickModelingScroll } from "../tests/desktop/quick-modeling-scroll.mjs";
import { verifyConversationCoding } from "../tests/desktop/conversation-coding.mjs";
const root = resolve(fileURLToPath(new URL("../", import.meta.url)));
const dataRoot = join(root, ".cache", "desktop-smoke");
await mkdir(dataRoot, { recursive: true });
const data = await mkdtemp(join(dataRoot, "session-"));
const environment = {
  ...process.env,
  SOFTJL_DESKTOP_TEST_DATA_DIR: data,
  SOFTJL_DESKTOP_SMOKE: "1",
};
delete environment.ELECTRON_RUN_AS_NODE;
const executable = process.env.SOFTJL_DESKTOP_EXECUTABLE;
const launchOptions = {
  executablePath: executable,
  args: executable ? ["--user-data-dir="+data] : [root,"--user-data-dir="+data],
  env: environment,
  timeout: 60000,
};
let app = await electron.launch(launchOptions);
const failures = [];
try {
  const page = await app.firstWindow({ timeout: 60000 });
  page.on("pageerror", (error) => failures.push(error.message));
  await page.waitForURL("**/projects", { timeout: 60000 });
  await page
    .getByRole("button", { name: /创建项目|新建项目/ })
    .first()
    .waitFor({ timeout: 30000 });
  const created = await page.evaluate(async () => {
    const response = await fetch("/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Desktop smoke project",
        description: null,
        projectMode: "standard",
      }),
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  });
  await verifyQuickModelingScroll(page, created.project.id);
  await verifyConversationCoding(page, created.project.id, executable ? undefined : data);
  const projectNavigation = await page.getByRole("navigation", { name: "项目导航" }).elementHandle();
  assert.equal(
    await page.getByRole("button", { name: "登录", exact: true }).count(),
    0,
  );
  if (!executable)
    await page.screenshot({
      path: join(data, "modeling-workspace.png"),
      fullPage: true,
    });
  assert.equal(await projectNavigation.evaluate(element => element.isConnected), true);
  assert.equal(await page.getByRole("button", { name: "生成代码", exact: true }).count(), 0);
  assert.equal(await page.getByRole("button", { name: "切换界面语言" }).count(), 1);
  assert.equal(await page.getByRole("button", { name: "主题色板" }).count(), 1);
  const sidebarMenu = page.getByRole("button", { name: /^用户菜单：/ });
  await sidebarMenu.click();
  await page.getByRole("menu").waitFor();
  assert.ok((await sidebarMenu.locator('[data-slot="user-menu-chevron"]').getAttribute("class")).includes("rotate-180"));
  await page.keyboard.press("Escape");
  await page.getByRole("menu").waitFor({ state: "hidden" });
  assert.equal((await sidebarMenu.locator('[data-slot="user-menu-chevron"]').getAttribute("class")).includes("rotate-180"), false);
  assert.equal(await page.getByRole("button", { name: /公告/ }).count(), 0);
  const rendering = await page.evaluate(async (projectId) => {
    const response = await fetch("/api/render/svg", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-uml-project-id": projectId,
      },
      body: JSON.stringify({
        diagramKind: "class",
        plantUmlSource:
          "@startuml\nclass SmokeA\nclass SmokeB\nSmokeA --> SmokeB\n@enduml",
      }),
    });
    return { ok: response.ok, data: await response.json() };
  }, created.project.id);
  assert.equal(rendering.ok, true, JSON.stringify(rendering.data));
  assert.ok(rendering.data.svg.includes("<svg"));
  await page
    .getByRole("button", { name: "用户菜单", exact: true })
    .first()
    .click();
  await page.getByRole("menuitem", { name: "设置", exact: true }).click();
  await page.getByRole("dialog", { name: "设置", exact: true }).waitFor();
  await page.getByRole("tab", { name: "个人资料", exact: true }).click();
  await page.getByLabel("昵称", { exact: true }).fill("Desktop profile");
  await page.getByRole("button", { name: "小八弹吉他", exact: true }).click();
  const savedProfile = page.waitForResponse(response => response.url().endsWith("/api/account/profile") && response.request().method() === "PATCH");
  await page.getByRole("button", { name: "保存更改", exact: true }).click();
  assert.equal((await savedProfile).status(), 200);
  await page.getByRole("button", { name: "保存更改", exact: true }).waitFor();
  await page.waitForFunction(() => document.querySelector('[role="dialog"] footer button:last-child')?.disabled === true);
  if (!executable) await page.screenshot({ path: join(data, "profile-settings.png") });
  await page.keyboard.press("Escape");
  const firstOrigin = new URL(page.url()).origin;
  await page.evaluate(() =>
    localStorage.setItem("desktop-smoke-persistence", "retained"),
  );
  await app.close();
  app = await electron.launch(launchOptions);
  const restarted = await app.firstWindow({ timeout: 60000 });
  await restarted.waitForURL("**/projects", { timeout: 60000 });
  await restarted
    .getByRole("button", { name: /创建项目|新建项目/ })
    .first()
    .waitFor({ timeout: 30000 });
  assert.equal(new URL(restarted.url()).origin, firstOrigin);
  assert.equal(
    await restarted.evaluate(() =>
      localStorage.getItem("desktop-smoke-persistence"),
    ),
    "retained",
  );
  const restored = await restarted.evaluate(async () => {
    const response = await fetch("/api/projects");
    return response.json();
  });
  assert.ok(
    restored.projects.some((project) => project.id === created.project.id),
  );
  const profile = await restarted.evaluate(async () => (await fetch("/api/account/profile")).json());
  assert.equal(profile.user.displayName, "Desktop profile");
  assert.equal(profile.user.avatarUrl, "/avatars/hachiware-guitar.gif");
  assert.deepEqual(failures, []);
  console.log(
    JSON.stringify({
      ok: true,
      url: restarted.url(),
      packaged: Boolean(executable),
      restartPersistence: true,
      bundledRendering: true,
      screenshot: executable ? undefined : join(data, "modeling-workspace.png"),
    }),
  );
} finally {
  await app.close();
}
