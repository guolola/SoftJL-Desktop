// Exposes named desktop operations instead of raw IPC or filesystem access.
import { contextBridge, ipcRenderer } from "electron";
contextBridge.exposeInMainWorld(
  "desktop",
  Object.freeze({
    chooseProjectWorkspace: () => ipcRenderer.invoke("desktop:workspace:choose"),
    assignProjectWorkspace: (projectId: string, selectionId: string) => ipcRenderer.invoke("desktop:workspace:assign", projectId, selectionId),
    chooseConversationDirectory: (projectId: string) => ipcRenderer.invoke("desktop:conversation:select-directory", projectId),
    showApplicationMenu: (locale: "zh-CN" | "en") =>
      ipcRenderer.invoke("desktop:window:menu", locale),
    setWindowColors: (colors: { color: string; symbolColor: string }) =>
      ipcRenderer.invoke("desktop:window:colors", colors),
  }),
);
