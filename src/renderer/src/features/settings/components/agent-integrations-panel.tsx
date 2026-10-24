// Presents MCP connections and Skill workflows using the same desktop settings primitives.
import { useEffect, useState } from "react";
import { ArrowLeft, BookOpen, Cable, CheckCircle2, ExternalLink, Plus, RotateCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { McpView, SkillSave, SkillView } from "../../../../../shared/contracts/agent-integrations.js";
import { mcpSaveSchema, skillSaveSchema, integrationIdSchema } from "../../../../../shared/contracts/agent-integrations.js";
import { Button } from "../../../shared/ui/button.js";
import { Input } from "../../../shared/ui/input.js";
import { Label } from "../../../shared/ui/label.js";
import { Textarea } from "../../../shared/ui/textarea.js";
import { Switch } from "../../../shared/ui/switch.js";
import { useAgentIntegrations } from "../hooks/use-agent-integrations.js";

type Props = { kind: "mcp" | "skills"; active: boolean; onDirtyChange: (dirty: boolean) => void; onBusyChange: (busy: boolean) => void };
type McpDraft = { id: string; name: string; description: string; enabled: boolean; type: "stdio" | "http"; command: string; args: string; cwd: string; url: string; secrets: string };
const mcpDraft = (server?: McpView): McpDraft => ({ id: server?.id ?? "", name: server?.name ?? "", description: server?.description ?? "", enabled: server?.enabled ?? false, type: server?.config.type ?? "stdio", command: server?.config.type === "stdio" ? server.config.command : "", args: JSON.stringify(server?.config.type === "stdio" ? server.config.args : [], null, 2), cwd: server?.config.type === "stdio" ? server.config.cwd ?? "" : "", url: server?.config.type === "http" ? server.config.url : "", secrets: "" });
const skillDraft = (skill?: SkillView): SkillSave => ({ name: skill?.name ?? "", description: skill?.description ?? "", content: skill?.content ?? "", enabled: skill?.enabled ?? true });

export function AgentIntegrationsPanel({ kind, active, onDirtyChange, onBusyChange }: Props) {
  const { t } = useTranslation();
  const api = useAgentIntegrations(active);
  const [editing, setEditing] = useState<string | null>(null);
  const [mcp, setMcp] = useState<McpDraft>(() => mcpDraft());
  const [skill, setSkill] = useState<SkillSave>(() => skillDraft());
  const [baseline, setBaseline] = useState("");
  const [formError, setFormError] = useState("");
  const selectedSkill = api.data?.skills.find(item => item.id === editing);
  const selectedMcp = api.data?.servers.find(item => item.id === editing);
  const readonly = kind === "skills" && selectedSkill?.required;
  const draft = kind === "mcp" ? mcp : skill;
  const dirty = editing !== null && !readonly && JSON.stringify(draft) !== baseline;
  useEffect(() => { onDirtyChange(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => { onBusyChange(api.busy); }, [api.busy, onBusyChange]);
  const open = (id: string) => {
    const next = kind === "mcp" ? mcpDraft(api.data?.servers.find(item => item.id === id)) : skillDraft(api.data?.skills.find(item => item.id === id));
    if (kind === "mcp") setMcp(next as McpDraft); else setSkill(next as SkillSave);
    setBaseline(JSON.stringify(next)); setEditing(id); setFormError("");
  };
  const back = () => { if (dirty && !window.confirm(t("desktopShell.discard"))) return; setEditing(null); setFormError(""); };
  const save = async () => {
    if (api.busy || readonly) return;
    try {
      let saved: boolean;
      if (kind === "mcp") {
        integrationIdSchema.parse(mcp.id);
        const secretMap = mcp.secrets.trim() ? JSON.parse(mcp.secrets) : undefined;
        const config = mcp.type === "http" ? { type: "http" as const, url: mcp.url, headers: secretMap } : { type: "stdio" as const, command: mcp.command, args: JSON.parse(mcp.args), cwd: mcp.cwd || undefined, env: secretMap };
        // New connections use ordinary tool calls; retain the contract of existing saved connections.
        saved = await api.saveMcp(mcp.id, mcpSaveSchema.parse({ name: mcp.name, description: mcp.description, enabled: mcp.enabled, exposure: selectedMcp?.exposure ?? "direct", config }));
      } else {
        saved = await api.saveSkill(skill.name, skillSaveSchema.parse(skill));
      }
      if (saved) { setEditing(null); setFormError(""); }
    } catch { setFormError(t("integrations.invalidForm")); }
  };
  const deleteItem = async () => {
    if (editing === null || api.busy || readonly || !window.confirm(t("integrations.confirmDelete"))) return;
    if (await api.remove(kind, editing)) setEditing(null);
  };
  const field = (key: keyof McpDraft, value: string | boolean) => setMcp(current => ({ ...current, [key]: value }));
  const error = formError || api.error;

  if (editing !== null) return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Button variant="ghost" onClick={back} disabled={api.busy}><ArrowLeft className="size-4" />{t("integrations.back")}</Button>
      <div className="flex gap-2">{editing && !readonly && <Button variant="outline" onClick={() => void deleteItem()} disabled={api.busy}>{t("integrations.delete")}</Button>}
        {!readonly && <Button onClick={() => void save()} disabled={api.busy || !dirty}>{t("integrations.save")}</Button>}</div>
    </div>
    {error && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
    {kind === "mcp" ? <fieldset disabled={api.busy} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="mcp-id">{t("integrations.id")}</Label><Input id="mcp-id" value={mcp.id} disabled={!!editing} placeholder="my-service" onChange={e => field("id", e.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="mcp-name">{t("integrations.name")}</Label><Input id="mcp-name" value={mcp.name} onChange={e => field("name", e.target.value)} /></div></div>
      <div className="space-y-2"><Label htmlFor="mcp-description">{t("integrations.description")}</Label><Input id="mcp-description" value={mcp.description} onChange={e => field("description", e.target.value)} /></div>
      <div className="space-y-2"><Label htmlFor="mcp-transport">{t("integrations.transport")}</Label><select id="mcp-transport" className="h-9 w-full rounded-md border bg-background px-3" value={mcp.type} onChange={e => { field("type", e.target.value); field("secrets", ""); }}><option value="stdio">{t("integrations.local")}</option><option value="http">Streamable HTTP</option></select></div>
      {mcp.type === "stdio" ? <>
        <div className="space-y-2"><Label htmlFor="mcp-command">{t("integrations.command")}</Label><Input id="mcp-command" value={mcp.command} placeholder="npx" onChange={e => field("command", e.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="mcp-args">{t("integrations.args")}</Label><Textarea id="mcp-args" className="min-h-24 font-mono text-xs" value={mcp.args} onChange={e => field("args", e.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="mcp-cwd">{t("integrations.cwd")}</Label><Input id="mcp-cwd" value={mcp.cwd} onChange={e => field("cwd", e.target.value)} /></div>
      </> : <div className="space-y-2"><Label htmlFor="mcp-url">{t("integrations.url")}</Label><Input id="mcp-url" type="url" value={mcp.url} onChange={e => field("url", e.target.value)} /></div>}
      <div className="space-y-2"><Label htmlFor="mcp-secrets">{t(mcp.type === "http" ? "integrations.headers" : "integrations.env")}</Label><Textarea id="mcp-secrets" autoComplete="off" spellCheck={false} className="min-h-24 font-mono text-xs" value={mcp.secrets} placeholder={mcp.type === "http" ? '{"Authorization":"Bearer …"}' : '{"SOFTJL_DATABASE_URL":"…"}'} onChange={e => field("secrets", e.target.value)} />
        <p className="text-xs text-muted-foreground">{t("integrations.secretHint")}</p>
        {selectedMcp && <p className="text-xs text-muted-foreground">{t("integrations.savedKeys")}{(mcp.type === "http" ? selectedMcp.headerKeys : selectedMcp.envKeys).join(", ") || t("integrations.none")}</p>}</div>
      {selectedMcp && <p className="rounded-lg bg-muted p-3 text-sm">{selectedMcp.setup}</p>}
      <div className="flex items-center justify-between"><Label htmlFor="mcp-enabled">{t("integrations.enabled")}</Label><Switch id="mcp-enabled" checked={mcp.enabled} onCheckedChange={value => field("enabled", value)} /></div>
    </fieldset> : <fieldset disabled={api.busy || readonly} className="space-y-4">
      <div className="space-y-2"><Label htmlFor="skill-name">{t("integrations.id")}</Label><Input id="skill-name" disabled={!!editing} value={skill.name} placeholder="my-workflow" onChange={e => setSkill(current => ({ ...current, name: e.target.value }))} /></div>
      <div className="space-y-2"><Label htmlFor="skill-description">{t("integrations.skillDescription")}</Label><Textarea id="skill-description" value={skill.description} onChange={e => setSkill(current => ({ ...current, description: e.target.value }))} /></div>
      <div className="space-y-2"><Label htmlFor="skill-content">{t("integrations.content")}</Label><Textarea id="skill-content" className="min-h-64 font-mono text-xs" value={skill.content} onChange={e => setSkill(current => ({ ...current, content: e.target.value }))} /></div>
      <div className="flex items-center justify-between"><Label htmlFor="skill-enabled">{t("integrations.enabled")}</Label><Switch id="skill-enabled" checked={skill.enabled} onCheckedChange={value => setSkill(current => ({ ...current, enabled: value }))} /></div>
    </fieldset>}
    {selectedSkill && <p className="text-sm text-muted-foreground">{selectedSkill.prerequisites}{readonly && ` ${t("integrations.requiredHint")}`}</p>}
  </div>;

  return <div className="space-y-4" aria-busy={api.busy || api.loading}>
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/30 p-4">
      <div><p className="text-sm font-medium">{t(kind === "mcp" ? "integrations.mcpSummary" : "integrations.skillsSummary")}</p><p className="mt-1 text-xs text-muted-foreground">{t("integrations.nextTurn")}</p></div>
      <Button variant="outline" onClick={() => open("")} disabled={api.busy || api.loading}><Plus className="size-4" />{t(kind === "mcp" ? "integrations.addMcp" : "integrations.addSkill")}</Button>
    </div>
    {error && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
    {api.loading && <p role="status" className="text-sm text-muted-foreground">{t("integrations.loading")}</p>}
    {kind === "mcp" ? api.data?.servers.map(server => <article key={server.id} className="space-y-3 rounded-xl border p-4">
      <div className="flex items-start justify-between gap-3"><div className="flex gap-3"><Cable className="mt-1 size-5 shrink-0 text-muted-foreground" /><div><h3 className="font-medium">{server.name}</h3><p className="mt-1 text-sm text-muted-foreground">{server.description}</p></div></div>
        <Switch aria-label={t("integrations.toggle", { name: server.name })} checked={server.enabled} disabled={api.busy} onCheckedChange={enabled => void api.saveMcp(server.id, { name: server.name, description: server.description, enabled, exposure: server.exposure, config: server.config })} /></div>
      <div className="flex flex-wrap gap-2 text-xs"><span className="rounded-md bg-muted px-2 py-1">{server.config.type === "http" ? "HTTP" : t("integrations.local")}</span><span className="rounded-md bg-muted px-2 py-1">{t(server.enabled ? "integrations.on" : "integrations.off")}</span></div>
      <p className="text-xs text-muted-foreground">{server.setup}</p>
      {server.test && <details className="text-xs"><summary className={server.test.ok ? "cursor-pointer text-emerald-600" : "cursor-pointer text-destructive"}>{server.test.ok && <CheckCircle2 className="mr-1 inline size-3" />}{server.test.message} · {new Date(server.test.checkedAt).toLocaleString()}</summary><ul className="mt-2 max-h-40 space-y-1 overflow-auto">{server.test.tools.map(tool => <li key={tool.name}><span className="font-mono">{tool.name}</span>{tool.description && ` — ${tool.description}`}</li>)}</ul></details>}
      <div className="flex flex-wrap items-center gap-2"><Button size="sm" variant="outline" disabled={api.busy} onClick={() => open(server.id)}>{t("integrations.configure")}</Button><Button size="sm" variant="ghost" disabled={api.busy} onClick={() => void api.test(server.id)}><RotateCw className={api.busy ? "size-3 animate-spin" : "size-3"} />{t("integrations.test")}</Button>{server.sourceUrl && <a className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline" href={server.sourceUrl} target="_blank" rel="noreferrer">{t("integrations.source")}<ExternalLink className="size-3" /></a>}</div>
    </article>) : api.data?.skills.map(item => <article key={item.id} className="space-y-3 rounded-xl border p-4">
      <div className="flex items-start justify-between gap-3"><div className="flex gap-3"><BookOpen className="mt-1 size-5 shrink-0 text-muted-foreground" /><div><h3 className="font-medium">{item.title}</h3><p className="mt-1 text-sm text-muted-foreground">{item.description}</p></div></div>
        <Switch aria-label={t("integrations.toggle", { name: item.title })} checked={item.enabled} disabled={api.busy || item.required} onCheckedChange={enabled => void api.saveSkill(item.id, { name: item.name, description: item.description, content: item.content, enabled })} /></div>
      <p className="text-xs text-muted-foreground">{item.prerequisites}</p><div className="flex flex-wrap items-center gap-2"><span className="rounded-md bg-muted px-2 py-1 text-xs">{t(item.required ? "integrations.required" : item.builtin ? "integrations.adapted" : "integrations.custom")}</span><Button size="sm" variant="outline" onClick={() => open(item.id)} disabled={api.busy}>{t(item.required ? "integrations.view" : "integrations.edit")}</Button>{item.sourceUrl && <a className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline" href={item.sourceUrl} target="_blank" rel="noreferrer">{t("integrations.source")}<ExternalLink className="size-3" /></a>}</div>
    </article>)}
  </div>;
}
