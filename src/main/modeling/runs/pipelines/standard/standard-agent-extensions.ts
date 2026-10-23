// Registers business modeling tools and turn context through Pi's native extension API.
import { type ExtensionFactory } from "@earendil-works/pi-coding-agent";
import type { StandardProjectState } from "../../../../../shared/contracts/index.js";
import { createStandardAgentTools } from "./standard-agent-tools.js";
import { type StandardCommand, type StandardPipelineDependencies } from "./standard-project-pipeline.js";
import { createStandardResourceReadTool } from "./standard-modeling-knowledge.js";
import { standardAgentTurnContext } from "./standard-agent-context.js";

export function createStandardModelingExtension(deps: StandardPipelineDependencies, current: () => StandardProjectState,
  command: StandardCommand, beforeToolCall: () => Promise<void>, skillRoots: string[] = [], codingEnabled = false): ExtensionFactory {
  return pi => {
    // Keep inquiry state local to this Pi session, including when the loader is reloaded.
    const tools = createStandardAgentTools(deps, current, Boolean(command.useRecommendations), command.language);
    pi.registerTool({ ...createStandardResourceReadTool(undefined, skillRoots), name: codingEnabled ? "read_resource" : "read" });
    for (const tool of tools.tools) pi.registerTool(tool);
    pi.on("before_agent_start", event => ({ systemPrompt: `${event.systemPrompt}\n\n${standardAgentTurnContext(command, current(), codingEnabled)}` }));
    pi.on("tool_call", async () => {
      // Persist the assistant's tool intent before allowing any project mutation.
      await beforeToolCall();
      if (tools.waiting()) return { block: true, reason: "等待用户补充需求" };
    });
  };
}
