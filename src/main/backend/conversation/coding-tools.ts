// Registers unwrapped Pi tools; the installed permission extension owns authorization.
import { createWriteToolDefinition, createEditToolDefinition, createPowerShellToolDefinition,
  createLsToolDefinition, createFindToolDefinition, type ToolDefinition, type ExtensionFactory } from "@earendil-works/pi-coding-agent";

export function codingExtension(directory: string | null): ExtensionFactory {
  return pi => {
    pi.on("before_agent_start", event => ({ systemPrompt: `${event.systemPrompt}\n${directory
      ? `本轮代码工作目录：${JSON.stringify(directory)}。使用原生文件与 PowerShell 工具；权限由已加载的权限扩展处理。先阅读项目与已有代码。需要并行工作时可使用 subagent，网页研究使用 web_search/fetch_content，代码定位使用 fff。`
      : "尚未选择代码目录。需要本机编码、代码搜索或子代理时，先提示用户选择代码目录。可使用网页搜索和询问工具。"}` }));
    if (!directory) return;
    for (const create of [createWriteToolDefinition, createEditToolDefinition,
      createPowerShellToolDefinition, createLsToolDefinition, createFindToolDefinition]) pi.registerTool(create(directory) as ToolDefinition);
  };
}
