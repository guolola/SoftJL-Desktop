// Converts completed document and MCP content blocks into durable, typed conversation artifacts.
import { standardConversationArtifactSchema, type StandardConversationArtifact } from "../../../../../shared/contracts/workspace/conversation-artifacts.js";

const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
export function standardToolArtifacts(projectId: string, toolName: string, value: unknown): StandardConversationArtifact[] {
  const result = record(value);
  const raw = record(result.structuredContent);
  if (result.isError === true || raw.isError === true) return [];
  const artifacts: StandardConversationArtifact[] = [];
  const add = (candidate: unknown) => {
    const parsed = standardConversationArtifactSchema.safeParse(candidate);
    if (parsed.success && artifacts.length < 8 && !artifacts.some(item => item.type === parsed.data.type && item.url === parsed.data.url)) artifacts.push(parsed.data);
  };
  // A generated document is downloadable only after publication succeeded and returned its library identity.
  const document = record(record(result.details).document);
  if (toolName === "generate_document" && typeof document.id === "string" && document.id && typeof document.filename === "string") {
    add({ type: "file", url: `/api/projects/${encodeURIComponent(projectId)}/documents/${encodeURIComponent(document.id)}/download`,
      filename: document.filename, mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  }
  const blocks = [...(Array.isArray(result.content) ? result.content : []), ...(Array.isArray(raw.content) ? raw.content : [])];
  for (const value of blocks) {
    const block = record(value);
    if (block.type === "image" && typeof block.mimeType === "string" && block.mimeType.startsWith("image/") && typeof block.data === "string") {
      add({ type: "image", url: `data:${block.mimeType};base64,${block.data}` });
    } else if (block.type === "resource_link" && typeof block.uri === "string" && typeof block.name === "string") {
      if (typeof block.mimeType === "string" && block.mimeType.startsWith("image/")) add({ type: "image", url: block.uri, filename: block.name });
      else add({ type: "file", url: block.uri, filename: block.name, mimeType: typeof block.mimeType === "string" ? block.mimeType : "application/octet-stream" });
    } else if (block.type === "resource") {
      const resource = record(block.resource);
      if (typeof resource.mimeType === "string" && (typeof resource.blob === "string" || typeof resource.text === "string")) {
        const data = typeof resource.blob === "string" ? resource.blob : Buffer.from(resource.text as string).toString("base64");
        const url = `data:${resource.mimeType};base64,${data}`;
        if (resource.mimeType.startsWith("image/")) add({ type: "image", url });
        else add({ type: "file", url, filename: String(resource.uri ?? "attachment").split(/[\\/]/u).at(-1) || "attachment", mimeType: resource.mimeType });
      }
    } else if (block.type === "audio" && typeof block.mimeType === "string" && typeof block.data === "string") {
      add({ type: "file", url: `data:${block.mimeType};base64,${block.data}`, filename: "audio", mimeType: block.mimeType });
    }
  }
  return artifacts;
}
