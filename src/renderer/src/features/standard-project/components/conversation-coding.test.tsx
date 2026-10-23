// Verifies official Elements controls round-trip the plugin's choices and preserve action guards.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { i18n } from "../../../shared/i18n/index.js";
import { createStandardProjectState } from "../../../../../shared/contracts/index.js";
import { ConversationCoding } from "./conversation-coding.js";

afterEach(cleanup);
beforeEach(async () => { await i18n.changeLanguage("zh-CN"); });
function props(): Parameters<typeof ConversationCoding>[0] {
  return { state: { ...createStandardProjectState(), run: { id: "run", operation: "chat", status: "running", startedAt: "now" } }, canEdit: true, canCancel: true, onCancel: vi.fn(async () => {}),
    coding: { available: true, connected: true, status: { directory: "D:/project", approvals: [], busy: false }, error: "", pending: false,
      decide: vi.fn(async () => {}) } };
}
const prompt = { id: "approval", runId: "run", toolCallId: "call", tool: "pi_dialog", title: "Allow write?", directory: "D:/project", detail: "" };
it("uses OptionList and returns the original upstream choice, including session grants", async () => {
  const p = props();
  p.coding.status.approvals = [{ ...prompt, dialog: "select", options: ["Approve once", "Approve for session", "Deny with reason"] }];
  const { container } = render(<ConversationCoding {...p} />);
  expect(container.querySelector('[data-slot="option-list"]')).toBeInTheDocument();
  expect(screen.queryByText("D:/project")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "更换代码目录" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Approve for session" }));
  await waitFor(() => expect(p.coding.decide).toHaveBeenCalledWith("approval", "run", "Approve for session"));
  fireEvent.click(screen.getByRole("button", { name: "停止本轮任务" })); expect(p.onCancel).toHaveBeenCalledOnce();
});
it("keeps an unsuccessful choice open instead of displaying a false receipt", async () => {
  const p = props(); p.coding.decide = vi.fn().mockRejectedValue(new Error("回答未送达"));
  p.coding.status.approvals = [{ ...prompt, dialog: "select", options: ["Approve once"] }];
  render(<ConversationCoding {...p} />);
  fireEvent.click(screen.getByRole("button", { name: "Approve once" }));
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("回答未送达"));
  expect(screen.getByRole("button", { name: "Approve once" })).toBeInTheDocument();
});
it("uses ElicitationForm for free text and returns cancellation without authorizing", async () => {
  const p = props(); p.coding.status.approvals = [{ ...prompt, dialog: "input", placeholder: "详细说明" }];
  const { container, rerender } = render(<ConversationCoding {...p} />);
  expect(container.querySelector('[data-slot="elicitation-form"]')).toBeInTheDocument();
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "只修改测试" } });
  fireEvent.click(screen.getByRole("button", { name: /Send|Continue|Submit/ }));
  expect(p.coding.decide).toHaveBeenCalledWith("approval", "run", "只修改测试");
  p.coding.status.approvals = [{ ...prompt, id: "confirm", dialog: "confirm", detail: "执行测试" }];
  rerender(<ConversationCoding {...p} />);
  expect(container.querySelector('[data-slot="approval-card"]')).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "取消" }));
  expect(p.coding.decide).toHaveBeenCalledWith("confirm", "run", false);
});
it("previews native edit fragments and preserves editor prefill", () => {
  const p = props();
  p.coding.status.approvals = [{ ...prompt, tool: "edit", dialog: "select", options: ["Approve once"],
    arguments: { path: "limit.ts", edits: [{ oldText: "limit = 4", newText: "limit = 5" }] } }];
  const { container, rerender } = render(<ConversationCoding {...p} />);
  expect(container.querySelector('[data-slot="code-diff"]')).toBeInTheDocument();
  expect(screen.getByText("limit = 4")).toBeInTheDocument();
  expect(screen.getByText("limit = 5")).toBeInTheDocument();
  p.coding.status.approvals = [{ ...prompt, id: "editor", dialog: "input", initialValue: "existing\nanswer", multiline: true }];
  rerender(<ConversationCoding {...p} />);
  expect(screen.getByRole("textbox")).toHaveValue("existing\nanswer");
  fireEvent.click(screen.getByRole("button", { name: /Send/ }));
  expect(p.coding.decide).toHaveBeenCalledWith("editor", "run", "existing\nanswer");
});
it("ignores stale prompts and guards replies when edit access or connection is unavailable", () => {
  const p = props(); p.canEdit = false;
  p.coding.status.approvals = [{ ...prompt, dialog: "select", options: ["Approve once"] }];
  const { rerender } = render(<ConversationCoding {...p} />);
  expect(screen.getByRole("button", { name: "Approve once" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Approve once" })); expect(p.coding.decide).not.toHaveBeenCalled();
  p.canEdit = true; p.coding.connected = false; p.coding.error = "服务连接已断开"; rerender(<ConversationCoding {...p} />);
  expect(screen.getByRole("alert")).toHaveTextContent("服务连接已断开");
  expect(screen.getByRole("button", { name: "Approve once" })).toBeDisabled();
  p.state.run!.id = "next"; rerender(<ConversationCoding {...p} />);
  expect(screen.queryByRole("button", { name: "Approve once" })).not.toBeInTheDocument();
});
it("leaves chat free of directory management both with and without a code directory", () => {
  const p = props();
  const { container, rerender } = render(<ConversationCoding {...p} />);
  expect(container).toBeEmptyDOMElement();
  p.coding.status.directory = null;
  rerender(<ConversationCoding {...p} />);
  expect(container).toBeEmptyDOMElement();
  p.coding.status.approvals = [{ ...prompt, dialog: "input", title: "补充要求" }];
  rerender(<ConversationCoding {...p} />);
  expect(screen.getByRole("textbox")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /代码目录/ })).not.toBeInTheDocument();
});
it("hides desktop controls when the native capability is absent", () => {
  const p = props(); p.coding.available = false; render(<ConversationCoding {...p} />);
  expect(screen.queryByRole("region", { name: "会话编码" })).not.toBeInTheDocument();
});
