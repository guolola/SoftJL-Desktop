// Publishes conversation-generated specifications to the project document library.
import type { StandardProjectState } from "../../../../shared/contracts/index.js";
import type { DocumentLibrary } from "../library/document-library.js";
import { projectDocumentWorkspaceId } from "../library/project-document-workspace.js";
import type { PngRenderClient } from "../../adapters/render/png-render-client.js";
import { buildStandardDocument } from "./standard-document.js";

export async function publishStandardDocument(input: {
  state: StandardProjectState; kind: "requirementsSpec" | "softwareDesignSpec"; projectId: string; userId: string;
  library: DocumentLibrary; render: PngRenderClient; signal?: AbortSignal;
}) {
  const { state, kind, library, signal } = input;
  signal?.throwIfAborted();
  const buffer = await buildStandardDocument(state, kind, artifact => input.render(artifact, signal));
  signal?.throwIfAborted();
  const document = await library.saveGeneratedDocument({ workspaceId: projectDocumentWorkspaceId(input.projectId),
    projectId: input.projectId, createdByUserId: input.userId, documentKind: kind,
    // The document belongs to the saved conversation; history uses its own accepted-command record.
    sourceRunId: null, fileName: `${state.documents![kind]!.title}.docx`, buffer });
  if (signal?.aborted) { await library.deleteDocument(document.workspaceId, document.id); signal.throwIfAborted(); }
  return document.id;
}
