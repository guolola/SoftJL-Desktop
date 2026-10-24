// Projects persisted result artifacts into assistant-ui File and Image parts, including artifact-only replies.
import type { StandardConversationMessage } from "../../../../../shared/contracts/workspace/standard-project.js";
import type { StandardConversationArtifact } from "../../../../../shared/contracts/workspace/conversation-artifacts.js";

type ArtifactPart = { type: "image"; image: string; filename?: string } | { type: "file"; data: string; filename: string; mimeType: string; sourceType: "url" };

export function conversationArtifactParts(message: StandardConversationMessage) {
  const artifacts: StandardConversationArtifact[] = [...(message.artifacts ?? []), ...(message.tools ?? []).flatMap(tool => tool.status === "completed" ? tool.artifacts ?? [] : [])];
  const seen = new Set<string>();
  return artifacts.flatMap((artifact): ArtifactPart[] => {
    const key = `${artifact.type}:${artifact.url}`;
    if (seen.has(key)) return [];
    seen.add(key);
    // Resolve project-scoped download routes against this app; inline data remains a data URL.
    const url = new URL(artifact.url, window.location.href).href;
    return artifact.type === "image"
      ? [{ type: "image" as const, image: url, ...(artifact.filename ? { filename: artifact.filename } : {}) }]
      : [{ type: "file" as const, data: url, filename: artifact.filename, mimeType: artifact.mimeType, sourceType: "url" as const }];
  });
}

export function hasConversationArtifacts(message: StandardConversationMessage) {
  return Boolean(message.artifacts?.length || message.tools?.some(tool => tool.status === "completed" && tool.artifacts?.length));
}
