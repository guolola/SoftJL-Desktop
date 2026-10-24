// Exposes desktop conversation directory status and approvals; only the native chooser can grant a directory.
import { timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { ConversationCodingStatus, ConversationDirectoryRequest } from "../../../../shared/contracts/workspace/conversation-coding.js";
import { conversationDialogAnswerSchema, conversationDirectoryRequestSchema } from "../../../../shared/contracts/workspace/conversation-coding.js";
import type { AuthStore } from "../../auth/in-memory-auth-store.js";
import { isProjectPermissionError, requireProjectPermission } from "../../auth/guards.js";
import { readStandardState } from "../../runs/records/standard-project-record.js";

type Service = {
  status: (id: string) => Promise<ConversationCodingStatus>;
  select: (id: string, path: string | null, request?: ConversationDirectoryRequest) => Promise<ConversationCodingStatus>;
  answer: (projectId: string, runId: string, id: string, value: string | boolean | null) => void;
};
export function registerConversationCodingRoutes(app: FastifyInstance, authStore: AuthStore, service: Service, selectionCapability?: string) {
  const base = "/api/desktop/projects/:projectId/conversation-code";
  for (const method of ["GET", "POST", "DELETE"] as const) app.route({ method, url: base, async handler(request, reply) {
    const { projectId } = request.params as { projectId: string };
    const context = await requireProjectPermission(request, reply, authStore, projectId, method === "GET" ? "view_project" : "update_project");
    if (isProjectPermissionError(context)) return context;
    if (context.project.status !== "active") return reply.code(409).send({ message: "请打开有效项目" });
    if (method === "GET") return service.status(projectId);
    if (method === "POST") {
      const header = request.headers["x-softjl-directory-selection"];
      if (!selectionCapability || typeof header !== "string" || Buffer.byteLength(header) !== Buffer.byteLength(selectionCapability)
        || !timingSafeEqual(Buffer.from(header), Buffer.from(selectionCapability))) return reply.code(403).send({ message: "请通过本机文件夹选择器选择目录" });
    }
    const parsed = z.object({ directory: z.string().min(1).max(32767), request: conversationDirectoryRequestSchema.optional() }).strict().safeParse(request.body);
    if (method === "POST" && !parsed.success) return reply.code(400).send({ message: "目录参数无效" });
    const selection = method === "POST" && parsed.success ? parsed.data.request : undefined;
    {
      const state = readStandardState((await authStore.getProjectWorkspace(projectId)).state);
      if (selection) {
        if (state.run?.id !== selection.runId || state.run.status !== "running") return reply.code(409).send({ message: "文件夹选择请求已失效" });
      } else if (state.run?.status === "running") return reply.code(409).send({ message: "请先停止当前任务，再更换目录" });
    }
    try { return await service.select(projectId, method === "POST" && parsed.success ? parsed.data.directory : null, selection); }
    catch (error) { return reply.code(409).send({ message: error instanceof Error ? error.message : "目录不可用" }); }
  } });
  app.post(`${base}/approvals/:approvalId`, async (request, reply) => {
    const { projectId, approvalId } = request.params as { projectId: string; approvalId: string };
    const context = await requireProjectPermission(request, reply, authStore, projectId, "start_runs");
    if (isProjectPermissionError(context)) return context;
    if (context.project.status !== "active") return reply.code(409).send({ message: "会话已不可用" });
    const parsed = conversationDialogAnswerSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: "审批参数无效" });
    const state = readStandardState((await authStore.getProjectWorkspace(projectId)).state);
    if (state.run?.id !== parsed.data.runId || state.run.status !== "running") return reply.code(409).send({ message: "此审批已失效" });
    try { service.answer(projectId, parsed.data.runId, approvalId, parsed.data.value); return { ok: true }; }
    catch (error) { return reply.code(409).send({ message: error instanceof Error ? error.message : "审批已失效" }); }
  });
}
