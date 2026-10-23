// Polls only desktop capability status; unmounted or replaced projects cannot receive stale review state.
import { createContext, useEffect, useRef, useState } from "react";
import type { ConversationCodingStatus } from "../../../../../shared/contracts/workspace/conversation-coding.js";
import { conversationCodingApi } from "../services/conversation-coding-api.js";
export const ConversationCodingContext = createContext<ConversationCodingStatus | null>(null);

export function useConversationCoding(projectId: string) {
  const available = typeof window.desktop?.chooseConversationDirectory === "function";
  const [status, setStatus] = useState<ConversationCodingStatus>({ directory: null, approvals: [], busy: false });
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const lock = useRef(false);
  const [readError, setReadError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!available) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try { const result = await conversationCodingApi.read(projectId, controller.signal); if (!controller.signal.aborted) { setStatus(result); setReadError(""); } }
      catch (error) { if (!controller.signal.aborted) setReadError(error instanceof Error ? error.message : "无法读取编码状态"); }
      finally { if (!controller.signal.aborted) timer = setTimeout(() => { void poll(); }, 700); }
    };
    void poll();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [available, projectId, revision]);
  const act = async (action: () => Promise<unknown>) => {
    if (lock.current) throw new Error("请等待当前操作完成");
    lock.current = true;
    setPending(true); setError("");
    try { await action(); setRevision(value => value + 1); }
    catch (error) { setError(error instanceof Error ? error.message : "操作失败，请重试"); throw error; }
    finally { lock.current = false; setPending(false); }
  };
  return { available, status, error: error || readError, pending, connected: !readError,
    decide: (id: string, runId: string, value: string | boolean | null) => act(async () => {
      await conversationCodingApi.decide(projectId, id, runId, value);
      setStatus(value => ({ ...value, approvals: value.approvals.filter(item => item.id !== id) }));
    }),
  };
}
