// Adapts Pi's sequential select/input dialogs and persisted answers to the registry QuestionFlow.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import type { ConversationApproval } from "../../../../../shared/contracts/workspace/conversation-coding.js";
import { QuestionFlow, type QuestionFlowStep } from "../../../shared/assistant-ui/elements/question-flow.js";
import { pluginDialogText, pluginQuestion, pluginQuestions } from "../lib/conversation-dialog-presentation.js";

export function PluginQuestionFlow({ prompt, disabled, answer }: {
  prompt: ConversationApproval; disabled: boolean; answer: (value: string) => Promise<void>;
}) {
  const { i18n } = useTranslation();
  const zh = i18n.resolvedLanguage?.startsWith("zh");
  const [custom, setCustom] = useState("");
  const question = pluginQuestion(prompt);
  const multiple = question?.multiSelect && prompt.dialog === "input";
  const prefix = question ? `${question.header ? `[${question.header}] ` : ""}${question.question}` : "";
  const preview = question && !multiple ? prompt.title.slice(prefix.length).trim() : "";
  const options = multiple
    ? [...question.options.map((option, index) => ({ id: String(index), label: option.label, description: option.description })),
      { id: "custom", label: zh ? "补充自定义答案" : "Add a custom answer" }]
    : (prompt.options ?? []).map((option, index) => ({ id: String(index),
      // Keep model-authored labels intact; only the plugin's appended freeform row is UI copy.
      label: question?.options[index]?.label ?? (question && index === question.options.length
        ? (zh ? "输入其他答案" : "Type something.") : pluginDialogText(option, !!zh)),
      description: question?.options[index]?.description,
    }));
  return <>
    <QuestionFlow steps={[{ id: prompt.id, question: question?.question ?? pluginDialogText(prompt.title, !!zh),
      description: [question?.header, preview].filter(Boolean).join("\n\n") || undefined,
      options, selectionMode: multiple ? "multiple" : "single", minSelections: multiple ? 0 : 1,
    }]} completeLabel={zh ? "提交回答" : "Submit answers"} className="max-w-none"
      onComplete={async answers => {
        if (disabled) throw new Error(zh ? "当前无法提交回答。" : "Answers are currently unavailable.");
        const ids = answers[prompt.id] ?? [];
        if (multiple) {
          if (ids.includes("custom") && !custom.trim()) throw new Error(zh ? "请填写补充答案。" : "Enter your custom answer.");
          // The native plugin parses numbered selections and optional text after a semicolon.
          await answer(ids.filter(id => id !== "custom").map(id => Number(id) + 1).join(",") + (ids.includes("custom") ? `; ${custom}` : ""));
        } else {
          const choice = prompt.options?.[Number(ids[0])];
          if (choice === undefined) throw new Error(zh ? "请选择有效选项。" : "Choose a valid option.");
          await answer(choice);
        }
      }} />
    {multiple && <label className="mt-2 flex flex-col gap-1 text-xs">{zh ? "补充答案（选择上方自定义答案选项后提交）" : "Custom answer (select the custom option above to submit)"}
      <textarea value={custom} onChange={event => setCustom(event.target.value)} className="rounded-md border bg-background p-2" /></label>}
  </>;
}

const resultSchema = z.object({ cancelled: z.literal(false), answers: z.array(z.object({
  questionIndex: z.number().int().nonnegative(), question: z.string(), kind: z.enum(["option", "custom", "multi"]),
  answer: z.string().nullable(), selected: z.array(z.string()).optional(),
})) });

export function PluginQuestionReceipt({ args, data }: { args: unknown; data: unknown }) {
  const result = resultSchema.safeParse(data);
  const questions = pluginQuestions(args);
  if (!result.success || !questions) return null;
  const steps: QuestionFlowStep[] = [];
  const choice: Record<string, string[]> = {};
  for (const answer of result.data.answers) {
    const question = questions[answer.questionIndex];
    if (!question || question.question !== answer.question) continue;
    const id = String(answer.questionIndex);
    const options = question.options.map((option, index) => ({ id: String(index), label: option.label }));
    const labels = answer.kind === "option" ? [answer.answer] : answer.kind === "multi" ? answer.selected ?? [] : [];
    if (labels.some(label => !options.some(option => option.label === label))) continue;
    const ids = options.filter(option => labels.includes(option.label)).map(option => option.id);
    if (answer.kind !== "option" && answer.answer !== null) {
      options.push({ id: "custom", label: answer.answer });
      ids.push("custom");
    }
    // Only recorded answers become receipts; unmatched output cannot imply a selection.
    if (!ids.length) continue;
    steps.push({ id, question: question.question, options });
    choice[id] = ids;
  }
  return steps.length ? <QuestionFlow steps={steps} choice={choice} className="max-w-none" /> : null;
}
