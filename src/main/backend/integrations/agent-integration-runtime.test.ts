// Exercises actual MCP calls through Pi's direct, deferred and sandboxed tool paths.
import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAssistantMessageEventStream, getCurrentSystemPrompt, getCurrentTools, type AssistantMessage } from "@earendil-works/pi-ai";
import { startMcpTestServer } from "../../../../tests/modeling/fixtures/integrations/mcp-test-server.js";
import { compatibleTestModelCapability } from "../../../../tests/modeling/fixtures/providers/model-capability.js";
import { createStandardProjectState } from "../../../shared/contracts/index.js";
import { runStandardAgent } from "../../modeling/runs/pipelines/standard/standard-agent-pipeline.js";
import { IntegrationStore } from "./integration-store.js";
import { createAgentIntegrationRuntime } from "./agent-integration-runtime.js";

for (const exposure of ["direct", "deferred", "codemode"] as const) test(`native Pi executes ${exposure} MCP tools and loads selected Skills`, async t => {
  const directory = await mkdtemp(join(tmpdir(), "softjl-mcp-runtime-")); t.after(() => rm(directory, { recursive: true, force: true }));
  const peer = await startMcpTestServer(); t.after(peer.close);
  const store = await IntegrationStore.open(directory, "test-key");
  await store.saveServer("fixture", { name: "Fixture", description: "Modeling record tools", enabled: true, exposure, config: { type: "http", url: peer.url } });
  const checked = await store.testServer("fixture"); assert.equal(checked.ok, true, checked.message); assert.equal(checked.tools.length, 2);
  const managed = await createAgentIntegrationRuntime(store)();
  t.after(managed.close);
  let state = createStandardProjectState("测试项目");
  let round = 0;
  const response = (content: AssistantMessage["content"]): AssistantMessage => ({ role: "assistant", api: "openai-completions", provider: "uml-managed", model: "test", content, timestamp: Date.now(), stopReason: content.some(item => item.type === "toolCall") ? "toolUse" : "stop", usage: { input: 1, output: 1, totalTokens: 2, cacheRead: 0, cacheWrite: 0, cost: { input: 0, output: 0, total: 0, cacheRead: 0, cacheWrite: 0 } } });
  const call = (name: string, args: Record<string, unknown>) => response([{ type: "toolCall", id: `native-${round}`, name, arguments: args }]);
  await runStandardAgent("p", { operation: "chat", message: "读取记录并解释", language: "zh-CN" }, state, {
    ...managed.options,
    extensionFactories: [...managed.options.extensionFactories!, pi => { pi.on("session_start", async () => { await new Promise(resolve => setTimeout(resolve, 150)); }); }],
    settings: { apiBaseUrl: "https://example.test", apiKey: "test-only", model: "test", modelCapability: compatibleTestModelCapability("test") },
    signal: new AbortController().signal,
    save: async update => { update(state); return structuredClone(state); },
    transport: { async *streamChatCompletion() { yield "{}"; } },
    render: async () => { throw new Error("No rendering expected"); },
    stream: (_, context) => {
      const out = createAssistantMessageEventStream(); const prompt = getCurrentSystemPrompt(context.messages);
      let message: AssistantMessage;
      if (prompt.startsWith("Suggest exactly")) message = response([{ type: "text", text: "检查需求\n完善模型\n补充测试" }]);
      else {
        assert.match(prompt, /requirements-discovery/u);
        const names = getCurrentTools(context.messages).map(tool => tool.name);
        if (round++ === 0) {
          if (exposure === "direct") { assert.ok(names.includes("mcp__fixture__read_record")); message = call("mcp__fixture__read_record", { id: "r1" }); }
          else if (exposure === "deferred") { assert.ok(names.includes("tool_search")); message = call("tool_search", { query: "read modeling record", limit: 5 }); }
          else { assert.ok(names.includes("codemode")); message = call("codemode", { code: 'const r = await tools.mcp__fixture__read_record({id:"r1"}); text(r);' }); }
        } else if (exposure === "deferred" && peer.calls.length === 0 && round < 4) message = call("mcp__fixture__read_record", { id: "r1" });
        else {
          assert.equal(peer.calls.length, 1, JSON.stringify(context.messages).slice(-2500));
          message = response([{ type: "text", text: "已读取实际记录。" }]);
        }
      }
      out.push({ type: "done", reason: message.stopReason as "toolUse" | "stop", message }); return out;
    },
  });
  assert.equal(peer.calls.length, 1);
  assert.deepEqual(peer.calls[0], { name: "read_record", arguments: { id: "r1" } });
  assert.ok(state.piSession);
});
