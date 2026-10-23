// Shares the selected-directory status and explicit per-operation review shown in the modeling conversation.
import { z } from "zod";
import type { StandardProjectState } from "./standard-project.js";

export const conversationApprovalSchema = z.object({
  id: z.string(), runId: z.string(), toolCallId: z.string(), tool: z.string(), title: z.string(),
  directory: z.string(), path: z.string().optional(), detail: z.string(),
  changes: z.array(z.object({ oldText: z.string(), newText: z.string() }).strict()).optional(),
  warning: z.string().optional(),
}).strict();
export const conversationCodingStatusSchema = z.object({
  directory: z.string().nullable(), approvals: z.array(conversationApprovalSchema), busy: z.boolean(),
}).strict();
export type ConversationApproval = z.infer<typeof conversationApprovalSchema>;
export type ConversationCodingStatus = z.infer<typeof conversationCodingStatusSchema>;

export function missingCodingArtifacts(state: StandardProjectState): string[] {
  return [
    !Object.values(state.diagrams).some(item => item.status === "completed" && item.model) && "模型",
    !state.tests?.length && "测试用例",
    !state.documents?.requirementsSpec?.markdown.trim() && "需求规格说明书",
    !state.documents?.softwareDesignSpec?.markdown.trim() && "软件设计说明书",
  ].filter((item): item is string => Boolean(item));
}
export function codingArtifactAdvice(state: StandardProjectState, language: "zh-CN" | "en" = "zh-CN"): string {
  const missing = missingCodingArtifacts(state);
  if (language === "en") {
    const labels: Record<string, string> = { 模型: "models", 测试用例: "test cases", 需求规格说明书: "requirements specification", 软件设计说明书: "software design specification" };
    return missing.length ? `Missing ${missing.map(item => labels[item]).join(", ")}. We recommend completing these in this conversation before generating code. You can also explicitly choose to continue coding.` : "";
  }
  return missing.length ? `当前缺少${missing.join("、")}，建议先在本会话补齐，再生成代码；也可以明确选择继续编码。` : "";
}
