// Projects real Pi questionnaire answers into generation facts and optional model scope.
import { z } from "zod";
import { standardDiagramKinds, type StandardDiagramKind } from "../../../../../shared/contracts/index.js";
import { resolveStandardGenerationSelection } from "./standard-generation-scope.js";

const questionsSchema = z.object({ questions: z.array(z.object({
  question: z.string(), options: z.array(z.object({ label: z.string() })),
})) });
const answersSchema = z.object({ cancelled: z.literal(false), answers: z.array(z.object({
  questionIndex: z.number().int().nonnegative(), question: z.string(), kind: z.enum(["option", "custom", "multi"]),
  answer: z.string().nullable(), selected: z.array(z.string()).optional(),
})) });

export function standardQuestionAnswers(input: unknown, details: unknown) {
  const questions = questionsSchema.safeParse(input), result = answersSchema.safeParse(details);
  if (!questions.success || !result.success) return [];
  if (new Set(result.data.answers.map(answer => answer.questionIndex)).size !== result.data.answers.length) return [];
  const seen = new Set<number>();
  return result.data.answers.flatMap(answer => {
    const question = questions.data.questions[answer.questionIndex];
    if (!question || question.question !== answer.question || seen.has(answer.questionIndex)) return [];
    seen.add(answer.questionIndex);
    const labels = answer.kind === "option" ? [answer.answer] : answer.kind === "multi" ? answer.selected ?? [] : [];
    if (labels.some(label => !question.options.some(option => option.label === label))) return [];
    const values = [...labels, ...(answer.kind !== "option" && answer.answer ? [answer.answer] : [])].filter((value): value is string => Boolean(value));
    return [{ question: question.question, options: question.options.map(option => option.label), values, answer: values.join("、") }];
  });
}

const declined = /^(?:不生成(?:任何)?(?:替代)?(?:模型|图表|图)?|暂不生成|取消|do not generate(?: an alternative)?|none|cancel)$/i;
const kindsFor = (value: string) => resolveStandardGenerationSelection(value, true);

export function standardQuestionScope(input: unknown, details: unknown): StandardDiagramKind[] | undefined {
  const answers = standardQuestionAnswers(input, details);
  const modelAnswers = answers.filter(answer => answer.options.some(option => kindsFor(option)?.length));
  if (!modelAnswers.length) return;
  const questions = questionsSchema.parse(input).questions;
  if (questions.filter(question => isStandardModelQuestion(question.options.map(option => option.label))).length !== modelAnswers.length) return;
  const kinds = new Set<StandardDiagramKind>();
  let refused = false;
  for (const answer of modelAnswers) {
    if (!answer.values.length) return;
    for (const value of answer.values) {
      if (declined.test(value.trim())) { refused = true; continue; }
      const selected = kindsFor(value);
      if (!selected?.length) return;
      selected.forEach(kind => kinds.add(kind));
    }
  }
  // Cancellation, unknown custom answers and contradictory selections never grant a scope.
  if (refused && kinds.size) return;
  return standardDiagramKinds.filter(kind => kinds.has(kind));
}

export function isStandardModelQuestion(options: string[]) {
  return options.some(option => kindsFor(option)?.length);
}

export function hasStandardModelQuestion(input: unknown) {
  const parsed = questionsSchema.safeParse(input);
  return parsed.success && parsed.data.questions.some(question => isStandardModelQuestion(question.options.map(option => option.label)));
}
