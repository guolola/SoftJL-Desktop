// Loads and updates the same durable directory grant used by the conversation's coding tools.
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { conversationCodingStatusSchema, type ConversationCodingStatus } from "../../../../../shared/contracts/workspace/conversation-coding.js";
import { requestJson } from "../../../services/api-client/index.js";
import { ProjectWorkspaceField } from "./project-workspace-field.js";

export function ProjectWorkspaceSettings({ projectId, canManage, active }: { projectId: string; canManage: boolean; active: boolean }) {
  const { t } = useTranslation();
  const available = typeof window.desktop?.chooseConversationDirectory === "function";
  const [status, setStatus] = useState<ConversationCodingStatus>({ directory: null, busy: false, approvals: [] });
  const [loading, setLoading] = useState(available && active);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);
  const revision = useRef(0);
  const path = `/api/desktop/projects/${encodeURIComponent(projectId)}/conversation-code`;
  useEffect(() => {
    if (!available || !active) return;
    const controller = new AbortController(); const current = ++revision.current;
    setLoading(true); setError(""); setStatus({ directory: null, busy: false, approvals: [] });
    requestJson(path, { signal: controller.signal }).then(result => {
      if (!controller.signal.aborted && current === revision.current) setStatus(conversationCodingStatusSchema.parse(result));
    }).catch(cause => { if (!controller.signal.aborted && current === revision.current) setError(cause instanceof Error ? cause.message : t("projectWorkspace.failed")); })
      .finally(() => { if (!controller.signal.aborted && current === revision.current) setLoading(false); });
    return () => { controller.abort(); revision.current++; };
  }, [available, active, path, t]);
  const reason = !available ? t("projectWorkspace.desktopOnly") : !canManage ? t("projectWorkspace.permission") : !active ? t("projectWorkspace.inactive") : status.busy ? t("projectWorkspace.busy") : undefined;
  const update = async (clear = false) => {
    if (busy.current || loading || reason) return;
    busy.current = true; setPending(true); setError(""); const current = revision.current;
    try {
      if (clear) {
        const next = conversationCodingStatusSchema.parse(await requestJson(path, { method: "DELETE" }));
        if (current === revision.current) setStatus(next);
      } else {
        const directory = await window.desktop.chooseConversationDirectory(projectId);
        if (directory && current === revision.current) setStatus(value => ({ ...value, directory }));
      }
    } catch (cause) { if (current === revision.current) setError(cause instanceof Error ? cause.message : t("projectWorkspace.failed")); }
    finally { busy.current = false; if (current === revision.current) setPending(false); }
  };
  return <ProjectWorkspaceField directory={status.directory} choosing={loading || pending} disabled={!!reason} reason={reason ?? t("projectWorkspace.savedImmediately")} error={error} onChoose={() => void update()} onClear={() => void update(true)} />;
}
