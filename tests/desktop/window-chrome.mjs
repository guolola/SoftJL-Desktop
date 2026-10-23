// Exercises the real Electron titlebar, compact preferences, responsive layout and scroll geometry.
import { _electron as electron } from "playwright";
import assert from "node:assert/strict";
import { mkdtemp, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const artifacts = join(root, ".cache", "desktop-shell");
await mkdir(artifacts, { recursive: true });
const data = await mkdtemp(join(artifacts, "session-"));
const env = { ...process.env, SOFTJL_DESKTOP_TEST_DATA_DIR: data, SOFTJL_DESKTOP_SMOKE: "1" };
delete env.ELECTRON_RUN_AS_NODE;
const app = await electron.launch({ args: [root, "--user-data-dir=" + data], env, timeout: 60000 });
const errors = [];
try {
  const page = await app.firstWindow({ timeout: 60000 });
  page.on("pageerror", error => errors.push(error.message));
  await page.waitForURL("**/projects", { timeout: 60000 });
  await page.getByRole("button", { name: /创建项目|新建项目/ }).first().waitFor();
  await page.locator('[data-slot="desktop-toolbar"]').waitFor();
  assert.equal(await page.locator("header").count(), 1);
  assert.equal(await page.locator('[data-slot="sidebar-header"]').count(), 0);
  assert.equal(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isMenuBarVisible()), false);

  const geometry = () => page.evaluate(() => {
    const header = document.querySelector(".desktop-titlebar").getBoundingClientRect();
    const sidebar = document.querySelector('[data-slot="sidebar-container"]').getBoundingClientRect();
    const actions = document.querySelector(".desktop-toolbar-actions").getBoundingClientRect();
    const host = document.querySelector(".desktop-toolbar-host").getBoundingClientRect();
    return { headerBottom: header.bottom, sidebarTop: sidebar.top, sidebarBottom: sidebar.bottom,
      actionsRight: actions.right, hostRight: host.right, height: innerHeight,
      overflow: document.documentElement.scrollWidth > innerWidth };
  });
  const assertGeometry = async () => {
    const actual = await geometry();
    assert.ok(Math.abs(actual.headerBottom - actual.sidebarTop) <= 1, JSON.stringify(actual));
    assert.ok(Math.abs(actual.sidebarBottom - actual.height) <= 1, JSON.stringify(actual));
    assert.ok(actual.actionsRight <= actual.hostRight + 1, JSON.stringify(actual));
    assert.equal(actual.overflow, false);
  };
  await assertGeometry();
  await page.locator('[data-slot="sidebar-trigger"]').click();
  await page.locator('[data-slot="sidebar"][data-state="collapsed"]').waitFor();
  await page.locator('[data-slot="sidebar-trigger"]').click();
  await page.locator('[data-slot="sidebar"][data-state="expanded"]').waitFor();

  // Open the real menu and close it through Electron so it cannot block subsequent pointer tests.
  await page.getByRole("button", { name: "应用菜单", exact: true }).click();
  assert.equal(await app.evaluate(({ Menu }) => Menu.getApplicationMenu().items[0].label), "文件");
  await app.evaluate(({ Menu, BrowserWindow }) => Menu.getApplicationMenu().closePopup(BrowserWindow.getAllWindows()[0]));
  await page.keyboard.press("Alt");
  assert.equal(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isMenuBarVisible()), false,
    "Alt must not restore a second menu row");
  await app.evaluate(({ Menu }) => {
    globalThis.desktopMenuOpened = false;
    Menu.getApplicationMenu().once("menu-will-show", () => { globalThis.desktopMenuOpened = true; });
  });
  await page.keyboard.press("Alt+M");
  assert.equal(await app.evaluate(async () => {
    for (let attempt = 0; attempt < 20; attempt++) {
      if (globalThis.desktopMenuOpened) return true;
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    return false;
  }), true, "Application menu remains keyboard accessible");
  await app.evaluate(({ Menu, BrowserWindow }) => Menu.getApplicationMenu().closePopup(BrowserWindow.getAllWindows()[0]));

  const openSettings = async () => {
    await page.locator(".desktop-titlebar").getByRole("button", { name: "用户菜单", exact: true }).click();
    assert.equal(await page.getByRole("menuitem", { name: /账号|次数与账单|退出登录/ }).count(), 0);
    await page.getByRole("menuitem", { name: "设置", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "设置", exact: true });
    await dialog.waitFor();
    return dialog;
  };
  let settings = await openSettings();
  assert.deepEqual(await settings.getByRole("tablist", { name: "设置", exact: true }).getByRole("tab").allTextContents(),
    ["主题", "布局", "语言", "工作台偏好", "模型配置"]);
  await settings.getByRole("tab", { name: "语言", exact: true }).click();
  await settings.getByRole("combobox", { name: "语言", exact: true }).click();
  await page.getByRole("option", { name: "English", exact: true }).click();
  assert.equal(await page.evaluate(() => document.documentElement.lang), "zh-CN", "Language changes remain drafts until saved");
  await settings.getByRole("button", { name: "保存更改" }).click();
  settings = page.getByRole("dialog", { name: "Settings", exact: true });
  await settings.getByRole("combobox", { name: "Language", exact: true }).click();
  await page.getByRole("option", { name: "中文", exact: true }).click();
  await settings.getByRole("button", { name: "Save changes" }).click();
  settings = page.getByRole("dialog", { name: "设置", exact: true });
  await settings.getByRole("button", { name: "取消", exact: true }).click();

  for (const mode of ["light", "dark"]) {
    settings = await openSettings();
    await settings.getByRole("tab", { name: mode === "dark" ? "深色" : "浅色", exact: true }).click();
    const save = settings.getByRole("button", { name: "保存更改" });
    if (await save.isEnabled()) await save.click();
    if (mode === "dark") {
      await page.screenshot({ path: join(artifacts, "settings-dark.png") });
    }
    await settings.getByRole("button", { name: "取消", exact: true }).click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    await page.waitForFunction(expected => document.documentElement.classList.contains("dark") === (expected === "dark"), mode);
    // Wait for finite color transitions before visual checks; product illustrations may animate indefinitely.
    await page.locator(".desktop-titlebar").evaluate(element => Promise.all(element.getAnimations({ subtree: true })
      .filter(animation => animation.effect?.getComputedTiming().iterations !== Infinity)
      .map(animation => animation.finished.catch(() => {}))));
    await page.screenshot({ path: join(artifacts, `projects-${mode}.png`) });
  }

  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1000, 680));
  await page.waitForFunction(() => innerWidth <= 1000);
  await assertGeometry();
  await page.screenshot({ path: join(artifacts, "projects-narrow.png") });
  const created = await page.evaluate(async () => {
    const response = await fetch("/api/projects", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "桌面外壳验证项目", projectMode: "standard", description: null }) });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  });
  await page.goto(new URL(`/projects/${created.project.id}`, page.url()).href);
  await page.getByTestId("standard-project-content").waitFor();
  assert.equal(await page.getByRole("button", { name: "生成代码", exact: true }).count(), 0);
  await assertGeometry();

  // A real overflowing element checks wheel scrolling, track color and stable width together.
  const scrolling = await page.evaluate(() => {
    const container = document.createElement("div");
    container.dataset.testid = "scroll-probe";
    container.style.cssText = "position:fixed;right:24px;top:120px;width:160px;height:160px;overflow:auto;background:var(--background)";
    const content = document.createElement("div");
    content.style.height = "1600px";
    container.append(content);
    document.querySelector(".desktop-workspace").append(container);
    const style = getComputedStyle(container);
    return { width: getComputedStyle(container, "::-webkit-scrollbar").width,
      arrows: getComputedStyle(container, "::-webkit-scrollbar-button").display,
      colors: getComputedStyle(container, "::-webkit-scrollbar-track").backgroundColor,
      clientWidth: container.clientWidth };
  });
  assert.equal(scrolling.width, "8px");
  assert.equal(scrolling.arrows, "none");
  assert.match(scrolling.colors, /rgba\(0, 0, 0, 0\)$/);
  await page.getByTestId("scroll-probe").hover();
  await page.mouse.wheel(0, 400);
  await page.waitForFunction(() => document.querySelector('[data-testid="scroll-probe"]').scrollTop > 0);
  assert.equal(await page.getByTestId("scroll-probe").evaluate(element => element.clientWidth), scrolling.clientWidth);
  await page.screenshot({ path: join(artifacts, "workspace-dark.png") });
  await page.getByTestId("scroll-probe").evaluate(element => element.remove());

  await page.locator('[data-slot="sidebar-footer"]').getByRole("button", { name: /用户菜单/ }).click();
  await page.screenshot({ path: join(artifacts, "user-menu-dark.png") });
  await page.getByRole("menuitem", { name: "设置", exact: true }).click();
  settings = page.getByRole("dialog", { name: "设置", exact: true });
  await settings.getByRole("tab", { name: "模型配置", exact: true }).click();
  await settings.getByRole("button", { name: "取消", exact: true }).click();
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ ok: true, titlebar: "single row", themes: ["light", "dark"], narrowWidth: 1000,
    sidebarToggle: true, languageMenu: true, workspacePrerequisites: true, scrollbars: scrolling, screenshots: artifacts }));
} finally { await app.close(); }
