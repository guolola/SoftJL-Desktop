// Shares desktop workspace selection and Pi RPC dialogs with the renderer.
import { z } from "zod";

export const conversationApprovalSchema = z.object({
  id: z.string(), runId: z.string(), toolCallId: z.string(), tool: z.string(), title: z.string(),
  directory: z.string(), detail: z.string(),
  arguments: z.record(z.unknown()).optional(),
  dialog: z.enum(["select", "input", "confirm", "directory"]),
  options: z.array(z.string()).optional(), placeholder: z.string().optional(), initialValue: z.string().optional(),
  multiline: z.boolean().optional(),
}).strict();
export const conversationDialogAnswerSchema = z.object({ runId: z.string().min(1), value: z.union([z.string().max(200000), z.boolean(), z.null()]) }).strict();
export const conversationDirectoryRequestSchema = z.object({ runId: z.string().min(1), approvalId: z.string().min(1) }).strict();
export type ConversationDirectoryRequest = z.infer<typeof conversationDirectoryRequestSchema>;
export const conversationCodingStatusSchema = z.object({
  directory: z.string().nullable(), approvals: z.array(conversationApprovalSchema), busy: z.boolean(),
  notices: z.array(z.object({ id: z.string(), message: z.string(), level: z.enum(["info", "warning", "error"]) }).strict()).optional(),
}).strict();
export type ConversationApproval = z.infer<typeof conversationApprovalSchema>;
export type ConversationCodingStatus = z.infer<typeof conversationCodingStatusSchema>;
