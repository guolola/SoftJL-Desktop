// Checks runtime projection of actual artifact-only replies and excludes unfinished tool results.
import { expect, it } from "vitest";
import type { StandardConversationMessage } from "../../../../../shared/contracts/workspace/standard-project.js";
import { conversationArtifactParts, hasConversationArtifacts } from "./conversation-artifacts.js";

it("projects saved files, images and playable media independently of reply text", () => {
  const message: StandardConversationMessage = { id: "a", role: "assistant", text: "", status: "completed", createdAt: "now", tools: [{ id: "t", name: "generate_document", status: "completed", artifacts: [
    { type: "file", filename: "report.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", url: "/api/projects/p/documents/doc/download" },
    { type: "image", filename: "diagram.png", url: "data:image/png;base64,aGVsbG8=" },
    { type: "file", filename: "audio.wav", mimeType: "audio/wav", url: "https://example.test/audio.wav" },
  ] }] };
  expect(hasConversationArtifacts(message)).toBe(true);
  const parts = conversationArtifactParts(JSON.parse(JSON.stringify(message)));
  expect(parts).toEqual([
    { type: "file", filename: "report.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", data: new URL("/api/projects/p/documents/doc/download", window.location.href).href, sourceType: "url" },
    { type: "image", filename: "diagram.png", image: "data:image/png;base64,aGVsbG8=" },
    { type: "file", filename: "audio.wav", mimeType: "audio/wav", data: "https://example.test/audio.wav", sourceType: "url" },
  ]);
  for (const status of ["running", "failed"] as const) {
    const pending = { ...message, tools: [{ ...message.tools![0]!, status }] };
    expect(conversationArtifactParts(pending)).toEqual([]); expect(hasConversationArtifacts(pending)).toBe(false);
  }
});
