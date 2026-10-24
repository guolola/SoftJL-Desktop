// Localizes plugin-owned dialog chrome without changing upstream answers, paths or authored question text.
import type { ConversationApproval } from "../../../../../shared/contracts/workspace/conversation-coding.js";
import { z } from "zod";

export function isPermissionDialog(prompt: ConversationApproval) {
  return /^Permission Required(?: \(Subagent\))?(?:\n|$)/.test(prompt.title);
}

const copy: Record<string, string> = {
  "Permission Required": "需要授权", "Permission Required (Subagent)": "子代理需要授权",
  "Yes": "仅本次允许", "Yes, for this session": "本会话允许", "No": "拒绝", "No, provide reason": "拒绝并说明原因",
  "Apply this session grant to:": "本会话授权适用范围：",
  "Share why this request was denied (optional).": "请说明拒绝原因（可选）。",
  "Reason shown back to the agent": "向助手说明拒绝原因",
  "Type something.": "输入其他答案", "Type your answer:": "请输入你的答案：",
  "This subagent only": "仅此子代理", "1,3; custom answer": "1,3; 补充答案",
  'Enter the numbers of all that apply, comma-separated (e.g. "1,3"). Add "; custom answer" to include your own text, or type only custom text.':
    "输入所有适用选项的编号，以逗号分隔（例如 1,3）。可在分号后补充答案，也可只输入自定义答案。",
};

export function pluginDialogText(value: string, zh: boolean, permission = false): string {
  if (!zh) return value;
  return value.split("\n").map(line => {
    if (!permission && ["Yes", "Yes, for this session", "No", "No, provide reason"].includes(line)) return line;
    if (Object.hasOwn(copy, line)) return copy[line]!;
    const other = /^(\d+\. )Type something\.$/.exec(line);
    if (other) return `${other[1]}${copy["Type something."]}`;
    if (!permission) return line;
    const field = /^(skill|read path|write path|path|command|tool|external directory)(\s*[:：]\s*)(.*)$/.exec(line);
    if (field) return `${({ skill: "技能", "read path": "读取路径", "write path": "写入路径", path: "路径", command: "命令", tool: "工具", "external directory": "外部目录" } as Record<string, string>)[field[1]!]}：${field[3]}`;
    const session = /^Yes, allow (.+) for this session$/.exec(line);
    if (session) {
      const target = session[1]!.replace(/^reads and writes to /, "读写 ").replace(/^reads to /, "读取 ").replace(/^writes to /, "写入 ")
        .replace(/^access to external directory /, "访问外部目录 ").replace(/^access to /, "访问 ")
        .replace(/^mcp tool /, "MCP 工具 ").replace(/^skill /, "技能 ").replace(/^path /, "路径 ");
      return `本会话允许${target}`;
    }
    const subagent = /^This subagent \('(.+)'\) only$/.exec(line);
    if (subagent) return `仅此子代理（${subagent[1]}）`;
    const whole = /^The whole session — allow (.+) for parent and all subagents$/.exec(line);
    return whole ? `整个会话：允许主代理和所有子代理使用 ${whole[1]}` : line;
  }).join("\n");
}

const questionsSchema = z.object({ questions: z.array(z.object({
  header: z.string().optional(), question: z.string(), multiSelect: z.boolean().optional(),
  options: z.array(z.object({ label: z.string(), description: z.string(), preview: z.string().optional() })),
})) });

export function pluginQuestion(prompt: ConversationApproval) {
  if (prompt.tool !== "ask_user_question" || isPermissionDialog(prompt)) return undefined;
  return pluginQuestions(prompt.arguments)?.find(question => prompt.title.startsWith(`${question.header ? `[${question.header}] ` : ""}${question.question}`));
}

export function pluginQuestions(args: unknown) {
  const parsed = questionsSchema.safeParse(args);
  return parsed.success ? parsed.data.questions : undefined;
}
