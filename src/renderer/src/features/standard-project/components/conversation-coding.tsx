// Adds directory selection, prerequisite advice and explicit reviews inside the existing modeling conversation.
import type { StandardProjectState } from "../../../../../shared/contracts/index.js";
import { useTranslation } from "react-i18next";
import { codingArtifactAdvice } from "../../../../../shared/contracts/workspace/conversation-coding.js";
import { Button } from "../../../shared/ui/button.js";
import type { useConversationCoding } from "../hooks/use-conversation-coding.js";
import { ApprovalCard } from "../../../shared/assistant-ui/elements/approval-card.js";
import { CodeDiff, type DiffLine } from "../../../shared/assistant-ui/elements/code-diff.js";

export function ConversationCoding({ coding, state, canEdit, disabled, canCancel, onCancel }: {
  coding: ReturnType<typeof useConversationCoding>; state: StandardProjectState; canEdit: boolean; disabled: boolean; canCancel: boolean; onCancel: () => Promise<unknown>;
}) {
  const { i18n } = useTranslation();
  const zh = i18n.language?.startsWith("zh") ?? true;
  const text = (chinese: string, english: string) => zh ? chinese : english;
  if (!coding.available) return null;
  const running = state.run?.status === "running" || coding.status.busy;
  const advice = codingArtifactAdvice(state, zh ? "zh-CN" : "en");
  const approvals = coding.status.approvals.filter(item => item.runId === state.run?.id && state.run.status === "running");
  const switchBlocked = !canEdit || disabled || running || coding.pending || !coding.connected;
  return <section aria-label={text("会话编码", "Conversation coding")} className="mx-auto w-full max-w-3xl shrink-0 border-b px-4 py-2 text-sm">
    <div className="flex flex-wrap items-center gap-2">
      <span className="min-w-0 flex-1 break-all">{text("代码目录：", "Code directory: ")}{coding.status.directory ?? text("尚未选择", "Not selected")}</span>
      <Button type="button" variant="outline" size="sm" disabled={switchBlocked} onClick={() => { if (!switchBlocked) void coding.choose(); }}>{coding.status.directory ? text("更换代码目录", "Change code directory") : text("选择代码目录", "Choose code directory")}</Button>
      {coding.status.directory && <Button type="button" variant="ghost" size="sm" disabled={switchBlocked} onClick={() => { if (!switchBlocked) void coding.clear(); }}>{text("取消目录授权", "Revoke directory access")}</Button>}
    </div>
    {coding.status.directory ? <p className="mt-1 text-xs text-muted-foreground">{text("直接在下方对话里提出编码需求。读写文件和运行命令都需要逐次确认；停止会保留已完成的修改。", "Ask for code in this conversation. File operations and commands require individual approval. Stopping keeps completed edits.")}{running ? text(" 更换目录前请先停止任务。", " Stop the current task before changing directories.") : ""}</p>
      : <p className="mt-1 text-xs text-muted-foreground">{text("选择本机项目目录后，可在当前建模会话中编码和运行测试。", "Choose a local project directory to code and run tests in this modeling conversation.")}</p>}
    {coding.status.directory && advice && <p role="note" className="mt-1 text-xs text-amber-700 dark:text-amber-400">{advice}</p>}
    {coding.error && <p role="alert" className="mt-1 text-destructive">{coding.error}</p>}
    {approvals.length > 0 && <div className="max-h-[40vh] overflow-y-auto" aria-live="polite">
      {approvals.map(approval => <article key={approval.id} aria-label={text("待审批操作", "Pending operation approval")} className="my-2 rounded-lg border bg-background p-3">
        {approval.changes && (() => {
          const lines: DiffLine[] = approval.changes.flatMap(change => [
            ...change.oldText.split("\n").filter((text, index, all) => text || all.length > 1).map(text => ({ kind: "removed" as const, text })),
            ...change.newText.split("\n").filter((text, index, all) => text || all.length > 1).map(text => ({ kind: "added" as const, text })),
          ]);
          return <CodeDiff filename={approval.path ?? text("项目文件", "Project file")} lines={lines} additions={lines.filter(line => line.kind === "added").length}
            deletions={lines.filter(line => line.kind === "removed").length} cycle={0} animate={false} className="mb-2 max-h-64 max-w-none overflow-auto" />;
        })()}
        <fieldset disabled={!canEdit || coding.pending || !coding.connected} className="min-w-0">
          <ApprovalCard state="request" title={text(`助手请求：${approval.title}`, `Assistant request: ${approval.tool}`)} subtitle={text("等待你的本次操作审批", "Waiting for your approval of this operation")}
            description={zh ? approval.warning : [approval.tool === "project_command" ? "This command runs with your Windows user privileges and can access files outside the directory or the network." : "", advice].filter(Boolean).join("\n")} command={approval.changes ? undefined : approval.detail}
            details={[{ label: text("工作目录", "Working directory"), value: approval.directory }, ...(approval.path ? [{ label: text("文件", "File"), value: approval.path }] : [])]}
            allowOnceLabel={approval.warning?.includes("当前缺少") ? text("仍然继续并允许本次操作", "Continue and allow this operation") : text("允许本次操作", "Allow this operation")} denyLabel={text("拒绝本次操作", "Deny this operation")}
            onAllowOnce={() => { if (canEdit && !coding.pending && coding.connected) void coding.decide(approval.id, approval.runId, true); }}
            onDeny={() => { if (canEdit && !coding.pending && coding.connected) void coding.decide(approval.id, approval.runId, false); }}
            className="max-w-none [&_p]:whitespace-pre-wrap [&_.font-mono]:max-h-48 [&_.font-mono]:overflow-auto [&_.font-mono]:whitespace-pre-wrap [&_.font-mono]:break-all" />
        </fieldset>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="ghost" disabled={!canCancel} onClick={() => { if (canCancel) void onCancel(); }}>{text("停止本轮任务", "Stop this turn")}</Button>
        </div>
      </article>)}
    </div>}
  </section>;
}
