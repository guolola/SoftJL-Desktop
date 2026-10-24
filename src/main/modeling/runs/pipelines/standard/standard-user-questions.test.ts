// Checks that only matched, completed native questionnaire answers become generation facts or scope.
import assert from "node:assert/strict";
import test from "node:test";
import { standardQuestionAnswers, standardQuestionScope } from "./standard-user-questions.js";

const input = { questions: [{ question: "需要哪些图？", options: [{ label: "用例图、设计类图" }, { label: "不生成" }] }] };
const result = { cancelled: false, answers: [{ questionIndex: 0, question: "需要哪些图？", kind: "option", answer: "用例图、设计类图" }] };

test("native scope uses the actual selected labels and retains explicit refusal", () => {
  assert.deepEqual(standardQuestionScope(input, result), ["usecase", "class"]);
  assert.deepEqual(standardQuestionScope(input, { ...result, answers: [{ ...result.answers[0], answer: "不生成" }] }), []);
  assert.deepEqual(standardQuestionScope(input, { ...result, answers: [{ ...result.answers[0], kind: "custom", answer: "只生成时序图" }] }), ["sequence"]);
});

test("cancelled, mismatched, duplicate, fabricated and incomplete answers cannot grant scope", () => {
  for (const invalid of [
    { ...result, cancelled: true },
    { ...result, answers: [{ ...result.answers[0], question: "旧问题" }] },
    { ...result, answers: [{ ...result.answers[0], answer: "总体架构图" }] },
    { ...result, answers: [{ ...result.answers[0], kind: "custom", answer: "看不懂" }] },
    { ...result, answers: [result.answers[0], result.answers[0]] },
    { ...result, answers: [] },
  ]) assert.equal(standardQuestionScope(input, invalid), undefined);
  assert.equal(standardQuestionScope({ questions: [...input.questions, { ...input.questions[0], question: "其他模型？" }] }, result), undefined);
});

test("business answers stay facts and a multi-choice refusal cannot authorize sibling models", () => {
  const business = { questions: [{ question: "谁借阅？", options: [{ label: "学生" }, { label: "教师" }] }] };
  const answer = { cancelled: false, answers: [{ questionIndex: 0, question: "谁借阅？", kind: "multi", answer: "最多五本", selected: ["学生"] }] };
  assert.equal(standardQuestionScope(business, answer), undefined);
  assert.equal(standardQuestionAnswers(business, answer)[0]?.answer, "学生、最多五本");
  assert.equal(standardQuestionScope(input, { cancelled: false, answers: [{ ...result.answers[0], kind: "multi", answer: null, selected: ["用例图、设计类图", "不生成"] }] }), undefined);
});
