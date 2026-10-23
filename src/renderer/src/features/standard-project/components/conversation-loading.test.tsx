// Checks the official Elements loader appears for an empty live turn and disappears when real content or a terminal state arrives.
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { I18nextProvider } from "react-i18next";
import { i18n } from "../../../shared/i18n/index.js";
import { createStandardProjectState, type StandardProjectState } from "../../../../../shared/contracts/index.js";
import { HomeDemoEnvironment } from "./home-demo/integration/environment.js";
import { ConversationLoading } from "./conversation-loading.js";

afterEach(cleanup);
const view = (state: StandardProjectState) => <I18nextProvider i18n={i18n}><HomeDemoEnvironment value={{ projectId: "p", model: "m", modelRevision: "r", state, disabled: false, providerRequired: false, onAnswer: async () => true }}><ConversationLoading /></HomeDemoEnvironment></I18nextProvider>;
it("fills only the gap before actual assistant text, reasoning or tools", () => {
  const state = createStandardProjectState(); state.run = { id: "run", operation: "chat", status: "running", startedAt: "now" };
  state.conversation = [{ id: "u", role: "user", text: "生成代码", createdAt: "now", status: "completed" }];
  const mounted = render(view(state)); expect(screen.getByRole("status")).toBeInTheDocument();
  mounted.rerender(view({ ...state, conversation: [...state.conversation, { id: "a", role: "assistant", text: "开始读取项目", createdAt: "now", status: "streaming" }] }));
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  for (const status of ["completed", "failed", "stopped"] as const) {
    mounted.rerender(view({ ...state, run: { ...state.run, status } })); expect(screen.queryByRole("status")).not.toBeInTheDocument();
  }
});
