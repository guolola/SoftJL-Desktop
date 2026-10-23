// Verifies modeling navigation keeps account controls and excludes the retired coding entry.
import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { SidebarProvider } from "../../../shared/ui/sidebar.js";
import { ProjectSidebar } from "./project-sidebar.js";
vi.mock("./sidebar-user-dropdown", () => ({ SidebarUserDropdown: () => <span>Account</span> }));
it("retains modeling navigation and account controls without code generation", () => {
  render(<SidebarProvider><ProjectSidebar onOpenAccount={() => {}} onNavigate={() => {}}><span>Models</span></ProjectSidebar></SidebarProvider>);
  expect(screen.getByText("Models").closest('[data-slot="sidebar-content"]')).not.toBeNull();
  expect(screen.getByText("Account").closest('[data-slot="sidebar-footer"]')).not.toBeNull();
  expect(screen.queryByRole("button", { name: "生成代码" })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "去连接" })).not.toBeInTheDocument();
});
