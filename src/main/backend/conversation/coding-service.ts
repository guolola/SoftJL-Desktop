// Keeps native directory grants and short-lived approvals separate from the durable modeling/Pi history.
import { randomUUID } from "node:crypto";
import { realpath, stat } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import type { ConversationApproval, ConversationCodingStatus } from "../../../shared/contracts/workspace/conversation-coding.js";
import type { ConversationCodingHost } from "../../modeling/adapters/coding/conversation-coding-host.js";
import { codingExtension } from "./coding-tools.js";

export const insideDirectory = (root: string, target: string) => {
  const path = relative(root, target);
  return path === "" || (!path.startsWith("..\\") && !path.startsWith("../") && path !== ".." && !isAbsolute(path));
};

// Resolve the nearest existing ancestor too: a new file below an escaping junction is still outside the grant.
export async function scopedPath(root: string, input: string): Promise<string> {
  if (!input || input.includes("\0")) throw new Error("无效项目路径");
  if (await realpath(root) !== root) throw new Error("项目目录已变化，请重新选择");
  const target = resolve(root, input);
  if (!insideDirectory(root, target)) throw new Error("只能访问用户选择的项目目录");
  let ancestor = target;
  while (true) {
    try {
      if (!insideDirectory(root, await realpath(ancestor))) throw new Error("不能通过链接访问项目目录之外的文件");
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      const parent = dirname(ancestor);
      if (parent === ancestor) throw error;
      ancestor = parent;
    }
  }
  return target;
}

type DirectoryStore = { read: (id: string) => Promise<string | null>; write: (id: string, path: string | null) => Promise<void> };
type Pending = { projectId: string; approval: ConversationApproval; finish: (error?: Error) => void };
export class ConversationCodingService implements ConversationCodingHost {
  private readonly pending = new Map<string, Pending>();
  private readonly runs = new Map<string, { runId: string; controller: AbortController }>();
  private readonly changing = new Set<string>();
  constructor(private readonly store: DirectoryStore, private readonly protectedDirectory: string) {}

  async status(projectId: string): Promise<ConversationCodingStatus> {
    return { directory: await this.store.read(projectId), busy: this.runs.has(projectId) || this.changing.has(projectId),
      approvals: [...this.pending.values()].filter(item => item.projectId === projectId).map(item => item.approval) };
  }
  async select(projectId: string, directory: string | null) {
    if (this.runs.has(projectId) || this.changing.has(projectId)) throw new Error("请先停止当前任务或等待目录保存，再切换项目目录");
    // Reserve the project before filesystem/database awaits so another window cannot start tools against a changing grant.
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
  approve(projectId: string, runId: string, id: string, allow: boolean) {
    const item = this.pending.get(id);
    if (!item || item.projectId !== projectId || item.approval.runId !== runId || this.runs.get(projectId)?.runId !== runId)
      throw new Error("此审批已失效，请刷新当前会话");
    item.finish(allow ? undefined : new Error("用户拒绝本次操作；不得自动重试或绕过审批"));
  }
  async request(projectId: string, approval: Omit<ConversationApproval, "id">, signal: AbortSignal) {
    signal.throwIfAborted();
    if (this.runs.get(projectId)?.runId !== approval.runId) throw new Error("编码任务已结束");
    const id = randomUUID();
    await new Promise<void>((resolveRequest, reject) => {
      const abort = () => finish(new Error("操作已取消"));
      const timer = setTimeout(() => finish(new Error("审批等待超时，本次操作未执行")), 5 * 60_000);
      const finish = (error?: Error) => {
        clearTimeout(timer); signal.removeEventListener("abort", abort); this.pending.delete(id);
        if (error) reject(error); else resolveRequest();
      };
      this.pending.set(id, { projectId, approval: { ...approval, id }, finish });
      signal.addEventListener("abort", abort, { once: true });
      if (signal.aborted) abort();
    });
    signal.throwIfAborted();
  }
  async open(...[projectId, runId, signal, current]: Parameters<ConversationCodingHost["open"]>) {
    if (this.runs.has(projectId) || this.changing.has(projectId)) throw new Error("当前会话已有任务或正在更换目录，请稍后重试");
    const controller = new AbortController();
    const combined = AbortSignal.any([signal, controller.signal]);
    this.runs.set(projectId, { runId, controller });
    try {
      const directory = await this.store.read(projectId);
      return { enabled: Boolean(directory), extension: codingExtension(this, { projectId, runId, directory, signal: combined, current }),
        close: () => { controller.abort(); if (this.runs.get(projectId)?.runId === runId) this.runs.delete(projectId); } };
    } catch (error) { controller.abort(); this.runs.delete(projectId); throw error; }
  }
  close() { for (const run of this.runs.values()) run.controller.abort(); this.runs.clear(); }
}
