// Registers native Pi tools only after the user selects a code workspace.
import { createWriteToolDefinition, createEditToolDefinition, createPowerShellToolDefinition,
  createLsToolDefinition, createFindToolDefinition, defineTool, type ToolDefinition, type ExtensionFactory } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

export function codingExtension(directory: string | null, requestDirectory?: () => Promise<string>): ExtensionFactory {
  return pi => {
    pi.on("before_agent_start", event => ({ systemPrompt: `${event.systemPrompt}\n${directory
      ? `本轮代码工作目录：${JSON.stringify(directory)}。使用原生文件与 PowerShell 工具，按用户请求的范围执行操作。先阅读项目与已有代码。需要并行工作时可使用 subagent，网页研究使用 web_search/fetch_content，代码定位使用 fff。`
      : "尚未选择代码目录。需要生成或修改本机代码、代码搜索或子代理时，先调用 select_code_directory 提示用户选择文件夹。选择完成后系统会自动加载编码工具并继续当前请求，无需用户重新发送消息。普通问答、建模和网页搜索不需要选择目录。"}` }));
    if (!directory) {
      if (requestDirectory) pi.registerTool(defineTool({ name: "select_code_directory", label: "选择代码保存文件夹", description: "生成或修改本机代码前，提示用户用本机文件夹选择器设置代码目录。选择后自动继续当前请求。不要接收或推测目录路径。", parameters: Type.Object({}),
        execute: async () => {
          const selected = await requestDirectory();
          return { content: [{ type: "text", text: `已选择代码工作目录：${JSON.stringify(selected)}。系统将加载编码工具并继续本次请求。` }], details: {} };
        },
      }));
      return;
    }
    for (const create of [createWriteToolDefinition, createEditToolDefinition,
      createPowerShellToolDefinition, createLsToolDefinition, createFindToolDefinition]) pi.registerTool(create(directory) as ToolDefinition);
  };
}
