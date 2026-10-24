// Checks real plugin result projection, including terminal failures that still return isError=false.
import { expect, it } from "vitest";
import { pluginAgentState, pluginSources } from "./plugin-tool-data.js";
it("preserves real sources and rejects non-web link schemes", () => {
  expect(pluginSources({ queries: [{ results: [{ url: "https://example.com/a", title: "Actual title", snippet: "Actual excerpt" }, { url: "javascript:alert(1)" }] }], urls: [{ url: "not a URL" }] })).toEqual([
    { url: "https://example.com/a", domain: "example.com", title: "Actual title", snippet: "Actual excerpt" },
  ]);
});
it("reads curated sources and removes repeated URLs across queries", () => {
  expect(pluginSources({ curatedQueries: [{ sources: [{ title: "Verified", url: "https://example.com/a" }] },
    { sources: [{ title: "Repeated", url: "https://example.com/a" }] }] })).toEqual([
    { title: "Verified", url: "https://example.com/a", domain: "example.com", snippet: undefined },
  ]);
});
it.each([["completed", "done"], ["running", "working"], ["queued", "waiting"], ["background", "waiting"], ["error", "failed"], ["aborted", "cancelled"], ["stopped", "cancelled"]])("maps upstream %s to %s", (status, expected) => {
  expect(pluginAgentState({ status }, false, false)).toBe(expected);
});
it("does not label a successful background dispatch as completed work", () => {
  expect(pluginAgentState({}, false, false)).toBe("waiting");
  expect(pluginAgentState({ status: "completed" }, false, true)).toBe("failed");
});
