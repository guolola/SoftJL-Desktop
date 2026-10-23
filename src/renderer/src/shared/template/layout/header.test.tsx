// Verifies desktop toolbar portals keep sidebar context, route updates and cleanup intact.
import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { SidebarProvider, useSidebar } from "../../ui/sidebar.js";
import { AdmincnHeader } from "./header.js";
import { ShellChromeContext } from "./shell-chrome.js";
import { SidebarBrand } from "./sidebar-brand.js";

function SidebarStatus() {
  const { state } = useSidebar();
  return <output>{state}</output>;
}

function DesktopHarness({ route }: { route: string }) {
  const [headerTarget, setHeaderTarget] = useState<HTMLDivElement | null>(null);
  return <ShellChromeContext.Provider value={{ headerTarget }}>
    <header aria-label="窗口栏"><div ref={setHeaderTarget} /></header>
    <SidebarProvider>
      <SidebarBrand />
      <AdmincnHeader navigation={<span>{route}</span>} actions={<button>任务</button>} />
      <SidebarStatus />
    </SidebarProvider>
  </ShellChromeContext.Provider>;
}

describe("desktop header", () => {
  it("renders one window header and keeps the sidebar toggle functional through the portal", () => {
    render(<DesktopHarness route="项目 A" />);
    const header = screen.getByRole("banner", { name: "窗口栏" });
    expect(within(header).getByText("项目 A")).toBeInTheDocument();
    expect(within(header).getByRole("button", { name: "任务" })).toBeInTheDocument();
    expect(document.querySelectorAll("header")).toHaveLength(1);
    expect(document.querySelector('[data-slot="sidebar-header"]')).toBeNull();
    expect(screen.getByText("expanded")).toBeInTheDocument();
    fireEvent.click(header.querySelector('[data-slot="sidebar-trigger"]')!);
    expect(screen.getByText("collapsed")).toBeInTheDocument();
  });

  it("replaces route context without leaving stale toolbar actions after unmount", () => {
    const { rerender, unmount } = render(<DesktopHarness route="项目 A" />);
    rerender(<DesktopHarness route="项目 B" />);
    expect(screen.queryByText("项目 A")).toBeNull();
    expect(screen.getByText("项目 B")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "任务" })).toHaveLength(1);
    unmount();
    expect(document.querySelector('[data-slot="desktop-toolbar"]')).toBeNull();
  });
});
