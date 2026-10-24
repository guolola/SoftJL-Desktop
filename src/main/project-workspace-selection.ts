// Connects native folder selection to per-project directory grants without accepting renderer-supplied paths.
import { dialog, ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from "electron";
import { randomUUID } from "node:crypto";
import { realpath } from "node:fs/promises";
import { dirname, isAbsolute, relative } from "node:path";
import { conversationDirectoryRequestSchema, type ConversationDirectoryRequest } from "../shared/contracts/workspace/conversation-coding.js";

export function installProjectWorkspaceSelection(options: { window: BrowserWindow; trusted: (event: IpcMainInvokeEvent) => void; origin: string; capability: string; directorySelectionCapability: string; dataDir: string }) {
  const grants = new Map<string, { directory: string; expiresAt: number }>();
  const validateId = (id: unknown): string => {
    if (typeof id !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/u.test(id)) throw new Error("项目标识无效");
    return id;
  };
  const pick = async () => {
    const choice = await dialog.showOpenDialog(options.window, { title: "选择项目工作区", properties: ["openDirectory", "createDirectory"] });
    if (choice.canceled || !choice.filePaths[0]) return null;
    const directory = await realpath(choice.filePaths[0]);
    const data = await realpath(options.dataDir);
    const inside = (root: string, target: string) => { const part = relative(root, target); return part === "" || (!part.startsWith("..\\") && !part.startsWith("../") && part !== ".." && !isAbsolute(part)); };
    if (dirname(directory) === directory || inside(directory, data) || inside(data, directory)) throw new Error("请选择具体项目文件夹，不能选择磁盘根目录或应用数据目录");
    return directory;
  };
  const assign = async (projectId: string, directory: string, request?: ConversationDirectoryRequest) => {
    const response = await fetch(`${options.origin}/api/desktop/projects/${encodeURIComponent(projectId)}/conversation-code`, {
      method: "POST", headers: { "Content-Type": "application/json", "x-softjl-desktop": options.capability, "x-softjl-directory-selection": options.directorySelectionCapability }, body: JSON.stringify({ directory, request }),
    });
    const result = await response.json() as { directory?: string; message?: string };
    if (!response.ok || !result.directory) throw new Error(result.message ?? "保存项目工作区失败");
    return result.directory;
  };
  ipcMain.handle("desktop:workspace:choose", async event => {
    options.trusted(event);
    const directory = await pick(); if (!directory) return null;
    for (const [id, grant] of grants) if (grant.expiresAt < Date.now()) grants.delete(id);
    if (grants.size >= 32) grants.delete(grants.keys().next().value!);
    const selectionId = randomUUID();
    grants.set(selectionId, { directory, expiresAt: Date.now() + 24 * 60 * 60 * 1000 });
    return { selectionId, directory };
  });
  ipcMain.handle("desktop:workspace:assign", async (event, projectId: unknown, selectionId: unknown) => {
    options.trusted(event);
    const id = validateId(projectId);
    const grant = typeof selectionId === "string" ? grants.get(selectionId) : undefined;
    if (!grant || grant.expiresAt < Date.now()) throw new Error("文件夹选择已失效，请重新选择项目工作区");
    // Reserve the one-use grant before awaiting I/O; a failed save remains retryable.
    grants.delete(selectionId as string);
    try { return await assign(id, grant.directory); }
    catch (error) { if (grant.expiresAt >= Date.now()) grants.set(selectionId as string, grant); throw error; }
  });
  ipcMain.handle("desktop:conversation:select-directory", async (event, projectId: unknown, input: unknown) => {
    options.trusted(event); const id = validateId(projectId);
    const request = input === undefined ? undefined : conversationDirectoryRequestSchema.parse(input);
    const directory = await pick();
    return directory ? assign(id, directory, request) : null;
  });
}
