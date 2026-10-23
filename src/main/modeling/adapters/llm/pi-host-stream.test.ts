// Ensures helper-dispatched model calls stay scoped to their originating run and are released afterward.
import test from "node:test";
import assert from "node:assert/strict";
import { createAssistantMessageEventStream, type AssistantMessage, type Model } from "@earendil-works/pi-ai";
import { completeSimple, getApiProvider } from "@earendil-works/pi-ai/compat";
import { bindPiHostProvider } from "./pi-host-stream.js";
test("two plugin transports remain independent and unregister on close", async () => {
  const model = { api: "openai-completions", provider: "test", id: "model" } as Model<"openai-completions">;
  const make = (text: string) => bindPiHostProvider(selected => {
    assert.equal(selected.api, "openai-completions");
    const output = createAssistantMessageEventStream();
    const message = { role: "assistant", content: [{ type: "text", text }], api: selected.api, provider: selected.provider, model: selected.id, stopReason: "stop", timestamp: 0,
      usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } } } as AssistantMessage;
    output.push({ type: "done", reason: "stop", message }); return output;
  }, model);
  const one = make("one"), two = make("two");
  try {
    const results = await Promise.all([one, two].map(binding => completeSimple({ ...model, api: binding.api }, { messages: [] })));
    assert.deepEqual(results.map(result => result.content), [[{ type: "text", text: "one" }], [{ type: "text", text: "two" }]]);
  } finally { one.dispose(); two.dispose(); }
  assert.equal(getApiProvider(one.api), undefined); assert.equal(getApiProvider(two.api), undefined);
});
