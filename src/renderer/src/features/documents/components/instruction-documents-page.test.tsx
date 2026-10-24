// Verifies the conversation document library remains usable without engineering workspace providers.
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { withWorkspaceProviders } from "../../../../../../tests/renderer/helpers/workspace-test-utils.js";
import { InstructionDocumentsPage } from "./instruction-documents-page.js";
const api = vi.hoisted(() => ({ listDocumentLibraryItems: vi.fn(), downloadDocumentFile: vi.fn() }));
vi.mock("../../../services/workspace-repository/document-api.js", () => api);
vi.mock("./document-management-actions.js", () => ({ DocumentManagementActions: () => null }));
vi.mock("./deleted-documents.js", () => ({ DeletedDocuments: () => null }));
vi.mock("./docx-preview-host.js", () => ({ DocxPreviewHost: ({ blob }: { blob: Blob }) => <div data-testid="docx-preview">{blob.size}</div> }));
const document = { id: "doc", fileName: "需求规格说明书.docx", version: 1, updatedAt: "2026-10-23T00:00:00Z" };
const props = { projectId: "project", disabled: false, revision: "doc", onOpen: vi.fn(), onBack: vi.fn() };
beforeEach(() => { vi.clearAllMocks(); api.listDocumentLibraryItems.mockResolvedValue([document]); });
it("lists saved documents without a stage generation toolbar", async () => {
  render(withWorkspaceProviders(<InstructionDocumentsPage {...props} />));
  expect(await screen.findByText(document.fileName)).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "已生成说明书" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "生成" })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "在线预览" }));
  expect(props.onOpen).toHaveBeenCalledWith("doc");
});
it("retries a failed preview against the same authorized project and document", async () => {
  api.downloadDocumentFile.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ blob: new Blob(["doc"]), fileName: document.fileName });
  render(withWorkspaceProviders(<InstructionDocumentsPage {...props} activeDocumentId="doc" />));
  const alert = await screen.findByRole("alert");
  await userEvent.click(alert.querySelector("button")!);
  expect(await screen.findByTestId("docx-preview")).toHaveTextContent("3");
  await waitFor(() => expect(api.downloadDocumentFile).toHaveBeenCalledTimes(2));
  expect(api.downloadDocumentFile).toHaveBeenLastCalledWith("doc", undefined, "project");
});
