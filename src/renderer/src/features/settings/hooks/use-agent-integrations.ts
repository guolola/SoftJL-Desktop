// Keeps integration drafts and asynchronous management actions outside the settings page composition.
import { useCallback, useEffect, useRef, useState } from "react";
import type { IntegrationOverview, McpSave, McpTest, SkillSave } from "../../../../../shared/contracts/agent-integrations.js";
import { requestJson } from "../../../services/api-client/index.js";

const root = "/api/desktop/integrations";
export function useAgentIntegrations(active: boolean) {
  const [data, setData] = useState<IntegrationOverview>();
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const revision = useRef(0);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    const requestRevision = ++revision.current;
    setLoading(true);
    requestJson<IntegrationOverview>(root, { signal: controller.signal }).then(result => {
      if (!controller.signal.aborted && requestRevision === revision.current) { setData(result); setError(""); }
    }).catch(cause => { if (!controller.signal.aborted && requestRevision === revision.current) setError(cause instanceof Error ? cause.message : String(cause)); })
      .finally(() => { if (!controller.signal.aborted && requestRevision === revision.current) setLoading(false); });
    return () => controller.abort();
  }, [active]);
  const action = useCallback(async (run: () => Promise<IntegrationOverview>) => {
    if (pending.current) return false;
    pending.current = true; revision.current++; setLoading(false); setBusy(true); setError("");
    try { const result = await run(); if (mounted.current) setData(result); return true; }
    catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : String(cause)); return false; }
    finally { pending.current = false; if (mounted.current) setBusy(false); }
  }, []);
  const saveMcp = (id: string, input: McpSave) => action(() => requestJson<IntegrationOverview>(`${root}/mcp/${encodeURIComponent(id)}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }));
  const saveSkill = (id: string, input: SkillSave) => action(() => requestJson<IntegrationOverview>(`${root}/skills/${encodeURIComponent(id)}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }));
  const remove = (kind: "mcp" | "skills", id: string) => action(() => requestJson<IntegrationOverview>(`${root}/${kind}/${encodeURIComponent(id)}`, { method: "DELETE" }));
  const test = (id: string) => action(async () => {
    const result = await requestJson<McpTest>(`${root}/mcp/${encodeURIComponent(id)}/test`, { method: "POST" });
    const overview = await requestJson<IntegrationOverview>(root);
    if (!result.ok) setError(result.message);
    return overview;
  });
  return { data, loading, busy, error, saveMcp, saveSkill, remove, test };
}
