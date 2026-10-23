// Owns the window, protected loopback transport and backend lifecycle.
import {
  app,
  BrowserWindow,
  dialog,
  nativeTheme,
  safeStorage,
  session,
  shell,
  utilityProcess,
  type UtilityProcess,
} from "electron";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { installWindowChrome } from "./window-chrome.js";
import { TITLEBAR_HEIGHT } from "./window-chrome-contract.js";
import { installProjectWorkspaceSelection } from "./project-workspace-selection.js";
const here = dirname(fileURLToPath(import.meta.url));
let worker: UtilityProcess | undefined;
let window: BrowserWindow | undefined;
let origin = "",
  capability = "";
// Isolated desktop checks need their own instance lock as well as their own storage.
if (process.env.SOFTJL_DESKTOP_TEST_DATA_DIR)
  app.setPath("userData", process.env.SOFTJL_DESKTOP_TEST_DATA_DIR);
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", () => {
    window?.show();
    window?.focus();
  });
  app
    .whenReady()
    .then(async () => {
      app.setName("SoftJL Desktop");
      const dataDir = app.getPath("userData");
      await mkdir(dataDir, { recursive: true });
      if (!(await safeStorage.isAsyncEncryptionAvailable()))
        throw new Error("Windows 凭据加密不可用，无法打开本地模型配置。");
      const keyPath = join(dataDir, "provider-key.bin");
      let secret: string;
      try {
        secret = (await safeStorage.decryptStringAsync(await readFile(keyPath)))
          .result;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        secret = randomBytes(32).toString("hex");
        await writeFile(keyPath, await safeStorage.encryptStringAsync(secret), {
          flag: "wx",
        });
      }
      capability = randomBytes(32).toString("hex");
      const directorySelectionCapability = randomBytes(32).toString("hex");
      worker = utilityProcess.fork(join(here, "./backend/worker.js"), [], {
        serviceName: "SoftJL Local Backend",
      });
      const ready = new Promise<string>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error("本地服务启动超时")),
          60000,
        );
        worker!.on("message", (message) => {
          if (message.kind === "ready") {
            clearTimeout(timer);
            resolve(message.origin);
          }
          if (message.kind === "error") {
            console.error("Local backend failed:", message.error);
            clearTimeout(timer);
            reject(new Error(message.error));
          }
        });
        worker!.on("exit", (code) => {
          clearTimeout(timer);
          reject(new Error("本地服务已退出：" + code));
        });
      });
      worker.postMessage({
        kind: "start",
        dataDir,
        secret,
        capability,
        directorySelectionCapability,
        rendererDir: join(here, "../renderer"),
        jarPath: app.isPackaged
          ? join(process.resourcesPath, "plantuml.jar")
          : join(app.getAppPath(), "resources/plantuml/plantuml-1.2026.3beta8.jar"),
        javaPath: app.isPackaged
          ? join(process.resourcesPath, "java/bin/java.exe")
          : join(app.getAppPath(), ".runtime/java/bin/java.exe"),
      });
      origin = await ready;
      session.defaultSession.webRequest.onBeforeSendHeaders(
        { urls: [origin + "/*"] },
        (details, callback) => {
          callback({
            requestHeaders: {
              ...details.requestHeaders,
              "x-softjl-desktop": capability,
            },
          });
        },
      );
      window = new BrowserWindow({
        width: 1440,
        height: 960,
        minWidth: 1000,
        minHeight: 680,
        show: false,
        title: "SoftJL Desktop",
        // Packaged windows and local development use the same badge as the installer and shortcuts.
        icon: app.isPackaged
          ? join(process.resourcesPath, "icon.ico")
          : join(app.getAppPath(), "resources/icon.ico"),
        titleBarStyle: "hidden",
        titleBarOverlay: {
          color: nativeTheme.shouldUseDarkColors ? "#343434" : "#fafafa",
          symbolColor: nativeTheme.shouldUseDarkColors ? "#fafafa" : "#262626",
          height: TITLEBAR_HEIGHT,
        },
        autoHideMenuBar: true,
        webPreferences: {
          preload: join(here, "../preload/index.cjs"),
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
        },
      });
      function trusted(event: Electron.IpcMainInvokeEvent) {
        if (
          event.sender !== window?.webContents ||
          !event.senderFrame?.url.startsWith(origin + "/")
        )
          throw new Error("无效桌面请求");
      }
      installWindowChrome(window, trusted);
      installProjectWorkspaceSelection({ window, trusted, origin, capability, directorySelectionCapability, dataDir });
      window.webContents.setWindowOpenHandler(({ url }) => {
        if (/^https?:/.test(url)) void shell.openExternal(url);
        return { action: "deny" };
      });
      window.webContents.on("will-navigate", (event, url) => {
        if (new URL(url).origin !== origin) {
          event.preventDefault();
          if (/^https?:/.test(url)) void shell.openExternal(url);
        }
      });
      session.defaultSession.setPermissionRequestHandler(
        (_contents, _permission, callback) => callback(false),
      );
      await window.loadURL(origin + "/projects");
      if (process.env.SOFTJL_DESKTOP_SMOKE !== "1") window.show();
    })
    .catch((error) => {
      console.error(error);
      if (process.env.SOFTJL_DESKTOP_SMOKE !== "1")
        dialog.showErrorBox(
          "SoftJL Desktop 启动失败",
          String(error.message ?? error),
        );
      app.quit();
    });
  app.on("window-all-closed", () => app.quit());
  app.on("before-quit", () => {
    worker?.postMessage({ kind: "close" });
    setTimeout(() => worker?.kill(), 4000).unref();
  });
}
