// Verifies immediate desktop LLM execution, streaming backpressure and request telemetry.
import assert from "node:assert/strict";
import test from "node:test";
import type { ProviderSettings } from "../../../../shared/contracts/index.js";
import {
  createInMemoryLlmScheduler,
  createScheduledLlmTransport,
  type LlmScheduleContext,
} from "./llm-scheduler.js";
import type { LlmTransport, StreamChatCompletionInput } from "./llm-transport.js";
import type { LlmRequestTelemetry } from "../../runs/records/run-telemetry-store.js";

function context(patch: Partial<LlmScheduleContext> = {}): LlmScheduleContext {
  return {
    runId: "run-1",
    projectId: "project-1",
    userId: "user-1",
    providerConfigId: "provider-1",
    model: "gpt-5.4",
    taskType: "design_modeling",
    stage: "generate_design_models",
    ...patch,
  };
}

const providerSettings: ProviderSettings = {
  apiBaseUrl: "https://llm.test",
  apiKey: "test-key",
  model: "test-model",
};

test("scheduled transport forwards transient retries and records their count without duplicating token usage", async () => {
  const telemetry: LlmRequestTelemetry[] = [];
  const observedRetries: number[] = [];
  const transport = createScheduledLlmTransport({
    scheduler: createInMemoryLlmScheduler(), context: context(),
    analyticsStore: { recordTelemetry: async (entry) => { telemetry.push(entry); } },
    transport: { async *streamChatCompletion(input) {
      input.onRequestRetry?.({ retry: 1, delayMs: 1_000, statusCode: 503, reason: "http" });
      input.onRequestRetry?.({ retry: 2, delayMs: 2_000, statusCode: 502, reason: "http" });
      input.onTokenUsage?.({ inputTokens: 100, outputTokens: 20, cachedInputTokens: 0, reasoningTokens: 5, totalTokens: 120 });
      yield "model";
    } },
  });
  for await (const _ of transport.streamChatCompletion({ providerSettings, messages: [],
    onRequestRetry: (event) => observedRetries.push(event.retry),
  })) { /* Drain the completed logical request. */ }
  assert.deepEqual(observedRetries, [1, 2]);
  assert.equal(telemetry.length, 1);
  assert.equal(telemetry[0].retryCount, 2);
  assert.equal(telemetry[0].usage?.totalTokens, 120);
  assert.equal(telemetry[0].outcome, "success");
});

test("desktop starts all requests for the same provider, project, user and run without queuing", async () => {
  const scheduler = createInMemoryLlmScheduler();
  const statuses: string[] = [];
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  let started = 0;
  const requests = Array.from({ length: 12 }, (_, index) => scheduler.run(context(), async () => {
    started++;
    await pending;
    return index;
  }, status => { statuses.push(status.status); }));

  assert.equal(started, 12);
  assert.deepEqual(scheduler.snapshot(), { running: 12, queued: 0 });
  assert.deepEqual(statuses, Array(12).fill("running"));
  release();
  assert.deepEqual(await Promise.all(requests), Array.from({ length: 12 }, (_, index) => index));
  assert.deepEqual(scheduler.snapshot(), { running: 0, queued: 0 });
  assert.equal(statuses.filter(status => status === "completed").length, 12);
});

test("desktop request accounting recovers after synchronous and asynchronous failures", async () => {
  const scheduler = createInMemoryLlmScheduler();
  await assert.rejects(scheduler.run(context(), () => { throw new Error("sync failure"); }), /sync failure/);
  assert.deepEqual(scheduler.snapshot(), { running: 0, queued: 0 });
  await assert.rejects(scheduler.run(context(), async () => { throw new Error("async failure"); }), /async failure/);
  assert.deepEqual(scheduler.snapshot(), { running: 0, queued: 0 });
  assert.equal(await scheduler.run(context(), async () => "recovered"), "recovered");
});

test("scheduled LLM transport forwards abort signals and composer reasoning to the provider transport", async () => {
  const scheduler = createInMemoryLlmScheduler();
  const controller = new AbortController();
  let receivedInput: StreamChatCompletionInput | undefined;
  const providerTransport: LlmTransport = {
    async *streamChatCompletion(input) {
      receivedInput = input;
      yield "ok";
    },
  };
  const scheduledTransport = createScheduledLlmTransport({
    transport: providerTransport,
    scheduler,
    context: context(),
  });

  const chunks: string[] = [];
  for await (const chunk of scheduledTransport.streamChatCompletion({
    providerSettings,
    reasoning: true,
    messages: [{ role: "user", content: "hello" }],
    abortSignal: controller.signal,
  })) {
    chunks.push(chunk);
  }

  assert.deepEqual(chunks, ["ok"]);
  assert.equal(receivedInput?.abortSignal, controller.signal);
  assert.equal(receivedInput?.reasoning, true);
});

test("slow streams retain backpressure while other requests start immediately", async () => {
  const scheduler = createInMemoryLlmScheduler();
  let produced = 0;
  const first = scheduler.stream(context(), async function* () {
    for (const chunk of ["a", "b", "c", "d"]) { produced++; yield chunk; }
  });
  const iterator = first[Symbol.asyncIterator]();
  assert.equal((await iterator.next()).value, "a");
  await new Promise<void>(resolve => setImmediate(resolve));
  assert.equal(produced, 3, "the provider pauses with one buffered chunk and one pending chunk");
  const second: string[] = [];
  for await (const chunk of scheduler.stream(context(), async function* () { yield "other"; })) second.push(chunk);
  assert.deepEqual(second, ["other"]);
  assert.deepEqual(scheduler.snapshot(), { running: 1, queued: 0 });
  const remaining: string[] = [];
  for await (const chunk of { [Symbol.asyncIterator]: () => iterator }) remaining.push(chunk);
  assert.deepEqual(remaining, ["b", "c", "d"]);
  assert.deepEqual(scheduler.snapshot(), { running: 0, queued: 0 });
});

test("active desktop streams still abort and record cancellation telemetry", async () => {
  const scheduler = createInMemoryLlmScheduler();
  const controller = new AbortController();
  const telemetry: LlmRequestTelemetry[] = [];
  let started!: () => void;
  const providerStarted = new Promise<void>(resolve => { started = resolve; });
  const transport = createScheduledLlmTransport({ scheduler, context: context(),
    analyticsStore: { recordTelemetry: async entry => { telemetry.push(entry); } },
    transport: { async *streamChatCompletion(input) {
      started();
      await new Promise<void>((_, reject) => {
        input.abortSignal!.addEventListener("abort", () => reject(input.abortSignal!.reason), { once: true });
      });
      yield "unreachable";
    } },
  });
  const stream = transport.streamChatCompletion({ providerSettings, messages: [], abortSignal: controller.signal });
  const next = stream[Symbol.asyncIterator]().next();
  await providerStarted;
  controller.abort(new Error("request cancelled"));
  scheduler.cancelRun(context().runId);
  await assert.rejects(next, /request cancelled/);
  assert.deepEqual(scheduler.snapshot(), { running: 0, queued: 0 });
  assert.equal(telemetry.length, 1);
  assert.equal(telemetry[0].outcome, "cancelled");
  assert.equal(telemetry[0].queueMs, 0);
});
