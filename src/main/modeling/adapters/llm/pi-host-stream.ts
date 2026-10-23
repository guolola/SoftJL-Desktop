// Lets native compaction and child sessions reuse the host's scheduled model transport.
import { randomUUID } from "node:crypto";
import { registerApiProvider, unregisterApiProviders } from "@earendil-works/pi-ai/compat";
import type { Api, Model } from "@earendil-works/pi-ai";
import { createAssistantMessageEventStream } from "@earendil-works/pi-ai";
import type { StreamFn } from "@earendil-works/pi-agent-core";
import type { ProviderConfig } from "@earendil-works/pi-coding-agent";

export function piHostStream(stream: StreamFn): NonNullable<ProviderConfig["streamSimple"]> {
  return (model, context, options) => {
    const output = createAssistantMessageEventStream();
    void (async () => {
      try { for await (const event of await stream(model, context, options)) output.push(event); }
      catch (error) {
        output.push({ type: "error", reason: "error", error: { role: "assistant", content: [], api: model.api, provider: model.provider,
          model: model.id, usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
          stopReason: "error", errorMessage: error instanceof Error ? error.message : String(error), timestamp: Date.now() } });
      } finally { output.end(); }
    })();
    return output;
  };
}

/** SDK helpers used by installed extensions dispatch by API rather than by ModelRuntime. */
export function bindPiHostProvider(stream: StreamFn, model: Model<Api>) {
  const sourceId = "softjl-host-" + randomUUID();
  const api = sourceId;
  // A separate API identity per run prevents simultaneous projects from sharing credentials or scheduling context.
  const streamSimple = piHostStream((_selected, context, options) => stream(model, context, options));
  registerApiProvider({ api, stream: streamSimple, streamSimple }, sourceId);
  return { api, streamSimple, dispose: () => unregisterApiProviders(sourceId) };
}
