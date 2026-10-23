// Lets the desktop host load Pi packages and bridge native dialogs into an existing modeling turn.
import type { ExtensionFactory, ExtensionUIContext } from "@earendil-works/pi-coding-agent";

export interface ConversationCodingHost {
  open(projectId: string, runId: string, signal: AbortSignal): Promise<{
    enabled: boolean;
    cwd?: string;
    additionalExtensionPaths?: string[];
    prepare?: (model: { provider: string; id: string }) => Promise<void>;
    createUI?: (base: ExtensionUIContext) => ExtensionUIContext;
    activeTool?: (tool: { id: string; name: string; arguments: Record<string, unknown> } | null) => void;
    extension: ExtensionFactory;
    close: () => void;
  }>;
}
