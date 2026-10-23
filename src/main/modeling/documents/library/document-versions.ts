// Maps document metadata to the shared version contract before persistence.
import { documentLibraryVersionItemSchema, type DocumentLibraryItem, type DocumentLibraryVersionItem } from "../../../../shared/contracts/index.js";

export function versionItemFromDocument(
  item: DocumentLibraryItem,
): DocumentLibraryVersionItem {
  return documentLibraryVersionItemSchema.parse({
    documentId: item.id,
    workspaceId: item.workspaceId,
    projectId: item.projectId ?? null,
    createdByUserId: item.createdByUserId ?? null,
    version: item.version,
    fileName: item.fileName,
    mimeType: item.mimeType,
    byteLength: item.byteLength,
    sourceRunId: item.sourceRunId,
    createdAt: item.updatedAt,
  });
}
