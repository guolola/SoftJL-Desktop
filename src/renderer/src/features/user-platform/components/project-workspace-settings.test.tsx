// Verifies project folder selection persists through the native grant and creation retries do not duplicate projects.
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { ProjectWorkspaceSettings } from "./project-workspace-settings.js";
import { ProjectCreateForm } from "./project-create-form.js";
import { platformApi } from "../services/platform-api.js";
import { i18n } from "../../../shared/i18n/i18n.js";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("shows the saved workspace and immediately displays native folder changes", async () => {
  const choose = vi.fn().mockResolvedValue("D:\\projects\\new");
  vi.stubGlobal("desktop", { chooseConversationDirectory: choose });
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ directory: "D:\\projects\\old", busy: false, approvals: [] })));
  render(<ProjectWorkspaceSettings projectId="p1" canManage active />);
  await waitFor(() => expect(screen.getByLabelText("项目工作区")).toHaveValue("D:\\projects\\old"));
  await userEvent.click(screen.getByRole("button", { name: "更换文件夹" }));
  await waitFor(() => expect(screen.getByLabelText("项目工作区")).toHaveValue("D:\\projects\\new"));
  expect(choose).toHaveBeenCalledWith("p1");
});

it("explains why an active coding task prevents folder changes", async () => {
  const choose = vi.fn(); vi.stubGlobal("desktop", { chooseConversationDirectory: choose });
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ directory: "D:\\projects\\code", busy: true, approvals: [] })));
  render(<ProjectWorkspaceSettings projectId="p1" canManage active />);
  expect(await screen.findByText("请先停止当前任务，再更换工作区。")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "更换文件夹" })).toBeDisabled();
  expect(choose).not.toHaveBeenCalled();
});

it("preserves the selected folder when the native picker is cancelled", async () => {
  vi.stubGlobal("desktop", { chooseConversationDirectory: vi.fn().mockResolvedValue(null) });
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ directory: "D:\\projects\\code", busy: false, approvals: [] })));
  render(<ProjectWorkspaceSettings projectId="p1" canManage active />);
  await userEvent.click(await screen.findByRole("button", { name: "更换文件夹" }));
  expect(screen.getByLabelText("项目工作区")).toHaveValue("D:\\projects\\code");
});

it("binds a folder selected before creation and retries a failed binding without creating another project", async () => {
  const choose = vi.fn().mockResolvedValue({ selectionId: "selection-1", directory: "D:\\projects\\new" });
  const assign = vi.fn().mockRejectedValueOnce(new Error("目录暂不可用")).mockResolvedValue("D:\\projects\\new");
  vi.stubGlobal("desktop", { chooseProjectWorkspace: choose, assignProjectWorkspace: assign });
  const create = vi.spyOn(platformApi, "createProject").mockResolvedValue({ project: { id: "p1", name: "新项目", description: null, status: "active", ownerUserId: "owner", updatedAt: "2026-10-23T00:00:00Z" } });
  render(<ProjectCreateForm onNavigate={vi.fn()} />);
  await userEvent.type(screen.getByLabelText("项目名称"), "新项目");
  await userEvent.click(screen.getByRole("button", { name: "选择文件夹" }));
  expect(screen.getByLabelText("项目工作区")).toHaveValue("D:\\projects\\new");
  await userEvent.click(screen.getByRole("button", { name: i18n.t("projects.createForm.submit") }));
  expect(await screen.findByRole("alert")).toHaveTextContent("项目已创建");
  await userEvent.click(screen.getByRole("button", { name: i18n.t("projects.createForm.submit") }));
  await waitFor(() => expect(assign).toHaveBeenCalledTimes(2));
  expect(create).toHaveBeenCalledTimes(1);
  expect(assign).toHaveBeenLastCalledWith("p1", "selection-1");
});
