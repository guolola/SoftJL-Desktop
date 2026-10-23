// Defines the privileged desktop operations exposed to the renderer.
export interface DesktopBridge {
  chooseProjectWorkspace(): Promise<{ selectionId: string; directory: string } | null>;
  assignProjectWorkspace(projectId: string, selectionId: string): Promise<string>;
  chooseConversationDirectory(projectId: string): Promise<string | null>;
  showApplicationMenu(locale: "zh-CN" | "en"): Promise<void>;
  setWindowColors(colors: { color: string; symbolColor: string }): Promise<void>;
}
declare global {
  interface Window {
    desktop: DesktopBridge;
  }
}
