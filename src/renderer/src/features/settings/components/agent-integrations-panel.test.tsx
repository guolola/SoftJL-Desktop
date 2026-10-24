// Covers user-facing setup, saved credential retention and Skill management guards.
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import type { IntegrationOverview } from "../../../../../shared/contracts/agent-integrations.js";
import { AppI18nProvider } from "../../../shared/i18n/i18n-provider.js";
import { AgentIntegrationsPanel } from "./agent-integrations-panel.js";

let data: IntegrationOverview;
beforeEach(() => {
  data = { servers: [{ id: "context7", name: "Context7", description: "查询框架文档", setup: "需要网络", enabled: false, exposure: "deferred", config: { type: "http", url: "https://example.test/mcp" }, envKeys: [], headerKeys: ["Authorization"] }], skills: [
    { id: "uml-graduation-modeling", name: "uml-graduation-modeling", title: "UML 与业务建模", description: "核心", content: "# Core", enabled: true, builtin: true, required: true, prerequisites: "核心工具" },
    { id: "requirements-discovery", name: "requirements-discovery", title: "需求澄清", description: "澄清需求", content: "# Workflow\nRead project", enabled: true, builtin: true, required: false, prerequisites: "询问组件" },
  ] };
  vi.stubGlobal("fetch", vi.fn(async (url, options) => {
    const path = String(url);
    if (options?.method === "PUT") {
      expect(options.headers).toEqual({ "Content-Type": "application/json" });
      const input = JSON.parse(String(options.body));
      if (path.includes("/mcp/")) data.servers = data.servers.map(item => ({ ...item, ...input }));
      else if (path.includes("/skills/")) {
        const existing = data.skills.find(item => item.id === input.name);
        if (existing) Object.assign(existing, input); else data.skills.push({ ...input, id: input.name, title: input.name, required: false, builtin: false, prerequisites: "" });
      }
    }
    if (path.endsWith("/test")) { data.servers[0].test = { ok: true, checkedAt: "2026-10-23T00:00:00Z", message: "连接成功，发现 1 个工具", tools: [{ name: "query-docs" }] }; return Response.json(data.servers[0].test); }
    return Response.json(data);
  }));
});
const mount = (kind: "mcp" | "skills") => render(<AppI18nProvider><AgentIntegrationsPanel kind={kind} active onDirtyChange={vi.fn()} onBusyChange={vi.fn()} /></AppI18nProvider>);

it("tests saved MCP configuration and displays the discovered tools", async () => {
  mount("mcp"); await screen.findByText("Context7");
  expect(screen.queryByText("Code Mode")).not.toBeInTheDocument();
  expect(screen.queryByText("Tool Search")).not.toBeInTheDocument();
  expect(screen.getByText(/需要网络/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "测试连接" }));
  await userEvent.click(await screen.findByText(/连接成功，发现 1 个工具/));
  expect(screen.getByText("query-docs")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("switch", { name: "启用 Context7" }));
  await waitFor(() => expect(data.servers[0].enabled).toBe(true));
});

it("does not send empty credential maps when editing an existing MCP", async () => {
  mount("mcp"); await userEvent.click(await screen.findByRole("button", { name: "配置" }));
  expect(screen.queryByLabelText("工具调用方式")).not.toBeInTheDocument();
  expect(screen.getByLabelText("请求头（JSON 对象）")).toHaveValue("");
  expect(screen.getByText(/已保存的键：Authorization/)).toBeInTheDocument();
  await userEvent.clear(screen.getByLabelText("显示名称"));
  await userEvent.type(screen.getByLabelText("显示名称"), "Docs");
  await userEvent.click(screen.getByRole("button", { name: "保存配置" }));
  await screen.findByText("Docs");
  const request = vi.mocked(fetch).mock.calls.find(([, options]) => options?.method === "PUT")!;
  expect(JSON.parse(String(request[1]?.body)).config).toEqual({ type: "http", url: "https://example.test/mcp" });
  expect(JSON.parse(String(request[1]?.body)).exposure).toBe("deferred");
});

it("saves a basic custom MCP with direct tool calls without a mode selector", async () => {
  mount("mcp"); await userEvent.click(await screen.findByRole("button", { name: "添加 MCP" }));
  expect(screen.queryByLabelText("工具调用方式")).not.toBeInTheDocument();
  await userEvent.type(screen.getByLabelText("标识（小写英文与连字符）"), "custom-server");
  await userEvent.type(screen.getByLabelText("显示名称"), "Custom");
  await userEvent.type(screen.getByLabelText("启动程序"), "npx");
  await userEvent.click(screen.getByRole("button", { name: "保存配置" }));
  await waitFor(() => expect(vi.mocked(fetch).mock.calls.some(([, options]) => options?.method === "PUT")).toBe(true));
  const request = vi.mocked(fetch).mock.calls.find(([, options]) => options?.method === "PUT")!;
  expect(JSON.parse(String(request[1]?.body))).toMatchObject({ exposure: "direct", config: { type: "stdio", command: "npx", args: [] } });
});

it("blocks invalid JSON before saving a custom MCP", async () => {
  mount("mcp"); await userEvent.click(await screen.findByRole("button", { name: "添加 MCP" }));
  await userEvent.type(screen.getByLabelText("标识（小写英文与连字符）"), "custom-server");
  await userEvent.type(screen.getByLabelText("显示名称"), "Custom");
  await userEvent.type(screen.getByLabelText("启动程序"), "npx");
  await userEvent.clear(screen.getByLabelText("启动参数（JSON 数组）"));
  await userEvent.type(screen.getByLabelText("启动参数（JSON 数组）"), "invalid");
  await userEvent.click(screen.getByRole("button", { name: "保存配置" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("JSON");
  expect(vi.mocked(fetch).mock.calls.some(([, options]) => options?.method === "PUT")).toBe(false);
});

it("keeps core Skills enabled and saves optional Skill changes", async () => {
  mount("skills"); await screen.findByText("UML 与业务建模");
  expect(screen.getByRole("switch", { name: "启用 UML 与业务建模" })).toHaveAttribute("aria-disabled", "true");
  await userEvent.click(screen.getByRole("switch", { name: "启用 需求澄清" }));
  await waitFor(() => expect(data.skills[1].enabled).toBe(false));
  await userEvent.click(screen.getByRole("button", { name: "查看与编辑" }));
  await userEvent.type(screen.getByLabelText("技能正文（Markdown）"), "\nCheck evidence.");
  await userEvent.click(screen.getByRole("button", { name: "保存配置" }));
  await waitFor(() => expect(data.skills[1].content).toContain("Check evidence."));
});
