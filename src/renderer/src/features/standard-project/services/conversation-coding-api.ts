// Reads native directory grants and resolves operation reviews without a separate coding page or task store.
import { conversationCodingStatusSchema } from "../../../../../shared/contracts/workspace/conversation-coding.js";
import { postJson, requestJson } from "../../../services/api-client/index.js";

const path = (id: string) => `/api/desktop/projects/${encodeURIComponent(id)}/conversation-code`;
export const conversationCodingApi = {
  read: async (id: string, signal?: AbortSignal) => conversationCodingStatusSchema.parse(await requestJson(path(id), { signal })),
  clear: async (id: string) => conversationCodingStatusSchema.parse(await requestJson(path(id), { method: "DELETE" })),
  decide: (projectId: string, approvalId: string, runId: string, allow: boolean) => postJson(`${path(projectId)}/approvals/${encodeURIComponent(approvalId)}`, { runId, allow }),
};
