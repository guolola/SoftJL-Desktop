// Verifies project routes compose the retained conversation workspace and reject removed engineering sections.
import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import App from "./App.js";
vi.mock("../features/user-platform/components/user-platform-pages.js", () => ({
  AuthenticatedRoute: ({ children }: { children: React.ReactNode }) => children,
  ProjectWorkspaceAccessBoundary: ({ children }: { children: React.ReactNode }) => children,
  useProjectOverview: () => ({ project: { id: "p", name: "项目", status: "active" }, membership: { role: "owner" } }),
  ProjectSectionPage: ({ section }: { section: string }) => <div>项目管理：{section}</div>,
  ProjectNewPage: () => <div>创建项目</div>, ProjectsIndexPage: () => <div>项目列表</div>,
}));
vi.mock("../features/standard-project/components/standard-workspace.js", () => ({ StandardWorkspace: ({ projectId, canEdit, sectionContent }: { projectId: string; canEdit: boolean; sectionContent?: React.ReactNode }) => <main data-testid="conversation-workspace" data-project={projectId} data-edit={canEdit}>{sectionContent ?? "项目聊天"}</main> }));
vi.mock("../features/workspace-shell/components/top-bar.js", () => ({ TopBar: () => <header>工作区</header> }));
vi.mock("../features/onboarding/components/onboarding-tour-provider.js", () => ({ OnboardingTourProvider: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("../features/settings/components/provider-availability-notice.js", () => ({ ProviderAvailabilityNotice: () => null }));
vi.mock("../shared/template/views/pages/misc/error-page-404/index.js", () => ({ default: () => <h1>页面不存在</h1> }));
beforeEach(() => { window.history.replaceState({}, "", "/projects/p"); localStorage.clear(); });
it("opens every project in the conversation workspace", () => {
  render(<App initialPath="/projects/p" />);
  expect(screen.getByTestId("conversation-workspace")).toHaveAttribute("data-project", "p");
  expect(screen.getByText("项目聊天")).toBeInTheDocument();
});
it.each(["settings", "members", "history"])("keeps shared project management: %s", section => {
  render(<App initialPath={`/projects/p/${section}`} />);
  expect(screen.getByText(`项目管理：${section}`)).toBeInTheDocument();
});
it.each(["lineage", "documents", "code", "design", "feasibility"])("rejects removed engineering section: %s", section => {
  render(<App initialPath={`/projects/p/${section}`} />);
  expect(screen.getByText("页面不存在")).toBeInTheDocument();
  expect(screen.queryByTestId("conversation-workspace")).not.toBeInTheDocument();
});
