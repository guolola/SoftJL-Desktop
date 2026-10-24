// Converts saved diagram sources for downloads in the conversation workspace.
import { renderPngResponseSchema, renderPdfResponseSchema, type UmlDiagramKind } from "../../../../shared/contracts/index.js";
import { postJson } from "../api-client/index.js";
import { requireProjectScope, projectHeaders } from "./project-scope.js";
export async function exportDiagramRequest(input: { diagramKind: UmlDiagramKind; plantUmlSource: string; format: "png" | "pdf" }, projectId: string | null, signal?: AbortSignal): Promise<Blob> {
  const scopedProjectId = requireProjectScope(projectId);
  const payload = await postJson<unknown>(`/api/render/${input.format}`, {
    diagramKind: input.diagramKind, plantUmlSource: input.plantUmlSource,
  }, { signal, headers: projectHeaders(scopedProjectId), errorKey: "diagrams.detail.downloadFailed" });
  const base64 = input.format === "png" ? renderPngResponseSchema.parse(payload).pngBase64 : renderPdfResponseSchema.parse(payload).pdfBase64;
  const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
  const valid = input.format === "png"
    ? [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)
    : new TextDecoder().decode(bytes.subarray(0, 5)) === "%PDF-";
  if (!valid) throw new Error("Invalid diagram download content");
  return new Blob([bytes], { type: input.format === "png" ? "image/png" : "application/pdf" });
}
