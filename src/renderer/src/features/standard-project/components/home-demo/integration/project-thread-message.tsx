// Uses the shared reasoning components for continuous Agent activity while preserving original message scopes.
import { MessagePrimitive, ThreadPrimitive, useAuiState } from "@assistant-ui/react";
import { useContext } from "react";
import { useTranslation } from "react-i18next";
import type { StandardConversationMessage } from "../../../../../../../shared/contracts/index.js";
import { assistantActivityGroup, assistantIntroductionIds, conversationDate, conversationDay } from "../../../lib/conversation-presentation.js";
import { AssistantMessage, UserMessage } from "../source/messages.js";
import { EditComposer } from "../source/composer.js";
import { DisclosureTrigger, disclosureContentClass } from "../source/trace.js";
import { Reasoning, ReasoningRoot, ReasoningContent, ReasoningText } from "../source/elements/reasoning.aui.js";
import { useHomeDemo } from "./environment.js";
import { questionRoundForMessage } from "../../../lib/conversation-question-flow.js";
import { DaySeparator } from "./elements/day-separator.js";
import { ProjectToolCall, ProjectToolTimeline, useToolPresentation } from "./project-tools.js";
import { ConversationCodingContext } from "../../../hooks/use-conversation-coding.js";
import { hasConversationArtifacts } from "../../../lib/conversation-artifacts.js";
import { ConversationMessageDialogs } from "../../conversation-coding.js";
import { isPermissionDialog } from "../../../lib/conversation-dialog-presentation.js";
import { MarkdownText } from "../source/elements/markdown-text.js";

const activityComponents = { Reasoning, tools: { Fallback: ProjectToolCall } };

function MessageActivity({ attention = false }: { attention?: boolean } = {}) {
  const parts = useAuiState(s => s.message.parts);
  const { present } = useToolPresentation();
  const indices = parts.flatMap((part, index) => part.type === "tool-call" && (present(part).failed || present(part).awaiting) === attention ? [index] : []);
  return <>
    {!attention && parts.map((part, index) => part.type === "reasoning" && part.text.trim()
      ? <MessagePrimitive.PartByIndex key={index} index={index} components={activityComponents} /> : null)}
    {!attention && indices.length > 1 ? <ProjectToolTimeline indices={indices} />
      : indices.map(index => <MessagePrimitive.PartByIndex key={index} index={index} components={activityComponents} />)}
  </>;
}

function MessageAttention() {
  const messageId = useAuiState(s => s.message.id);
  return <><MessageActivity attention /><ConversationMessageDialogs messageId={messageId} /></>;
}
function MessageAnswer() { return <AssistantMessage hideActivity />; }
function MessageResult() { return <AssistantMessage hideActivity hideText />; }
function MessageIntroduction() {
  const parts = useAuiState(s => s.message.parts);
  return <div data-role="assistant" data-slot="assistant-introduction" className="w-full text-[15px] leading-relaxed wrap-break-word">
    {parts.map((part, index) => part.type === "text" && part.text.trim()
      ? <MessagePrimitive.PartByIndex key={index} index={index} components={{ Text: MarkdownText }} /> : null)}
  </div>;
}

function ProjectAssistantRun({ messages }: { messages: readonly StandardConversationMessage[] }) {
  const { state } = useHomeDemo();
  const coding = useContext(ConversationCodingContext);
  const prompts = state.run?.status === "running" ? coding?.approvals.filter(item => item.runId === state.run?.id && messages.some(message => message.tools?.some(tool => tool.id === item.toolCallId))) ?? [] : [];
  const approval = prompts.some(isPermissionDialog);
  const answering = prompts.length > 0 && !approval;
  const { text } = useToolPresentation();
  const thread = useAuiState(s => s.thread.messages);
  const introductions = assistantIntroductionIds(messages);
  const latest = messages.at(-1)!;
  const round = state.rounds.at(-1);
  const waiting = !!round?.questions.length && !round.answers.length && latest.id === state.conversation?.at(-1)?.id;
  const executing = messages.some(message => message.tools?.some(tool => tool.status === "running"));
  // Use the current model call, not the previous activity entry, to label the next reasoning phase.
  const thinking = !executing && latest.status === "streaming";
  const failed = messages.some(message => message.status === "failed" || message.tools?.some(tool => tool.status === "failed"));
  const stopped = state.run?.status === "stopped" && latest.id === state.conversation?.at(-1)?.id;
  // Tool completion is only a boundary between model calls. Keep the disclosure
  // open until this user turn settles, including snapshots between those calls.
  const active = !approval && !answering && (thinking || executing || (!waiting && latest.id === state.conversation?.at(-1)?.id && state.run?.status === "running"));
  const hasActivity = messages.some(message => message.reasoning?.trim() || message.tools?.length || message.status === "streaming");
  const status = approval || answering ? "waiting" : executing ? "running" : thinking ? "thinking" : waiting ? "waiting" : stopped ? "stopped" : failed ? "failed" : "completed";
  const label = approval ? text("等待审批", "Waiting for approval") : answering ? text("等待回答", "Waiting for answers") : executing ? text("正在执行", "Running") : thinking ? text("正在推理", "Thinking")
    : waiting ? text("等待回答", "Waiting for answers") : stopped ? text("处理已停止", "Stopped")
      : failed ? text("处理失败或已中断", "Failed or interrupted") : text("推理过程", "Reasoning");
  // Each child retains its original message scope for tool status, question forms, feedback and regeneration.
  const renderMessage = (message: StandardConversationMessage, component: () => React.JSX.Element) => {
    const index = thread.findIndex(item => item.id === message.id);
    return index < 0 ? null : <ThreadPrimitive.MessageByIndex key={message.id} index={index}
      components={{ AssistantMessage: component, UserMessage, EditComposer }} />;
  };
  return <div data-slot="run-activity" data-status={status} className="mx-auto flex w-full min-w-0 max-w-(--thread-max-width) flex-col gap-3">
    {messages.filter(message => introductions.has(message.id)).map(message => renderMessage(message, MessageIntroduction))}
    {/* The shared root owns live expansion, manual folding and scroll locking for both single and merged reasoning. */}
    {hasActivity && <ReasoningRoot variant="ghost" streaming={active} className="my-1 mb-3">
      <DisclosureTrigger live={active} label={label} />
      <ReasoningContent aria-busy={active} className={disclosureContentClass}>
        <ReasoningText className="ps-0">
          <div className="flex min-w-0 flex-col gap-3">
            {messages.map(message => renderMessage(message, MessageActivity))}
          </div>
        </ReasoningText>
      </ReasoningContent>
    </ReasoningRoot>}
    {messages.map(message => renderMessage(message, MessageAttention))}
    {messages.map((message, index) => message.text.trim() || message.attachments?.length || hasConversationArtifacts(message) || questionRoundForMessage(state, message.id) || (waiting && index === messages.length - 1)
      // Keep generated files, forms, errors and message actions after execution;
      // only pre-execution text was moved above the shared reasoning container.
      ? renderMessage(message, introductions.has(message.id) ? MessageResult : MessageAnswer) : null)}
  </div>;
}

export function ProjectThreadMessage() {
  const { state } = useHomeDemo();
  const { i18n } = useTranslation();
  const id = useAuiState(s => s.message.id);
  const role = useAuiState(s => s.message.role);
  const history = state.conversation ?? [];
  const index = history.findIndex(message => message.id === id);
  const message = history[index];
  const group = assistantActivityGroup(history, index);
  if (group && group.start !== index) return null;
  const date = message && conversationDate(message.createdAt);
  const previousDay = history.slice(0, index).reverse().find(item => conversationDate(item.createdAt));
  const showDay = date && conversationDay(message!.createdAt) !== (previousDay && conversationDay(previousDay.createdAt));
  const locale = i18n.resolvedLanguage?.startsWith("zh") ? "zh-CN" : "en-US";
  const day = showDay ? new Intl.DateTimeFormat(locale, { year: "numeric", month: "long", day: "numeric" }).format(date) : undefined;
  return <DaySeparator day={day}>
    <div className="group/message relative">
      {group ? <ProjectAssistantRun messages={group.messages} /> : role === "user" ? <UserMessage /> : <AssistantMessage />}
      {date && <time dateTime={date.toISOString()} title={date.toLocaleString(locale)}
        className="text-muted-foreground pointer-events-none block text-end font-mono text-[11px] opacity-0 transition-opacity group-hover/message:opacity-100 group-focus-within/message:opacity-100">
        {new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", hour12: false }).format(date)}
      </time>}
    </div>
  </DaySeparator>;
}
