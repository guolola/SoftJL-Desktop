// Lists, downloads and previews documents produced by the project conversation.
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { DocumentLibraryItem } from "../../../../../shared/contracts/index.js";
import { Button } from "../../../shared/ui/button.js";
import { Input } from "../../../shared/ui/input.js";
import { PageContainer, PageHeader } from "../../../shared/template/layout/page.js";
import { downloadBlobFile } from "../../../shared/lib/download.js";
import { listDocumentLibraryItems, downloadDocumentFile } from "../../../services/workspace-repository/document-api.js";
import { DocxPreviewHost } from "./docx-preview-host.js";
import { DocumentManagementActions } from "./document-management-actions.js";
import { DeletedDocuments } from "./deleted-documents.js";

export function InstructionDocumentsPage({ projectId, activeDocumentId, disabled, revision, onOpen, onBack }: {
  projectId: string; activeDocumentId?: string; disabled: boolean; revision: string;
  onOpen: (id: string) => void; onBack: () => void;
}) {
  const { t } = useTranslation();
  const [documents, setDocuments] = useState<DocumentLibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [managementRevision, setManagementRevision] = useState(0);
  const [previewRevision, setPreviewRevision] = useState(0);
  const [preview, setPreview] = useState<{ id: string; blob: Blob } | null>(null);
  const refresh = useCallback(async () => {
    setLoading(true); setError("");
    try { setDocuments(await listDocumentLibraryItems(projectId)); }
    catch { setError("documentsPage.errors.listFailed"); }
    finally { setLoading(false); }
  }, [projectId]);
  useEffect(() => { void refresh(); }, [refresh, revision]);
  useEffect(() => {
    if (!activeDocumentId) { setPreview(null); return; }
    let active = true;
    setPreview(null); setError("");
    void downloadDocumentFile(activeDocumentId, undefined, projectId).then(file => {
      if (active) setPreview({ id: activeDocumentId, blob: file.blob });
    }).catch(() => { if (active) setError("documentsPage.errors.downloadFailed"); });
    return () => { active = false; };
  }, [activeDocumentId, projectId, previewRevision]);
  const download = async (document: DocumentLibraryItem) => {
    try { const file = await downloadDocumentFile(document.id, document.fileName, projectId); downloadBlobFile(file.fileName, file.blob); }
    catch { setError("documentsPage.errors.downloadFailed"); }
  };
  const changed = async () => { setManagementRevision(value => value + 1); await refresh(); };
  const selected = documents.find(document => document.id === activeDocumentId);
  return <PageContainer>
    <PageHeader title={t("documentsPage.title")} description={t("standardProject.documentDescription")}
      actions={activeDocumentId ? <Button variant="outline" onClick={onBack}>{t("documentsPage.backToList")}</Button> : undefined} />
    {error && <div role="alert" className="my-3 text-sm text-destructive">{t(error)}<Button variant="link" onClick={() => { if (activeDocumentId) setPreviewRevision(value => value + 1); else void refresh(); }}>{t("standardProject.reload")}</Button></div>}
    {activeDocumentId ? <div className="mt-4">
      {selected && <div className="mb-3 flex items-center gap-3"><span>{selected.fileName}</span><Button onClick={() => void download(selected)}>{t("documentsPage.download")}</Button></div>}
      {preview?.id === activeDocumentId ? <DocxPreviewHost blob={preview.blob} onLoadError={() => setError("documentsPage.errors.downloadFailed")} /> : !error && <p role="status">{t("documentsPage.previewLoading")}</p>}
    </div> : <>
      <h2 className="mt-6 font-semibold">{t("documentsPage.generatedDocuments")}</h2>
      <Input className="my-4" value={query} onChange={event => setQuery(event.target.value)} aria-label={t("documentsPage.title")} />
      {loading && <p role="status">{t("common.loading")}</p>}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{documents.filter(document => document.fileName.toLowerCase().includes(query.toLowerCase())).map(document => <article key={document.id} className="grid gap-3 rounded-xl border p-4">
        <h2 className="break-all font-medium">{document.fileName}</h2><p className="text-xs text-muted-foreground">v{document.version} · {document.updatedAt}</p>
        <div className="flex flex-wrap gap-2"><Button onClick={() => onOpen(document.id)}>{t("documentsPage.openPreview")}</Button><Button variant="outline" onClick={() => void download(document)}>{t("documentsPage.download")}</Button>
          <DocumentManagementActions projectId={projectId} document={document} canManage={!disabled} onChanged={changed} /></div>
      </article>)}</div>
      <DeletedDocuments projectId={projectId} canManage={!disabled} revision={managementRevision} onChanged={changed} />
    </>}
  </PageContainer>;
}
