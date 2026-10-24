// Verifies that real plugin results reach the imported Elements rather than demo placeholders.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { PluginToolResult } from "./plugin-tool-result.js";

afterEach(cleanup);
it("shows the actual source count and opens the upstream Sources links", () => {
  const view = render(<PluginToolResult name="web_search" args={{ query: "Pi extensions" }} running={false} failed={false}
    data={{ queries: [{ results: [{ url: "https://example.com/one", title: "First" }, { url: "https://example.com/two", title: "Second" }] }] }} />);
  expect(view.container.querySelector('[data-slot="web-search"]')).toBeInTheDocument();
  expect(screen.getByText("2 sources")).toBeInTheDocument();
  expect(screen.queryByText("Read 3 sources")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Sources/ }));
  expect(screen.getByRole("link", { name: /First/ })).toHaveAttribute("href", "https://example.com/one");
});
it("shows upstream agent failure even when tool dispatch itself succeeded", () => {
  const view = render(<PluginToolResult name="subagent" args={{ description: "Inspect models" }} data={{ status: "error" }}
    output="Provider unavailable" running={false} failed={false} />);
  expect(view.container.querySelector('[data-slot="task-card"]')).toHaveAttribute("data-state", "failed");
  expect(screen.getByText("Provider unavailable")).toBeInTheDocument();
});
