// Defines localized native menu commands and validates the narrow window-theme IPC payload.
import type { MenuItemConstructorOptions } from "electron";

export const TITLEBAR_HEIGHT = 48;

export function parseWindowColors(input: unknown): { color: string; symbolColor: string } {
  if (!input || typeof input !== "object") throw new Error("无效窗口配色");
  const { color, symbolColor } = input as Record<string, unknown>;
  if (typeof color !== "string" || typeof symbolColor !== "string" ||
      !/^#[0-9a-f]{6}$/i.test(color) || !/^#[0-9a-f]{6}$/i.test(symbolColor)) {
    throw new Error("无效窗口配色");
  }
  return { color, symbolColor };
}

export function createApplicationMenuTemplate(locale: "zh-CN" | "en"): MenuItemConstructorOptions[] {
  const en = locale === "en";
  const command = (role: MenuItemConstructorOptions["role"], zh: string, english: string): MenuItemConstructorOptions =>
    ({ role, label: en ? english : zh });
  return [
    { label: en ? "File" : "文件", submenu: [command("close", "关闭窗口", "Close window")] },
    { label: en ? "Edit" : "编辑", submenu: [
      command("undo", "撤销", "Undo"), command("redo", "重做", "Redo"), { type: "separator" },
      command("cut", "剪切", "Cut"), command("copy", "复制", "Copy"),
      command("paste", "粘贴", "Paste"), command("selectAll", "全选", "Select all"),
    ] },
    { label: en ? "View" : "视图", submenu: [
      command("reload", "重新加载", "Reload"), command("forceReload", "强制重新加载", "Force reload"),
      command("toggleDevTools", "开发者工具", "Developer tools"), { type: "separator" },
      command("resetZoom", "实际大小", "Actual size"), command("zoomIn", "放大", "Zoom in"),
      command("zoomOut", "缩小", "Zoom out"), { type: "separator" },
      command("togglefullscreen", "切换全屏", "Toggle full screen"),
    ] },
    { label: en ? "Window" : "窗口", submenu: [
      command("minimize", "最小化", "Minimize"), command("zoom", "最大化 / 还原", "Maximize / restore"),
    ] },
  ];
}
