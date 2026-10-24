// Tracks local LLM requests and streaming telemetry without desktop concurrency limits.
import type { RunStage } from "../../../../shared/contracts/index.js";
import type {
  ChatCompletionResponseFormat,
  ChatMessage,
  LlmTransport,
  StreamChatCompletionInput,
} from "./llm-transport.js";
import { ProviderHttpError } from "./llm-transport.js";
import {
  newTelemetryId,
  type RunTelemetryStore,
  type LlmRequestTelemetry,
} from "../../runs/records/run-telemetry-store.js";

export type LlmQueueReason = "global" | "provider" | "project" | "user" | "run";

export interface LlmScheduleContext {
  runId: string;
  projectId?: string | null;
  userId?: string | null;
  providerConfigId?: string | null;
  model: string;
  taskType: string;
  stage?: RunStage | null;
  diagramKind?: string | null;
  subtaskId?: string | null;
  subtaskLabel?: string | null;
  requestedModelCount?: number | null;
}

export interface LlmScheduleStatus {
  status: "queued" | "running" | "completed" | "cancelled";
  queuePosition?: number;
  queueAhead?: number;
  waitMs?: number;
  estimatedWaitMs?: number;
  queueReason?: LlmQueueReason;
}

export interface LlmScheduler {
  run<T>(
    context: LlmScheduleContext,
    task: () => Promise<T>,
    onStatus?: (status: LlmScheduleStatus) => void,
  ): Promise<T>;
  stream(
    context: LlmScheduleContext,
    task: () => AsyncIterable<string>,
    onStatus?: (status: LlmScheduleStatus) => void,
  ): AsyncIterable<string>;
  cancelRun(runId: string): void;
  snapshot(): {
    running: number;
    queued: number;
  };
}

export function createInMemoryLlmScheduler(): LlmScheduler {
  let running = 0;

  async function run<T>(
    _context: LlmScheduleContext,
    task: () => Promise<T>,
    onStatus?: (status: LlmScheduleStatus) => void,
  ): Promise<T> {
    // Desktop requests start immediately; keep lifecycle callbacks for usage telemetry.
    running += 1;
    try {
      onStatus?.({ status: "running", waitMs: 0 });
      const value = await task();
      onStatus?.({ status: "completed" });
      return value;
    } finally {
      running -= 1;
    }
  }

  return {
    run,
    async *stream(context, task, onStatus) {
      const chunks: string[] = [];
      const waiters: Array<() => void> = [];
      const spaceWaiters: Array<() => void> = [];
      let done = false;
      let failure: Error | null = null;
      // Keep provider streaming coupled to downstream SSE/event persistence
      // so slow consumers cannot buffer an unbounded number of chunks.
      const maxBufferedChunks = 1;
      const wake = () => {
        while (waiters.length > 0) waiters.shift()?.();
      };
      const wakeSpace = () => {
        while (spaceWaiters.length > 0) spaceWaiters.shift()?.();
      };
      const waitForChunk = () =>
        new Promise<void>((resolve) => {
          waiters.push(resolve);
        });
      const waitForSpace = () =>
        new Promise<void>((resolve) => {
          spaceWaiters.push(resolve);
        });
      const pump = run(
        context,
        async () => {
          for await (const chunk of task()) {
            while (chunks.length >= maxBufferedChunks) {
              await waitForSpace();
            }
            chunks.push(chunk);
            wake();
          }
        },
        onStatus,
      )
        .catch((error: unknown) => {
          failure = error instanceof Error ? error : new Error(String(error));
        })
        .finally(() => {
          done = true;
          wake();
        });
      while (!done || chunks.length > 0) {
        const chunk = chunks.shift();
        if (chunk !== undefined) {
          wakeSpace();
          yield chunk;
          continue;
        }
        await waitForChunk();
      }
      await pump;
      if (failure) throw failure;
    },
    cancelRun(_runId) {
      // There is no local queue; callers abort active requests through their AbortController.
    },
    snapshot() {
      return {
        running,
        queued: 0,
      };
    },
  };
}

export function createScheduledLlmTransport({
  transport,
  scheduler,
  context,
  deriveContext,
  onStatus,
  analyticsStore,
}: {
  transport: LlmTransport;
  scheduler: LlmScheduler;
  context: LlmScheduleContext;
  deriveContext?: (input: StreamChatCompletionInput) => Partial<LlmScheduleContext>;
  onStatus?: (status: LlmScheduleStatus, context: LlmScheduleContext) => void;
  analyticsStore?: Pick<RunTelemetryStore, "recordTelemetry">;
}): LlmTransport {
  return {
    async *streamChatCompletion(input: StreamChatCompletionInput): AsyncIterable<string> {
      const requestContext = {
        ...context,
        ...deriveContext?.(input),
      };
      const queuedAt = Date.now();
      let providerStartedAt: number | null = null;
      let firstReasoningAt: number | null = null;
      let firstVisibleAt: number | null = null;
      let lastVisibleAt: number | null = null;
      let queueMs: number | null = null;
      let usage: LlmRequestTelemetry["usage"] = null;
      let usageUnavailableReason: string | null = null;
      let formatFallbackCount = 0;
      let requestRetryCount = 0;
      let failure: unknown = null;
      let completedNormally = false;

      const stream = scheduler.stream(
        requestContext,
        async function* () {
          const providerStream = transport.streamChatCompletion({
            runContext: input.runContext,
            providerSettings: input.providerSettings,
            reasoning: input.reasoning,
            messages: input.messages as ChatMessage[],
            responseFormat:
              input.responseFormat as ChatCompletionResponseFormat | null | undefined,
            abortSignal: input.abortSignal,
            onRequestRetry(event) {
              requestRetryCount += 1;
              input.onRequestRetry?.(event);
            },
            onResponseFormatFallback(event) {
              formatFallbackCount += 1;
              input.onResponseFormatFallback?.(event);
            },
            onTokenUsage(value) {
              usage = { ...value };
              input.onTokenUsage?.(value);
            },
            onReasoningSummary: input.onReasoningSummary,
            onReasoningChunk(chunk) {
              firstReasoningAt ??= Date.now();
              input.onReasoningChunk?.(chunk);
            },
            onUsageUnavailable(reason) {
              usageUnavailableReason ??= reason;
              input.onUsageUnavailable?.(reason);
            },
          });
          for await (const chunk of providerStream) {
            if (chunk.length > 0) {
              const observedAt = Date.now();
              firstVisibleAt ??= observedAt;
              lastVisibleAt = observedAt;
            }
            yield chunk;
          }
        },
        (status) => {
          if (status.status === "running") {
            providerStartedAt ??= Date.now();
            queueMs = status.waitMs ?? providerStartedAt - queuedAt;
          }
          onStatus?.(status, requestContext);
        },
      );

      try {
        for await (const chunk of stream) yield chunk;
        completedNormally = true;
      } catch (error) {
        failure = error;
        throw error;
      } finally {
        if (analyticsStore) {
          const completedAt = Date.now();
          const providerError = failure instanceof ProviderHttpError ? failure : null;
          const message = failure instanceof Error ? failure.message.toLowerCase() : "";
          const cancelled = input.abortSignal?.aborted || message.includes("cancel");
          const errorCategory = completedNormally
            ? null
            : cancelled
              ? "cancelled"
              : providerError?.status === 429
                ? "rate_limit"
                : message.includes("timed out") || message.includes("timeout")
                  ? "timeout"
                  : providerError
                    ? "provider"
                    : "unknown";
          const telemetry: LlmRequestTelemetry = {
            id: newTelemetryId(),
            runId: requestContext.runId,
            projectId: requestContext.projectId ?? null,
            userId: requestContext.userId ?? null,
            providerConfigId: requestContext.providerConfigId ?? null,
            model: requestContext.model,
            taskType: requestContext.taskType,
            stage: requestContext.stage ?? null,
            diagramKind: requestContext.diagramKind ?? null,
            subtaskId: requestContext.subtaskId ?? null,
            requestedModelCount: requestContext.requestedModelCount ?? null,
            queuedAt: new Date(queuedAt).toISOString(),
            providerStartedAt: providerStartedAt === null ? null : new Date(providerStartedAt).toISOString(),
            firstReasoningAt: firstReasoningAt === null ? null : new Date(firstReasoningAt).toISOString(),
            firstVisibleAt: firstVisibleAt === null ? null : new Date(firstVisibleAt).toISOString(),
            lastVisibleAt: lastVisibleAt === null ? null : new Date(lastVisibleAt).toISOString(),
            completedAt: new Date(completedAt).toISOString(),
            queueMs,
            providerTtftMs: providerStartedAt !== null && firstVisibleAt !== null
              ? firstVisibleAt - providerStartedAt : null,
            ttftMs: firstVisibleAt === null ? null : firstVisibleAt - queuedAt,
            reasoningMs: firstReasoningAt !== null && firstVisibleAt !== null
              ? Math.max(0, firstVisibleAt - firstReasoningAt) : null,
            decodeMs: firstVisibleAt !== null && lastVisibleAt !== null
              ? Math.max(0, lastVisibleAt - firstVisibleAt) : null,
            totalMs: Math.max(0, completedAt - queuedAt),
            usage,
            outcome: completedNormally ? "success" : cancelled ? "cancelled" : "failed",
            statusCode: providerError?.status ?? null,
            errorCategory,
            retryCount: requestRetryCount + (usageUnavailableReason === "provider_rejected_stream_usage" ? 1 : 0),
            formatFallbackCount,
            usageUnavailableReason: usage ? null : usageUnavailableReason ?? "provider_did_not_return_usage",
          };
          await analyticsStore.recordTelemetry(telemetry).catch(() => undefined);
        }
      }
    },
  };
}
