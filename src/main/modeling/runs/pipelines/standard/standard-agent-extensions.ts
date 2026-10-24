// Registers business modeling tools and turn context through Pi's native extension API.
import { type ExtensionFactory } from "@earendil-works/pi-coding-agent";
import type { StandardProjectState } from "../../../../../shared/contracts/index.js";
import { createStandardAgentTools } from "./standard-agent-tools.js";
import { type StandardCommand, type StandardPipelineDependencies } from "./standard-project-pipeline.js";
import { createStandardResourceReadTool } from "./standard-modeling-knowledge.js";
import { standardAgentTurnContext } from "./standard-agent-context.js";
import { hasStandardModelQuestion, standardQuestionScope } from "./standard-user-questions.js";

export function createStandardModelingExtension(deps: StandardPipelineDependencies, current: () => StandardProjectState,
  command: StandardCommand, beforeToolCall: () => Promise<void>, skillRoots: string[] = [], codingEnabled = false): ExtensionFactory {
  return pi => {
    let questionCancelled = false;
    let questionFailed = false;
    const tools = createStandardAgentTools(deps, current, command.language);
    pi.registerTool({ ...createStandardResourceReadTool(undefined, skillRoots), name: codingEnabled ? "read_resource" : "read" });
    for (const tool of tools.tools) pi.registerTool(tool);
    pi.on("before_agent_start", event => ({ systemPrompt: `${event.systemPrompt}\n\n${standardAgentTurnContext(command, current())}` }));
    pi.on("tool_call", async event => {
      // Persist the assistant's tool intent before allowing any project mutation.
      await beforeToolCall();
      if (questionCancelled) return { block: true, reason: "用户已取消询问，请停止本轮操作并等待新的请求" };
      if (questionFailed && event.toolName !== "ask_user_question") return { block: true, reason: "询问尚未成功，请修正问题后重试，不能假定用户已回答" };
    });
    pi.on("tool_result", async event => {
      if (event.toolName !== "ask_user_question") return;
      // Only the installed plugin's completed result can authorize a scope; no second inquiry is created.
      const details = event.details && typeof event.details === "object" ? event.details : {};
      questionFailed = event.isError || ("error" in details && !!details.error);
      questionCancelled = !questionFailed && "cancelled" in details && details.cancelled === true;
      if (questionCancelled || questionFailed) return;
      const kinds = standardQuestionScope(event.input, event.details);
      if (kinds === undefined) {
        // An unanswered model choice cannot silently reuse a previous turn's permission.
        if (hasStandardModelQuestion(event.input)) await deps.save(state => { state.generationScope = { status: "awaiting_selection", kinds: [] }; });
        return;
      }
      await deps.save(state => {
        state.generationScope = { status: "confirmed", kinds };
        delete state.unsupportedDiagramRequest;
      });
    });
  };
}
