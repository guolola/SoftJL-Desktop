// Renders Pi's native dialog protocol with official assistant-ui registry components.
import { CodeDiff, type DiffLine } from "../../../shared/assistant-ui/elements/code-diff.js";
import { createContext, useContext, useState, type ReactNode } from "react";
import type { StandardProjectState } from "../../../../../shared/contracts/index.js";
import type { ConversationApproval } from "../../../../../shared/contracts/workspace/conversation-coding.js";
import { useTranslation } from "react-i18next";
import { Button } from "../../../shared/ui/button.js";
import type { useConversationCoding } from "../hooks/use-conversation-coding.js";
import { ApprovalCard } from "../../../shared/assistant-ui/elements/approval-card.js";
import { OptionList } from "../../../shared/assistant-ui/elements/option-list.js";
import { ElicitationForm } from "../../../shared/assistant-ui/elements/elicitation-form.js";
import { isPermissionDialog, pluginDialogText, pluginQuestion } from "../lib/conversation-dialog-presentation.js";
import { PluginQuestionFlow, PluginQuestionReceipt } from "./plugin-question-flow.js";

type Coding = ReturnType<typeof useConversationCoding>;
type DialogEnvironment = { coding: Coding; state: StandardProjectState; canEdit: boolean; canCancel: boolean; onCancel: () => Promise<unknown> };
const DialogContext = createContext<DialogEnvironment | null>(null);
export function ConversationDialogProvider({ children, ...value }: DialogEnvironment & { children: ReactNode }) {
  return <DialogContext.Provider value={value}>{children}</DialogContext.Provider>;
}

// Tool-owned dialogs stay outside the collapsible trace, under the message that requested them.
export function ConversationMessageDialogs({ messageId }: { messageId: string }) {
  const env = useContext(DialogContext);
  if (!env) return null;
  const history = env.state.conversation ?? [];
  const receipts = history.find(message => message.id === messageId)?.tools?.filter(tool => tool.name === "ask_user_question" && tool.status === "completed") ?? [];
  const activePrompts = env.coding.available && env.state.run?.status === "running" ? env.coding.status.approvals : [];
  const prompts = activePrompts.filter(prompt => {
    // A poll can precede the tool snapshot. Keep its dialog visible on the latest assistant until its owner arrives.
    const owner = history.find(message => message.role === "assistant" && message.tools?.some(tool => tool.id === prompt.toolCallId))
      ?? history.filter(message => message.role === "assistant").at(-1);
    return prompt.runId === env.state.run?.id && owner?.id === messageId;
  });
  return <>{receipts.map(tool => <PluginQuestionReceipt key={tool.id} args={tool.arguments} data={tool.data} />)}
    {prompts.length > 0 && <div aria-live="polite">{prompts.map(prompt => <PluginDialog key={prompt.id} prompt={prompt} coding={env.coding}
      disabled={!env.canEdit || env.coding.pending || !env.coding.connected} onCancel={() => { if (env.canCancel) void env.onCancel(); }} />)}</div>}
  </>;
}

function PluginDialog({ prompt, coding, disabled, onCancel }: { prompt: ConversationApproval; coding: Coding; disabled: boolean; onCancel: () => void }) {
  const [value, setValue] = useState(prompt.initialValue ?? "");
  const { i18n } = useTranslation();
  const zh = i18n.language.startsWith("zh");
  const permission = isPermissionDialog(prompt);
  const localize = (text: string) => pluginDialogText(text, zh, permission);
  const question = pluginQuestion(prompt);
  const answer = async (value: string | boolean | null) => {
    if (disabled) throw new Error(zh ? "当前无法提交回答。" : "Answers are currently unavailable.");
    await coding.decide(prompt.id, prompt.runId, value);
  };
  const args = prompt.arguments ?? {};
  const edits = prompt.tool === "edit" && Array.isArray(args.edits) ? args.edits : [];
  const lines: DiffLine[] = edits.flatMap((edit: { oldText?: string; newText?: string }) => [
    ...(typeof edit.oldText === "string" ? edit.oldText.split("\n").map(text => ({ kind: "removed" as const, text })) : []),
    ...(typeof edit.newText === "string" ? edit.newText.split("\n").map(text => ({ kind: "added" as const, text })) : []),
  ]);
  const [sendError, setSendError] = useState("");
  const submit = (value: string | boolean | null) => {
    setSendError("");
    void Promise.resolve(answer(value)).catch(error => setSendError(error instanceof Error ? error.message : String(error)));
  };
  return <fieldset disabled={disabled} aria-label={permission ? (zh ? "权限确认" : "Permission request") : localize(prompt.title)} className={`my-2 min-w-0 ${prompt.tool === "ask_user_question" && !permission ? "border-0 p-0" : "rounded-lg border bg-background p-3"}`}>
    {disabled && <p role="status" className="mb-2 text-xs text-muted-foreground">{!coding.connected ? (zh ? "连接中断，恢复后可继续回答。" : "Disconnected. Reconnect to answer.") : coding.pending ? (zh ? "正在提交，请稍候…" : "Submitting…") : (zh ? "当前会话为只读，无法回答。" : "This conversation is read-only.")}</p>}
    {sendError && <p role="alert" className="mb-2 text-destructive">{sendError}</p>}
    {lines.length > 0 && <CodeDiff filename={String(args.path ?? "修改片段")} lines={lines} additions={lines.filter(line => line.kind === "added").length}
      deletions={lines.filter(line => line.kind === "removed").length} cycle={0} animate={false} className="mb-2 max-w-none" />}
    {typeof args.command === "string" && <pre className="mb-2 max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs">{args.command}</pre>}
    {prompt.dialog === "directory" ? <ElicitationForm server={zh ? "代码生成" : "Code generation"} state="request"
      message={zh ? "生成代码前请选择保存文件夹。选择后会自动继续本次请求，无需重新发送消息。取消文件夹选择后仍可在这里重试。" : "Choose a folder before generating code. Your current request will continue automatically after selection. If you cancel the picker, you can try again here."}
      fields={[{ name: "directory", label: zh ? "保存位置" : "Save location", value: zh ? "尚未选择" : "Not selected", kind: "text" }]}
      acceptLabel={zh ? "选择文件夹并继续" : "Choose folder and continue"} declineLabel={zh ? "取消生成" : "Cancel generation"}
      onAccept={() => { if (!disabled) void coding.selectDirectory(prompt.id, prompt.runId).catch(() => {}); }}
      onDecline={() => { if (!disabled) onCancel(); }} className="max-w-none" /> : prompt.tool === "ask_user_question" && !permission && (prompt.dialog === "select" || (prompt.dialog === "input" && question?.multiSelect)) ? <>
      <PluginQuestionFlow prompt={prompt} disabled={disabled} answer={answer} />
      <Button variant="ghost" size="sm" onClick={() => submit(null)}>{zh ? "取消" : "Cancel"}</Button>
    </> : prompt.dialog === "select" && permission ? <>
      <ApprovalCard state="request" title={localize(prompt.title.split("\n")[0]!)} subtitle={zh ? "等待授权" : "Waiting for approval"}
        description={localize(prompt.title.split("\n").slice(1).join("\n"))}
        className="max-w-none whitespace-pre-wrap break-words"
        {...(prompt.options?.includes("Yes") ? { onAllowOnce: () => submit("Yes") } : {})}
        {...(prompt.options?.includes("Yes, for this session") ? { onAlwaysAllow: () => submit("Yes, for this session") } : {})}
        {...(prompt.options?.includes("No") ? { onDeny: () => submit("No") } : {})}
        allowOnceLabel={zh ? "仅本次允许" : "Allow once"} alwaysAllowLabel={zh ? "本会话允许" : "Allow for this session"} denyLabel={zh ? "拒绝" : "Deny"} />
      <OptionList aria-label={zh ? "其他授权选项" : "Other permission options"}
        options={(prompt.options ?? []).flatMap((label, index) => ["Yes", "Yes, for this session", "No"].includes(label) ? [] : [{ id: String(index), label: localize(label) }])}
        onConfirm={async ids => { const choice = prompt.options?.[Number(ids[0])]; if (choice !== undefined) await answer(choice); }} className="max-w-none" />
      <Button variant="ghost" size="sm" onClick={() => submit(null)}>{zh ? "取消" : "Cancel"}</Button>
    </> : prompt.dialog === "select" ? <>
      <p className="mb-2 max-h-64 overflow-auto whitespace-pre-wrap break-words text-sm">{localize(prompt.title)}</p>
      <OptionList aria-label={localize(prompt.title)} options={(prompt.options ?? []).map((label, index) => ({ id: String(index), label: localize(label) }))}
        onConfirm={async ids => { const choice = prompt.options?.[Number(ids[0])]; if (choice !== undefined) await answer(choice); }} className="max-w-none" />
      <Button variant="ghost" size="sm" onClick={() => submit(null)}>{zh ? "取消" : "Cancel"}</Button>
    </> : prompt.dialog === "input" ? <ElicitationForm server={permission ? (zh ? "权限确认" : "Permission request") : (zh ? "补充回答" : "Additional answer")} message={localize(prompt.title)} state="request"
      fields={[{ name: "answer", label: localize(prompt.placeholder || (zh ? "回答" : "Answer")), value, kind: "text", multiline: prompt.multiline }]}
      acceptLabel={zh ? "提交" : "Submit"} declineLabel={zh ? "取消" : "Cancel"}
      onFieldChange={(_name, text) => setValue(text)} onAccept={() => submit(value)} onDecline={() => submit(null)} className="max-w-none" />
      : <ApprovalCard state="request" title={localize(prompt.title)} subtitle={zh ? "等待确认" : "Awaiting confirmation"} description={localize(prompt.detail)} allowOnceLabel={zh ? "确认" : "Confirm"} denyLabel={zh ? "取消" : "Cancel"}
        onAllowOnce={() => submit(true)} onDeny={() => submit(false)} className="max-w-none" />}
  </fieldset>;
}
export function ConversationCoding({ coding, state, canEdit, canCancel, onCancel, inlineTools = false }: {
  coding: Coding; state: StandardProjectState; canEdit: boolean; canCancel: boolean; onCancel: () => Promise<unknown>;
  inlineTools?: boolean;
}) {
  const { i18n } = useTranslation();
  const zh = i18n.language.startsWith("zh");
  const text = (chinese: string, english: string) => zh ? chinese : english;
  if (!coding.available) return null;
  const prompts = inlineTools ? [] : coding.status.approvals.filter(item => item.runId === state.run?.id && state.run.status === "running");
  const notices = coding.status.notices?.filter(notice => notice.level !== "info") ?? [];
  // Chat only asks for a workspace while a live code request is waiting for its first directory.
  if (!coding.error && notices.length === 0 && prompts.length === 0) return null;
  return <section aria-label={text("会话编码", "Conversation coding")} className="mx-auto w-full max-w-3xl shrink-0 border-b px-4 py-2 text-sm">
    {coding.error && <p role="alert" className="mt-1 text-destructive">{coding.error}</p>}
    {notices.map(notice => <p key={notice.id} role="alert" className="mt-1 text-xs text-destructive">{notice.message}</p>)}
    {prompts.length > 0 && <div className="max-h-[45vh] overflow-y-auto" aria-live="polite">
      {prompts.map(prompt => <PluginDialog key={prompt.id} prompt={prompt} coding={coding} disabled={!canEdit || coding.pending || !coding.connected} onCancel={() => { if (canCancel) void onCancel(); }} />)}
      <Button variant="ghost" size="sm" disabled={!canCancel} onClick={() => { if (canCancel) void onCancel(); }}>{text("停止本轮任务", "Stop this turn")}</Button>
    </div>}
  </section>;
}
