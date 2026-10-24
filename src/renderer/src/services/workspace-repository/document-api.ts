// Wraps document endpoints used by workspace repositories.
import type {
  DocumentLibraryListResponse,
} from "../../../../shared/contracts/index.js";
import { downloadBlob, requestJson } from "../api-client/index.js";
import { requireProjectScope, withProjectHeaders } from "./project-scope.js";

export async function listDocumentLibraryItems(projectId: string | null = null) {
  const scopedProjectId = requireProjectScope(projectId);
  const response = await requestJson<DocumentLibraryListResponse>(
    `/api/projects/${encodeURIComponent(scopedProjectId)}/documents`,
    withProjectHeaders(scopedProjectId, {
      errorKey: "documentsPage.errors.listFailed",
    }),
  );
  return response.documents;
}

export async function downloadDocumentFile(
  documentId: string,
  defaultFileName?: string,
  projectId: string | null = null,
) {
  const scopedProjectId = requireProjectScope(projectId);
  return downloadBlob(
    `/api/projects/${encodeURIComponent(scopedProjectId)}/documents/${encodeURIComponent(documentId)}/download`,
    withProjectHeaders(scopedProjectId, {
      errorKey: "documentsPage.errors.downloadFailed",
      defaultFileName: defaultFileName ?? "说明书.docx",
    }),
  );
}
