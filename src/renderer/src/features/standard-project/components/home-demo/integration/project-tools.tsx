// Maps persisted modeling tool calls onto official assistant-ui elements.
import { PluginToolResult } from "./plugin-tool-result.js";
import { useContext, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuiState, type ToolCallMessagePartProps } from "@assistant-ui/react";
import { CheckIcon, CircleHelpIcon, CircleXIcon, LoaderCircleIcon } from "lucide-react";
import { ToolCall } from "./elements/tool-call.js";
import { ToolTimeline } from "./elements/tool-timeline.js";
import { useHomeDemo } from "./environment.js";
import { TerminalBlock } from "../../../../../shared/assistant-ui/elements/terminal-block.js";
import { ConversationCodingContext } from "../../../hooks/use-conversation-coding.js";
import { isPermissionDialog } from "../../../lib/conversation-dialog-presentation.js";

const labels: Record<string, [string, string]> = {
  read_resource: ["读取建模规范", "Read modeling guidance"],
  read: ["读取文件", "Read file"], write: ["写入文件", "Write file"], edit: ["编辑文件", "Edit file"],
  powershell: ["运行命令", "Run command"], ls: ["浏览目录", "List directory"],
  select_code_directory: ["选择代码保存文件夹", "Choose code folder"],
  web_search: ["搜索网页", "Search web"], fetch_content: ["读取网页", "Fetch content"],
  ask_user_question: ["询问用户", "Ask user"], subagent: ["子代理", "Subagent"], get_subagent_result: ["子代理结果", "Subagent result"], steer_subagent: ["引导子代理", "Steer subagent"],
  read_project: ["读取项目", "Read project"], read_diagram: ["读取图表", "Read diagrams"],
  read_deliverables: ["读取测试与说明书", "Read tests and specifications"],
  confirm_generation_scope: ["补充需求", "Clarify requirements"], save_outline: ["保存方案", "Save outline"],
  generate_diagrams: ["生成图表", "Generate diagrams"], save_diagram: ["保存图表", "Save diagram"],
  generate_tests: ["生成测试用例", "Generate test cases"], generate_document: ["生成说明书", "Generate document"],
  remember_decisions: ["保存项目约定", "Save project decisions"],
  report_unsupported_diagram: ["说明不支持的模型", "Explain unsupported model"],
};

export function useToolPresentation() {
  const { i18n } = useTranslation();
  const { state } = useHomeDemo();
  const coding = useContext(ConversationCodingContext);
  const messageId = useAuiState(s => s.message.id);
  const zh = i18n.resolvedLanguage?.startsWith("zh");
  const text = (chinese: string, english: string) => zh ? chinese : english;
  const latest = state.rounds.at(-1);
  const owner = state.conversation?.filter(message => message.role === "assistant").at(-1)?.id;
  // The question tool finishes when it publishes the form; the business workflow still waits for an answer.
  const waiting = !!latest?.questions.length && !latest.answers.length && owner === messageId;
  return { text, present: (part: Pick<ToolCallMessagePartProps, "toolCallId" | "toolName" | "status" | "isError" | "result" | "args">) => {
    const prompt = state.run?.status === "running" ? coding?.approvals.find(item => item.toolCallId === part.toolCallId && item.runId === state.run?.id) : undefined;
    const approval = prompt && isPermissionDialog(prompt);
    const running = part.status.type === "running" && !prompt;
    const failed = !!part.isError || part.status.type === "incomplete";
    const awaiting = !!prompt || (!running && !failed && part.toolName === "confirm_generation_scope" && waiting);
    const execution: { output: string; directory?: string; exitCode?: number; durationMs?: number; truncated?: boolean } | undefined = part.result && typeof part.result === "object" && "output" in part.result ? part.result as { output: string; directory?: string; exitCode?: number; durationMs?: number; truncated?: boolean }
      : typeof part.args.liveOutput === "string" ? { output: part.args.liveOutput } : undefined;
    return {
      label: labels[part.toolName === "read" && !coding?.directory ? "read_resource" : part.toolName]?.[zh ? 0 : 1] ?? part.toolName,
      running, failed, awaiting,
      name: part.toolName, args: part.args, data: part.args.data,
      command: ["powershell", "bash"].includes(part.toolName), request: typeof part.args.request === "string" ? part.args.request : "", execution,
      outcome: failed ? "failed" as const : awaiting ? "waiting" as const : "completed" as const,
      status: approval ? text("等待审批", "Waiting for approval") : running ? text("正在执行", "Running") : failed ? text("执行失败或已中断", "Failed or interrupted")
        : awaiting ? text("等待回答", "Waiting for answers") : text("已完成", "Completed"),
      icon: running ? LoaderCircleIcon : failed ? CircleXIcon : awaiting ? CircleHelpIcon : CheckIcon,
    };
  } };
}

type PresentedTool = ReturnType<ReturnType<typeof useToolPresentation>["present"]> & { id: string };

function ProjectToolActivity({ tools }: { tools: readonly PresentedTool[] }) {
  const [open, setOpen] = useState(false);
  const { text } = useToolPresentation();
  if (!tools.length) return null;
  if (tools.length === 1 && ["web_search", "fetch_content", "subagent", "get_subagent_result"].includes(tools[0]!.name)) {
    const tool = tools[0]!;
    return <PluginToolResult name={tool.name} args={tool.args} data={tool.data} output={tool.execution?.output} running={tool.running} failed={tool.failed} />;
  }
  // Commands and file results keep their inspectable payloads even when Pi bundled several calls in one message.
  if (tools.length > 1 && tools.some(tool => tool.request || ["web_search", "fetch_content", "subagent", "get_subagent_result"].includes(tool.name))) return <div>{tools.map(tool => <ProjectToolActivity key={tool.id} tools={[tool]} />)}</div>;
  if (tools.length === 1 && tools[0]!.command && !tools[0]!.awaiting && (tools[0]!.running || tools[0]!.execution?.exitCode !== undefined)) {
    const tool = tools[0]!;
    const lines = tool.execution?.output.split("\n") ?? [];
    return <TerminalBlock command={tool.request} lines={lines} visibleCount={lines.length} done={!tool.running}
      exitCode={tool.execution?.exitCode} cwd={tool.execution?.directory} durationMs={tool.execution?.durationMs}
      truncated={tool.execution?.truncated} maxCollapsedLines={12} className="my-2 max-w-none" />;
  }
  // Unknown result shapes retain their actual tool text.
  if (tools.length === 1) {
    const tool = tools[0]!;
    return <ToolCall label={tool.label} query={tool.status}
      request={tool.request || tool.label} result={tool.execution?.output || tool.status} requestLabel={text("操作", "Action")} resultLabel={tool.execution ? text("结果", "Result") : text("状态", "Status")}
      running={tool.running} outcome={tool.outcome} open={open} onOpenChange={setOpen} className="my-2 max-w-none" />;
  }
  const running = tools.some(tool => tool.running);
  const failed = tools.some(tool => tool.failed);
  const waiting = tools.some(tool => tool.awaiting);
  const count = text(`${tools.length} 个工具调用`, `${tools.length} tool calls`);
  return <ToolTimeline steps={tools.map(tool => ({ id: tool.id, verb: tool.label, chip: tool.status, icon: tool.icon, running: tool.running }))}
    visibleSteps={tools.length} streaming={running} open={open} onOpenChange={setOpen}
    restingLabel={`${count} · ${failed ? text("部分执行失败或已中断", "Some calls failed or were interrupted") : waiting ? text("等待回答", "Waiting for answers") : text("已完成", "Completed")}`}
    activeLabel={`${count} · ${text("正在执行", "Running")}`} stats={[]} className="my-2 max-w-none" />;
}

export function ProjectToolCall(part: ToolCallMessagePartProps) {
  const { present } = useToolPresentation();
  return <ProjectToolActivity tools={[{ id: part.toolCallId, ...present(part) }]} />;
}

export function ProjectToolTimeline({ indices }: { indices: readonly number[] }) {
  const parts = useAuiState(s => s.message.parts);
  const { present } = useToolPresentation();
  const calls = indices.map(index => parts[index]).filter(part => part?.type === "tool-call");
  return <ProjectToolActivity tools={calls.map(part => ({ id: part.toolCallId, ...present(part) }))} />;
}
