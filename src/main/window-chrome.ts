// Installs the compact native menu without a second menu row and keeps caption colors in sync.
import { ipcMain, Menu, type BrowserWindow, type IpcMainInvokeEvent } from "electron";
import { createApplicationMenuTemplate, parseWindowColors, TITLEBAR_HEIGHT } from "./window-chrome-contract.js";

export function installWindowChrome(window: BrowserWindow, trusted: (event: IpcMainInvokeEvent) => void) {
  let locale: "zh-CN" | "en" = "zh-CN";
  let applicationMenu: Menu;
  const installMenu = () => {
    applicationMenu = Menu.buildFromTemplate(createApplicationMenuTemplate(locale));
    Menu.setApplicationMenu(applicationMenu);
    window.setMenuBarVisibility(false);
  };
  installMenu();
  ipcMain.handle("desktop:window:menu", (event, requestedLocale: unknown) => {
    trusted(event);
    if (requestedLocale !== "zh-CN" && requestedLocale !== "en") throw new Error("无效菜单语言");
    if (locale !== requestedLocale) { locale = requestedLocale; installMenu(); }
    applicationMenu.popup({ window, x: 12, y: TITLEBAR_HEIGHT });
  });
  ipcMain.handle("desktop:window:colors", (event, input: unknown) => {
    trusted(event);
    window.setTitleBarOverlay({ ...parseWindowColors(input), height: TITLEBAR_HEIGHT });
  });
}
