// Guards the desktop menu's retained editing commands and restricted native-theme contract.
import assert from "node:assert/strict";
import { test } from "node:test";
import type { MenuItemConstructorOptions } from "electron";
import { createApplicationMenuTemplate, parseWindowColors } from "./window-chrome-contract.js";

test("collapsed native menu preserves editing, zoom and window commands in both languages", () => {
  for (const locale of ["zh-CN", "en"] as const) {
    const menu = createApplicationMenuTemplate(locale);
    const roles = menu.flatMap(item => item.submenu as MenuItemConstructorOptions[]).map(item => item.role);
    for (const role of ["undo", "redo", "cut", "copy", "paste", "selectAll", "resetZoom", "zoomIn", "zoomOut", "togglefullscreen", "minimize", "close"]) {
      assert.ok(roles.includes(role as MenuItemConstructorOptions["role"]), role);
    }
    assert.equal(menu[0].label, locale === "en" ? "File" : "文件");
  }
});

test("native caption colors accept only validated six-digit RGB strings", () => {
  assert.deepEqual(parseWindowColors({ color: "#181818", symbolColor: "#FAFAFA", ignored: true }),
    { color: "#181818", symbolColor: "#FAFAFA" });
  for (const value of [null, {}, { color: "red", symbolColor: "#ffffff" },
    { color: "#000000", symbolColor: "var(--foreground)" }, { color: 123, symbolColor: "#fff" }]) {
    assert.throws(() => parseWindowColors(value), /无效窗口配色/);
  }
});
