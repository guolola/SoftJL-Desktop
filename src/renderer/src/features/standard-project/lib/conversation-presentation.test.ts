// Checks calendar boundaries without fabricating missing conversation dates.
import { expect, it } from "vitest";
import type { StandardConversationMessage } from "../../../../../shared/contracts/index.js";
import { assistantActivityGroup, assistantIntroductionIds, conversationDate, conversationDay } from "./conversation-presentation.js";

it("uses real calendar dates and leaves missing or invalid legacy dates unknown", () => {
  expect(conversationDate("")).toBeUndefined();
  expect(conversationDate("now")).toBeUndefined();
  expect(conversationDay("2026-10-15T09:00:00")).toBe("2026-10-15");
});

it("groups one continuous Agent chain without changing persisted message ids", () => {
  const messages: StandardConversationMessage[] = [
    { id: "u", role: "user", text: "生成", status: "completed", createdAt: "now" },
    { id: "read", role: "assistant", text: "", reasoning: "读取资料", status: "completed", createdAt: "now" },
    { id: "generate", role: "assistant", text: "", tools: [{ id: "t", name: "generate_diagrams", status: "completed" }], status: "completed", createdAt: "now" },
    { id: "answer", role: "assistant", text: "已生成。", status: "completed", createdAt: "now" },
    { id: "next", role: "user", text: "修改", status: "completed", createdAt: "now" },
  ];
  expect(assistantActivityGroup(messages, 2)).toEqual({ start: 1, messages: messages.slice(1, 4) });
  expect(assistantActivityGroup(messages, 0)).toBeUndefined();
  expect(messages.map(message => message.id)).toEqual(["u", "read", "generate", "answer", "next"]);
  expect(assistantActivityGroup([messages[1]!, { ...messages[3]!, createdAt: "2026-10-18T00:00:00" }], 0)).toEqual({ start: 0, messages: [messages[1]!] });
  expect(assistantActivityGroup([messages[1]!], 0)).toEqual({ start: 0, messages: [messages[1]!] });
});

it("classifies introductions by tool boundaries without guessing from the wording", () => {
  const message = (id: string, text: string): StandardConversationMessage => ({ id, text, role: "assistant", status: "completed", createdAt: "now" });
  const request = { ...message("request", "已确认范围，开始生成。"), tools: [{ id: "generate", name: "generate_diagrams", status: "completed" as const }] };
  expect([...assistantIntroductionIds([message("before", "读取后再生成。"), request, message("answer", "完成。")])]).toEqual(["before", "request"]);
  expect([...assistantIntroductionIds([request])]).toEqual(["request"]);
  expect([...assistantIntroductionIds([message("plain", "我先解释这个概念。")])]).toEqual([]);
});
