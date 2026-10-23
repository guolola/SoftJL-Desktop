// Renders Pi's native dialog protocol with official assistant-ui registry components.
import { CodeDiff, type DiffLine } from "../../../shared/assistant-ui/elements/code-diff.js";
import { useState } from "react";
import type { StandardProjectState } from "../../../../../shared/contracts/index.js";
import type { ConversationApproval } from "../../../../../shared/contracts/workspace/conversation-coding.js";
import { useTranslation } from "react-i18next";
import { Button } from "../../../shared/ui/button.js";
import type { useConversationCoding } from "../hooks/use-conversation-coding.js";
import { ApprovalCard } from "../../../shared/assistant-ui/elements/approval-card.js";
import { OptionList } from "../../../shared/assistant-ui/elements/option-list.js";
import { ElicitationForm } from "../../../shared/assistant-ui/elements/elicitation-form.js";

type Coding = ReturnType<typeof useConversationCoding>;
function PluginDialog({ prompt, coding, disabled }: { prompt: ConversationApproval; coding: Coding; disabled: boolean }) {
  const [value, setValue] = useState(prompt.initialValue ?? "");
  const { i18n } = useTranslation();
  const zh = i18n.language.startsWith("zh");
  const answer = (value: string | boolean | null) => { if (!disabled) return coding.decide(prompt.id, prompt.runId, value); };
  const send = (value: string | boolean | null) => { void Promise.resolve(answer(value)).catch(() => {}); };
  const args = prompt.arguments ?? {};
  const edits = prompt.tool === "edit" && Array.isArray(args.edits) ? args.edits : [];
  const lines: DiffLine[] = edits.flatMap((edit: { oldText?: string; newText?: string }) => [
    ...(typeof edit.oldText === "string" ? edit.oldText.split("\n").map(text => ({ kind: "removed" as const, text })) : []),
    ...(typeof edit.newText === "string" ? edit.newText.split("\n").map(text => ({ kind: "added" as const, text })) : []),
  ]);
  return <fieldset disabled={disabled} className="my-2 min-w-0 rounded-lg border bg-background p-3">
    {lines.length > 0 && <CodeDiff filename={String(args.path ?? "修改片段")} lines={lines} additions={lines.filter(line => line.kind === "added").length}
      deletions={lines.filter(line => line.kind === "removed").length} cycle={0} animate={false} className="mb-2 max-w-none" />}
    {typeof args.command === "string" && <pre className="mb-2 max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs">{args.command}</pre>}
    {prompt.dialog === "select" ? <>
      <p className="mb-2 max-h-64 overflow-auto whitespace-pre-wrap break-words text-sm">{prompt.title}</p>
      <OptionList aria-label={prompt.title} options={(prompt.options ?? []).map((label, index) => ({ id: String(index), label }))}
        onConfirm={async ids => { const choice = prompt.options?.[Number(ids[0])]; if (choice !== undefined) await answer(choice); }} className="max-w-none" />
      <Button variant="ghost" size="sm" onClick={() => send(null)}>{zh ? "取消" : "Cancel"}</Button>
    </> : prompt.dialog === "input" ? <ElicitationForm server="Pi" message={prompt.title} state="request"
      fields={[{ name: "answer", label: prompt.placeholder || (zh ? "回答" : "Answer"), value, kind: "text", multiline: prompt.multiline }]}
      onFieldChange={(_name, text) => setValue(text)} onAccept={() => send(value)} onDecline={() => send(null)} className="max-w-none" />
      : <ApprovalCard state="request" title={prompt.title} subtitle={zh ? "等待确认" : "Awaiting confirmation"} description={prompt.detail} allowOnceLabel={zh ? "确认" : "Confirm"} denyLabel={zh ? "取消" : "Cancel"}
        onAllowOnce={() => send(true)} onDeny={() => send(false)} className="max-w-none" />}
  </fieldset>;
}
export function ConversationCoding({ coding, state, canEdit, canCancel, onCancel }: {
  coding: Coding; state: StandardProjectState; canEdit: boolean; canCancel: boolean; onCancel: () => Promise<unknown>;
}) {
  const { i18n } = useTranslation();
  const zh = i18n.language.startsWith("zh");
  const text = (chinese: string, english: string) => zh ? chinese : english;
  if (!coding.available) return null;
  const prompts = coding.status.approvals.filter(item => item.runId === state.run?.id && state.run.status === "running");
  const notices = coding.status.notices?.filter(notice => notice.level !== "info") ?? [];
  // Directory management belongs to project creation/settings; chat only hosts live interactions.
  if (!coding.error && notices.length === 0 && prompts.length === 0) return null;
  return <section aria-label={text("会话编码", "Conversation coding")} className="mx-auto w-full max-w-3xl shrink-0 border-b px-4 py-2 text-sm">
    {coding.error && <p role="alert" className="mt-1 text-destructive">{coding.error}</p>}
    {notices.map(notice => <p key={notice.id} role="alert" className="mt-1 text-xs text-destructive">{notice.message}</p>)}
    {prompts.length > 0 && <div className="max-h-[45vh] overflow-y-auto" aria-live="polite">
      {prompts.map(prompt => <PluginDialog key={prompt.id} prompt={prompt} coding={coding} disabled={!canEdit || coding.pending || !coding.connected} />)}
      <Button variant="ghost" size="sm" disabled={!canCancel} onClick={() => { if (canCancel) void onCancel(); }}>{text("停止本轮任务", "Stop this turn")}</Button>
    </div>}
  </section>;
}
