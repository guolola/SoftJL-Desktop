// Exposes named desktop operations instead of raw IPC or filesystem access.
import { contextBridge, ipcRenderer } from "electron";
contextBridge.exposeInMainWorld(
  "desktop",
  Object.freeze({
    chooseProjectWorkspace: () => ipcRenderer.invoke("desktop:workspace:choose"),
    assignProjectWorkspace: (projectId: string, selectionId: string) => ipcRenderer.invoke("desktop:workspace:assign", projectId, selectionId),
    chooseConversationDirectory: (projectId: string, request?: import("../shared/contracts/workspace/conversation-coding.js").ConversationDirectoryRequest) => ipcRenderer.invoke("desktop:conversation:select-directory", projectId, request),
    showApplicationMenu: (locale: "zh-CN" | "en") =>
      ipcRenderer.invoke("desktop:window:menu", locale),
    setWindowColors: (colors: { color: string; symbolColor: string }) =>
      ipcRenderer.invoke("desktop:window:colors", colors),
  }),
);
