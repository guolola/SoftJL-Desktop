// Exercises inline plugin dialogs with the actual thread, localized controls and native answer contracts.
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createStandardProjectState } from "../../../../../shared/contracts/index.js";
import type { ConversationApproval } from "../../../../../shared/contracts/workspace/conversation-coding.js";
import { i18n } from "../../../shared/i18n/index.js";
import { patchUserSettings } from "../../../shared/lib/user-settings.js";
import { useConversationCoding } from "../hooks/use-conversation-coding.js";
import { standardApi } from "../services/standard-api.js";
import { ProjectConversation } from "./project-conversation.js";

vi.mock("../hooks/use-conversation-coding.js", async importOriginal => ({
  ...await importOriginal<typeof import("../hooks/use-conversation-coding.js")>(), useConversationCoding: vi.fn(),
}));
vi.mock("../services/standard-api.js", () => ({ standardApi: { modelContext: vi.fn() } }));

beforeEach(async () => {
  localStorage.clear(); vi.clearAllMocks(); await i18n.changeLanguage("zh-CN");
  patchUserSettings({ providerConfigId: "provider", defaultModel: "model", providerModelOptions: ["model"] });
  vi.mocked(standardApi.modelContext).mockResolvedValue({ model: "model", contextBudget: 64000,
    capacity: { context: 64000, output: 8000, source: "modelpedia", matchedId: "origin/model", updatedAt: null } });
});
afterEach(() => { cleanup(); localStorage.clear(); });

function fixture(prompt: Partial<ConversationApproval> = {}) {
  const approval: ConversationApproval = { id: "prompt", runId: "run", toolCallId: "ask", tool: "ask_user_question", dialog: "select",
    title: "[读者] 谁使用系统？", directory: "", detail: "", options: ["1. 学生 — 借阅", "2. 教师 — 管理", "3. Type something."],
    arguments: { questions: [{ header: "读者", question: "谁使用系统？", options: [{ label: "学生", description: "借阅" }, { label: "教师", description: "管理" }] }] }, ...prompt };
  const coding: ReturnType<typeof useConversationCoding> = { available: true, status: { directory: null, approvals: [approval], busy: true },
    connected: true, error: "", pending: false, decide: vi.fn(async () => {}), selectDirectory: vi.fn(async () => {}) };
  vi.mocked(useConversationCoding).mockReturnValue(coding);
  const state = createStandardProjectState();
  state.run = { id: "run", operation: "chat", status: "running", startedAt: "now" };
  state.conversation = [{ id: "u", role: "user", text: "做一个图书系统", status: "completed", createdAt: "now" },
    { id: "a", role: "assistant", text: "先确认几个问题。", status: "completed", createdAt: "now", tools: [
      { id: "ask", name: approval.tool, arguments: approval.arguments, status: "running" },
    ] }];
  return { projectId: "p", state, disabled: false, canEdit: true, canCancel: true, coding, approval,
    onSend: vi.fn(async () => true), onCancel: vi.fn(async () => {}), onFeedback: vi.fn(async () => {}) };
}

it("places QuestionFlow after its user turn inside the viewport and sends the exact native option", async () => {
  const p = fixture(); const mounted = render(<ProjectConversation {...p} />);
  const flow = mounted.container.querySelector('[data-slot="question-flow"]')!;
  expect(flow.closest("fieldset")).toHaveClass("border-0", "p-0");
  expect(flow.closest("fieldset")).not.toHaveClass("rounded-lg", "bg-background");
  const viewport = screen.getByTestId("conversation-message-viewport");
  expect(viewport).toContainElement(flow as HTMLElement);
  expect(screen.getByText("做一个图书系统").compareDocumentPosition(flow) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.queryByRole("region", { name: "会话编码" })).not.toBeInTheDocument();
  expect(screen.queryByText("等待审批")).not.toBeInTheDocument();
  expect(screen.getAllByText("等待回答").length).toBeGreaterThan(0);
  expect(screen.queryByText(/Type something/)).not.toBeInTheDocument();
  fireEvent.click(within(flow as HTMLElement).getByRole("button", { name: /学生/ }));
  await waitFor(() => expect(p.coding.decide).toHaveBeenCalledWith("prompt", "run", "1. 学生 — 借阅"));
});

it("keeps custom-answer followups inline and resets the form for the next native prompt", async () => {
  const p = fixture(); const mounted = render(<ProjectConversation {...p} />);
  fireEvent.click(screen.getByRole("button", { name: "输入其他答案" }));
  await waitFor(() => expect(p.coding.decide).toHaveBeenCalledWith("prompt", "run", "3. Type something."));
  p.coding.status.approvals = [{ ...p.approval, id: "custom", dialog: "input", title: "[读者] 谁使用系统？\n\nType your answer:" }];
  mounted.rerender(<ProjectConversation {...p} />);
  expect(screen.getByText(/请输入你的答案/)).toBeInTheDocument();
  expect(screen.getByText("等待输入")).toBeInTheDocument();
  fireEvent.change(screen.getByRole("textbox", { name: "回答" }), { target: { value: "社会读者" } });
  fireEvent.click(screen.getByRole("button", { name: "提交" }));
  await waitFor(() => expect(p.coding.decide).toHaveBeenCalledWith("custom", "run", "社会读者"));
});

it("adapts multi-select and custom text to the plugin's numbered input protocol", async () => {
  const p = fixture({ dialog: "input", arguments: { questions: [{ header: "读者", question: "谁使用系统？", multiSelect: true,
    options: [{ label: "学生", description: "借阅" }, { label: "教师", description: "管理" }] }] } });
  render(<ProjectConversation {...p} />);
  fireEvent.click(screen.getByRole("checkbox", { name: /学生/ }));
  fireEvent.click(screen.getByRole("checkbox", { name: /教师/ }));
  fireEvent.click(screen.getByRole("checkbox", { name: "补充自定义答案" }));
  fireEvent.click(screen.getByRole("button", { name: "提交回答" }));
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("请填写补充答案"));
  expect(p.coding.decide).not.toHaveBeenCalled();
  fireEvent.change(screen.getByRole("textbox", { name: /补充答案/ }), { target: { value: "校友; 访客" } });
  fireEvent.click(screen.getByRole("button", { name: "提交回答" }));
  await waitFor(() => expect(p.coding.decide).toHaveBeenCalledWith("prompt", "run", "1,2; 校友; 访客"));
});

it("localizes permission cards and denial followups while preserving paths and session-grant values", async () => {
  const path = "E:\\project\\requirements.md";
  const p = fixture({ tool: "read", title: `Permission Required\nskill : uml-graduation-modeling\nread path : ${path}`,
    options: ["Yes", "Yes, for this session", "No", "No, provide reason"] });
  const mounted = render(<ProjectConversation {...p} />);
  const card = mounted.container.querySelector('[data-slot="approval-card"]')!;
  expect(screen.getByTestId("conversation-message-viewport")).toContainElement(card as HTMLElement);
  expect(card).toHaveTextContent("需要授权"); expect(card).toHaveTextContent("技能：uml-graduation-modeling");
  expect(card).toHaveTextContent(`读取路径：${path}`);
  expect(screen.queryByText(/Permission Required/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "本会话允许" }));
  await waitFor(() => expect(p.coding.decide).toHaveBeenCalledWith("prompt", "run", "Yes, for this session"));
  fireEvent.click(screen.getByRole("button", { name: "拒绝并说明原因" }));
  await waitFor(() => expect(p.coding.decide).toHaveBeenCalledWith("prompt", "run", "No, provide reason"));
  p.coding.status.approvals = [{ ...p.approval, id: "reason", dialog: "input",
    title: "Permission Required\nShare why this request was denied (optional).", placeholder: "Reason shown back to the agent" }];
  mounted.rerender(<ProjectConversation {...p} />);
  expect(screen.getByText(/请说明拒绝原因/)).toBeInTheDocument();
  fireEvent.change(screen.getByRole("textbox", { name: "向助手说明拒绝原因" }), { target: { value: "不要读取此文件" } });
  fireEvent.click(screen.getByRole("button", { name: "提交" }));
  await waitFor(() => expect(p.coding.decide).toHaveBeenCalledWith("reason", "run", "不要读取此文件"));
});

it.each(["readonly", "disconnected", "pending"])("guards inline answers while %s", mode => {
  const p = fixture();
  if (mode === "readonly") p.canEdit = false;
  if (mode === "disconnected") p.coding.connected = false;
  if (mode === "pending") p.coding.pending = true;
  const mounted = render(<ProjectConversation {...p} />);
  const answer = screen.getByRole("button", { name: /学生/ });
  expect(answer).toBeDisabled(); fireEvent.click(answer); expect(p.coding.decide).not.toHaveBeenCalled();
  expect(screen.getByRole("status")).toBeInTheDocument();
  p.state.run!.status = "stopped"; mounted.rerender(<ProjectConversation {...p} />);
  expect(screen.queryByRole("button", { name: /学生/ })).not.toBeInTheDocument();
});

it("keeps failed submissions answerable and restores a receipt from persisted plugin output", async () => {
  const p = fixture(); p.coding.decide = vi.fn().mockRejectedValueOnce(new Error("回答未送达"));
  const mounted = render(<ProjectConversation {...p} />);
  fireEvent.click(screen.getByRole("button", { name: /学生/ }));
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("回答未送达"));
  expect(mounted.container.querySelector('[data-slot="question-flow"]')).toHaveAttribute("data-state", "open");
  p.coding.status.approvals = []; p.state.run!.status = "completed";
  p.state.conversation = p.state.conversation!.map(message => message.role === "assistant" ? { ...message, tools: message.tools!.map(tool => ({
    ...tool, status: "completed", data: { answers: [{ questionIndex: 0, question: "谁使用系统？", kind: "custom", answer: "社会读者" }], cancelled: false },
  })) } : message);
  mounted.unmount();
  const reopened = render(<ProjectConversation {...p} />);
  expect(reopened.container.querySelector('[data-slot="question-flow"][data-state="receipt"]')).toHaveTextContent("社会读者");
});

it("uses English dialog chrome in English without translating authored choices", async () => {
  await i18n.changeLanguage("en");
  const p = fixture({ options: ["Yes", "No", "3. Type something."] });
  // With no structured metadata the generic choices remain authored text.
  p.approval.arguments = undefined;
  const mounted = render(<ProjectConversation {...p} />);
  expect(screen.getByRole("button", { name: "Yes" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "3. Type something." })).toBeInTheDocument();
  expect(mounted.container.querySelector('[data-slot="question-flow"]')).toBeInTheDocument();
});
