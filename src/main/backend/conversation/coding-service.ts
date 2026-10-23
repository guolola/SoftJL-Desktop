// Hosts Pi's select/input/confirm protocol; permission and questionnaire decisions stay in their plugins.
import { randomUUID } from "node:crypto";
import { mkdir, realpath, stat } from "node:fs/promises";
import { dirname, isAbsolute, join, relative } from "node:path";
import type { ExtensionUIContext, ExtensionUIDialogOptions } from "@earendil-works/pi-coding-agent";
import type { ConversationApproval, ConversationCodingStatus } from "../../../shared/contracts/workspace/conversation-coding.js";
import type { ConversationCodingHost } from "../../modeling/adapters/coding/conversation-coding-host.js";
import { codingExtension } from "./coding-tools.js";
import { desktopPiPackages, piPackagePath, preparePiWorkspace } from "./pi-packages.js";

const insideDirectory = (root: string, target: string) => {
  const path = relative(root, target);
  return path === "" || (!path.startsWith("..\\") && !path.startsWith("../") && path !== ".." && !isAbsolute(path));
};
type DirectoryStore = { read: (id: string) => Promise<string | null>; write: (id: string, path: string | null) => Promise<void> };
type Answer = string | boolean | null;
type Pending = { projectId: string; approval: ConversationApproval; finish: (value: Answer) => void };
export class ConversationCodingService implements ConversationCodingHost {
  private readonly notices = new Map<string, NonNullable<ConversationCodingStatus["notices"]>>();
  private readonly activeTools = new Map<string, { id: string; name: string; arguments: Record<string, unknown> }>();
  private readonly pending = new Map<string, Pending>();
  private readonly runs = new Map<string, { runId: string; controller: AbortController }>();
  private readonly changing = new Set<string>();
  constructor(private readonly store: DirectoryStore, private readonly protectedDirectory: string) {}
  async status(projectId: string): Promise<ConversationCodingStatus> {
    return { directory: await this.store.read(projectId), notices: this.notices.get(projectId) ?? [], busy: this.runs.has(projectId) || this.changing.has(projectId),
      approvals: [...this.pending.values()].filter(item => item.projectId === projectId).map(item => item.approval) };
  }
  async select(projectId: string, directory: string | null) {
    if (this.runs.has(projectId) || this.changing.has(projectId)) throw new Error("请先停止当前任务或等待目录保存，再切换项目目录");
    this.changing.add(projectId);
    try {
      let canonical: string | null = null;
      if (directory !== null) {
        canonical = await realpath(directory);
        const protectedPath = await realpath(this.protectedDirectory);
        if (!(await stat(canonical)).isDirectory() || dirname(canonical) === canonical
          || insideDirectory(canonical, protectedPath) || insideDirectory(protectedPath, canonical))
          throw new Error("请选择具体项目文件夹，不能选择磁盘根目录或应用数据目录");
      }
      await this.store.write(projectId, canonical);
    } finally { this.changing.delete(projectId); }
    return this.status(projectId);
  }
  answer(projectId: string, runId: string, id: string, value: Answer) {
    const item = this.pending.get(id);
    if (!item || item.projectId !== projectId || item.approval.runId !== runId || this.runs.get(projectId)?.runId !== runId)
      throw new Error("此交互已失效，请刷新当前会话");
    const prompt = item.approval;
    if (value !== null && (prompt.dialog === "confirm" ? typeof value !== "boolean"
      : typeof value !== "string" || (prompt.dialog === "select" && !prompt.options?.includes(value)))) throw new Error("回答不符合插件提供的选项");
    item.finish(value);
  }
  private async dialog(projectId: string, runId: string, directory: string, signal: AbortSignal,
    dialog: "select" | "input" | "confirm", title: string, extra: Partial<ConversationApproval>, opts?: ExtensionUIDialogOptions): Promise<Answer> {
    const combined = AbortSignal.any([signal, ...(opts?.signal ? [opts.signal] : [])]);
    if (combined.aborted) return null;
    const id = randomUUID();
    const active = this.activeTools.get(projectId);
    return new Promise(resolve => {
      const finish = (answer: Answer) => { clearTimeout(timer); combined.removeEventListener("abort", abort); this.pending.delete(id); resolve(answer); };
      const abort = () => finish(null);
      const timer = setTimeout(abort, opts?.timeout ?? 5 * 60_000);
      this.pending.set(id, { projectId, approval: { id, runId, toolCallId: active?.id ?? "", tool: active?.name ?? "pi_dialog", arguments: active?.arguments, title, directory, detail: "", dialog, ...extra }, finish });
      combined.addEventListener("abort", abort, { once: true });
      if (combined.aborted) abort();
    });
  }
  async open(...[projectId, runId, signal]: Parameters<ConversationCodingHost["open"]>) {
    if (this.runs.has(projectId) || this.changing.has(projectId)) throw new Error("当前会话已有任务或正在更换目录，请稍后重试");
    const controller = new AbortController();
    const combined = AbortSignal.any([signal, controller.signal]);
    this.runs.set(projectId, { runId, controller });
    this.notices.delete(projectId);
    try {
      const directory = await this.store.read(projectId);
      // Non-coding sessions still need a real private cwd for plugin configuration and web artifacts.
      const cwd = directory ?? join(this.protectedDirectory, "pi-workspaces", Buffer.from(projectId).toString("hex"));
      await mkdir(cwd, { recursive: true });
      const ask = (kind: "select" | "input" | "confirm", title: string, extra: Partial<ConversationApproval>, opts?: ExtensionUIDialogOptions) => this.dialog(projectId, runId, cwd, combined, kind, title, extra, opts);
      return { enabled: Boolean(directory), cwd, activeTool: (tool: { id: string; name: string; arguments: Record<string, unknown> } | null) => { if (tool) this.activeTools.set(projectId, tool); else this.activeTools.delete(projectId); }, extension: codingExtension(directory),
        additionalExtensionPaths: desktopPiPackages.filter(name => directory || !["pi-fff", "@gotgenes/pi-subagents"].includes(name)).map(piPackagePath),
        prepare: (model: { provider: string; id: string }) => preparePiWorkspace(cwd, model),
        createUI: (base: ExtensionUIContext): ExtensionUIContext => ({ ...base,
          notify: (message, type) => { this.notices.set(projectId, [...(this.notices.get(projectId) ?? []), { id: randomUUID(), message, level: type ?? "info" }].slice(-10)); },
          select: async (title, options, opts) => { const result = await ask("select", title, { options }, opts); return typeof result === "string" ? result : undefined; },
          input: async (title, placeholder, opts) => { const result = await ask("input", title, { placeholder }, opts); return typeof result === "string" ? result : undefined; },
          confirm: async (title, message, opts) => await ask("confirm", title, { detail: message }, opts) === true,
          editor: async (title, prefill) => { const result = await ask("input", title, { initialValue: prefill, multiline: true }); return typeof result === "string" ? result : undefined; },
        }),
        close: () => { controller.abort(); this.activeTools.delete(projectId); if (this.runs.get(projectId)?.runId === runId) this.runs.delete(projectId); } };
    } catch (error) { controller.abort(); this.runs.delete(projectId); throw error; }
  }
  close() { for (const run of this.runs.values()) run.controller.abort(); this.runs.clear(); }
}
