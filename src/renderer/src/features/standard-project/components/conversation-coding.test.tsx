// Verifies actual Elements reviews, prerequisite advice and action guards within the modeling conversation.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { i18n } from "../../../shared/i18n/index.js";
import { createStandardProjectState } from "../../../../../shared/contracts/index.js";
import { standardModelFixture } from "../../../../../shared/contracts/testing/index.js";
import { ConversationCoding } from "./conversation-coding.js";

afterEach(cleanup);
beforeEach(async () => { await i18n.changeLanguage("zh-CN"); });
function props() {
  return { state: createStandardProjectState(), canEdit: true, disabled: false, canCancel: true, onCancel: vi.fn(async () => {}),
    coding: { available: true, connected: true, status: { directory: "D:\\projects\\library", approvals: [], busy: false }, error: "", pending: false,
      choose: vi.fn(async () => {}), clear: vi.fn(async () => {}), decide: vi.fn(async () => {}) } } satisfies Parameters<typeof ConversationCoding>[0];
}
const approval = { id: "approval", runId: "run", toolCallId: "call", tool: "project_command", title: "运行命令或测试", directory: "D:\\projects\\library", detail: "npm test", warning: "当前缺少模型，建议先补齐" };

it("advises completing missing artifacts and keeps directory selection in the current conversation", () => {
  const p = props(); render(<ConversationCoding {...p} />);
  expect(screen.getByRole("note")).toHaveTextContent("缺少模型、测试用例、需求规格说明书、软件设计说明书");
  fireEvent.click(screen.getByRole("button", { name: "更换代码目录" })); expect(p.coding.choose).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("button", { name: "取消目录授权" })); expect(p.coding.clear).toHaveBeenCalledOnce();
});
it("lets the user approve, refuse or stop while the ordinary composer is busy and blocks directory changes", () => {
  const p: Parameters<typeof ConversationCoding>[0] = props();
  p.disabled = true; p.state.run = { id: "run", operation: "chat", status: "running", startedAt: "now" };
  p.coding.status = { directory: approval.directory, busy: true, approvals: [approval] };
  const { container } = render(<ConversationCoding {...p} />);
  expect(container.querySelector('[data-slot="approval-card"]')).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "更换代码目录" })).toBeDisabled();
  expect(screen.getByText("npm test")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "仍然继续并允许本次操作" })); expect(p.coding.decide).toHaveBeenCalledWith("approval", "run", true);
  fireEvent.click(screen.getByRole("button", { name: "拒绝本次操作" })); expect(p.coding.decide).toHaveBeenCalledWith("approval", "run", false);
  fireEvent.click(screen.getByRole("button", { name: "停止本轮任务" })); expect(p.onCancel).toHaveBeenCalledOnce();
  expect(screen.queryByText("Always allow")).not.toBeInTheDocument();
});
it("renders real file differences before approval and does not show stale run approvals", () => {
  const p: Parameters<typeof ConversationCoding>[0] = props();
  p.state.run = { id: "run", operation: "chat", status: "running", startedAt: "now" };
  p.coding.status.approvals = [{ ...approval, tool: "project_edit", title: "修改项目文件", path: "index.ts", changes: [{ oldText: "const limit = 4;", newText: "const limit = 5;" }] }];
  const { container, rerender } = render(<ConversationCoding {...p} />);
  expect(container.querySelector('[data-slot="code-diff"]')).toHaveTextContent("const limit = 4;");
  expect(screen.getByText("const limit = 5;")).toBeInTheDocument();
  expect(screen.getByText("const limit = 5;").parentElement).toHaveStyle({ animation: "none" });
  rerender(<ConversationCoding {...p} state={{ ...p.state, run: { ...p.state.run!, id: "new-run" } }} />);
  expect(screen.queryByLabelText("待审批操作")).not.toBeInTheDocument();
});
it("requires current edit access and an available connection for approval actions", () => {
  const p: Parameters<typeof ConversationCoding>[0] = props(); p.canEdit = false;
  p.state.run = { id: "run", operation: "chat", status: "running", startedAt: "now" }; p.coding.status.approvals = [approval];
  const { rerender } = render(<ConversationCoding {...p} />);
  fireEvent.click(screen.getByRole("button", { name: "拒绝本次操作" })); expect(p.coding.decide).not.toHaveBeenCalled();
  p.canEdit = true; p.coding.connected = false; p.coding.error = "服务连接已断开"; rerender(<ConversationCoding {...p} />);
  expect(screen.getByRole("alert")).toHaveTextContent("服务连接已断开");
  expect(screen.getByRole("button", { name: "仍然继续并允许本次操作" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "仍然继续并允许本次操作" })); expect(p.coding.decide).not.toHaveBeenCalled();
});
it("removes the prerequisite advice once saved models, test cases and both documents exist", () => {
  const p = props(); p.state.diagrams.class = { id: "class", kind: "class", title: "类图", status: "completed", model: standardModelFixture("class") };
  p.state.tests = [{ id: "t", businessId: "b", title: "测试", preconditions: [], steps: ["提交"], expected: "成功" }];
  p.state.documents = { requirementsSpec: { title: "需求", markdown: "需求正文", generatedAt: "now" }, softwareDesignSpec: { title: "设计", markdown: "设计正文", generatedAt: "now" } };
  render(<ConversationCoding {...p} />); expect(screen.queryByRole("note")).not.toBeInTheDocument();
});
it("shows no local coding controls without the native desktop capability", () => {
  const p = props(); render(<ConversationCoding {...p} coding={{ ...p.coding, available: false }} />);
  expect(screen.queryByRole("region", { name: "会话编码" })).not.toBeInTheDocument();
});
