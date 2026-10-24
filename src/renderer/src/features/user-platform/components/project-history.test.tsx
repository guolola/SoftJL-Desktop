// Keeps accepted project conversation outputs visible without engineering stages or retry controls.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { AppI18nProvider } from "../../../shared/i18n/i18n-provider.js";
import { ProjectHistory } from "./project-history.js";
import type { PlatformRunSummary } from "../services/platform-api.js";
const mocks = vi.hoisted(() => ({ getProjectRun: vi.fn(), listProjectRuns: vi.fn(), deleteProjectRun: vi.fn(), alert: vi.fn() }));
vi.mock("../services/platform-api", () => ({ platformApi: mocks }));
vi.mock("../../../shared/ui/floating-alert", () => ({ useFloatingAlert: () => ({ showAlert: mocks.alert }) }));
const run: PlatformRunSummary = { runId: "quick", operationType: "quick_modeling", status: "failed", startedAt: "2026-10-23T01:00:00Z" };
beforeEach(() => { vi.clearAllMocks(); mocks.listProjectRuns.mockResolvedValue({ runs: [run] }); mocks.deleteProjectRun.mockResolvedValue(undefined); });
it("shows only outputs accepted in this conversation command", async () => {
  mocks.getProjectRun.mockResolvedValue({ run, snapshot: { runId: "quick", operationType: "quick_modeling", outputManifest: [{ kind: "model", id: "own" }], currentStage: null, status: "failed", error: null,
    standardRun: { operation: "chat", model: "test", providerConfigId: "provider", baseline: {}, artifacts: [
      { id: "own", title: "本轮模型", type: "model", previewAvailable: false }, { id: "old", title: "历史模型", type: "model", previewAvailable: false },
    ] } } });
  render(<AppI18nProvider><ProjectHistory projectId="project" initialRuns={[run]} members={[]} /></AppI18nProvider>);
  expect(screen.getByText("快速建模")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /重试运行/ })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "查看运行记录 quick" }));
  expect(await screen.findByText("本轮模型")).toBeInTheDocument(); expect(screen.queryByText("历史模型")).not.toBeInTheDocument();
});
it("deletes completed history through the server without a local workspace store", async () => {
  render(<AppI18nProvider><ProjectHistory projectId="project" initialRuns={[run]} members={[]} /></AppI18nProvider>);
  await userEvent.click(screen.getByRole("button", { name: "删除运行记录 quick" }));
  expect(mocks.deleteProjectRun).toHaveBeenCalledWith("project", "quick");
});
