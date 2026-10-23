// Lets a trusted desktop host add scoped coding tools to the existing Pi turn; hosted APIs have no filesystem capability.
import type { ExtensionFactory } from "@earendil-works/pi-coding-agent";
import type { StandardProjectState } from "../../../../shared/contracts/index.js";

export interface ConversationCodingHost {
  open(projectId: string, runId: string, signal: AbortSignal, current: () => StandardProjectState): Promise<{
    enabled: boolean;
    extension: ExtensionFactory;
    close: () => void;
  }>;
}
