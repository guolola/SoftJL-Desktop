// Owns run request, snapshot, event, and action contracts shared by API pipelines and web clients.
import { z } from "zod";
import {
umlDiagramKindSchema
} from "../requirements/requirements.js";
import { MAX_GENERATION_REPAIR_ATTEMPTS } from "./generation-policy.js";
import { runOutputFields } from "./run-outputs.js";


// Whole-run consumption sums provider-reported calls across every stage, including repairs and failures.
export const runTokenConsumptionSchema = z.object({
  totalTokens: z.number().finite().nonnegative().nullable(),
  inputTokens: z.number().finite().nonnegative().nullable(),
  outputTokens: z.number().finite().nonnegative().nullable(),
  cachedInputTokens: z.number().finite().nonnegative().nullable(),
  reasoningTokens: z.number().finite().nonnegative().nullable(),
  calls: z.number().int().nonnegative(),
  unreportedCalls: z.number().int().nonnegative(),
});
export type RunTokenConsumption = z.infer<typeof runTokenConsumptionSchema>;

export const runStageSchema = z.enum([
  "extract_rules",
  "generate_models",
  "generate_design_sequence",
  "generate_design_models",
  "generate_tests",


  "generate_document_text",
  "render_document_file",
  "generate_plantuml",
  "render_svg",
  "verify_diagram_visual",
  "generate_context",
  "generate_business_flow",
  "render_business_flow",
  "render_context",
  "generate_implementation",
]);
export type RunStage = z.infer<typeof runStageSchema>;

export const runStatusSchema = z.enum([
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
]);
export type RunStatus = z.infer<typeof runStatusSchema>;

export const runErrorCodeSchema = z.enum([
  "USER_ENTITLEMENT_REQUIRED",
  "USER_ENTITLEMENT_NEGATIVE_BALANCE",
  "PLATFORM_PROVIDER_BALANCE_INSUFFICIENT",
  "PLATFORM_PROVIDER_AUTH_FAILED",
  "PLATFORM_PROVIDER_RATE_LIMITED",
  "PLATFORM_PROVIDER_UNAVAILABLE",
  "PLATFORM_PROVIDER_TIMEOUT",
  "RUN_MODEL_OUTPUT_EMPTY",
  "RUN_REQUIREMENT_INPUT_UNSAFE",
  "RUN_REQUIREMENT_INPUT_IRRELEVANT",
  "RUN_REQUIREMENT_SCREENING_FAILED",
  "RUN_REQUIREMENT_RULES_EMPTY",
  "RUN_STRUCTURED_OUTPUT_INVALID",
  "RUN_DEPENDENCY_MISSING",
  "RUN_CONTEXT_LIMIT_EXCEEDED",
  "RUN_RENDER_FAILED",
  "RUN_CANCELLED",
  "RUN_INTERNAL_ERROR",
]);
export type RunErrorCode = z.infer<typeof runErrorCodeSchema>;

export const runErrorCategorySchema = z.enum([
  "user_entitlement",
  "platform_provider",
  "generation",
  "render",
  "access",
  "internal",
]);
export type RunErrorCategory = z.infer<typeof runErrorCategorySchema>;

export const runErrorSchema = z.object({
  code: runErrorCodeSchema,
  message: z.string().min(1),
  category: runErrorCategorySchema,
  retryable: z.boolean(),
  params: z.record(
    z.string().min(1),
    z.union([z.string(), z.number(), z.boolean(), z.null()]),
  ).optional(),
  details: z.record(z.string().min(1), z.unknown()).optional(),
});
export type RunError = z.infer<typeof runErrorSchema>;

// Quick turns share the durable run lifecycle, but retain only their own safe output projection.
const standardRunRecordSchema = z.object({
  operation: z.string().min(1),
  providerConfigId: z.string().min(1), model: z.string().min(1),
  baseline: z.record(z.string()),
  artifacts: z.array(z.object({
    id: z.string(), type: z.string(), title: z.string(),
    diagramKind: z.string().optional(), modelId: z.string().optional(),
    sourceLength: z.number().nonnegative().optional(),
    previewAvailable: z.boolean(), svg: z.string().optional(),
  })),
});

export const runSnapshotSchema = z.object({
  standardRun: standardRunRecordSchema.optional(), ...runOutputFields,
  runId: z.string().min(1), currentStage: runStageSchema.nullable(), status: runStatusSchema, error: runErrorSchema.nullable(),
}).strict();
export type RunSnapshot = z.infer<typeof runSnapshotSchema>;

export const queuedRunEventSchema = z.object({
  type: z.literal("queued"),
  queuePosition: z.number().int().min(0).optional(),
  queueAhead: z.number().int().min(0).optional(),
  waitMs: z.number().int().min(0).optional(),
  estimatedWaitMs: z.number().int().min(0).optional(),
  queueReason: z.enum(["global", "provider", "project", "user", "run"]).optional(),
});

export const stageStartedRunEventSchema = z.object({
  type: z.literal("stage_started"),
  stage: runStageSchema,
});

// A pipeline boundary, not the end of an individual parallel model call.
export const stageFinishedRunEventSchema = z.object({
  type: z.literal("stage_finished"),
  stage: runStageSchema,
  status: z.enum(["completed", "failed", "cancelled", "pending_review"]),
});

export const llmChunkRunEventSchema = z.object({
  type: z.literal("llm_chunk"),
  stage: runStageSchema,
  chunk: z.string(),
});

export const stageProgressRunEventSchema = z.object({
  type: z.literal("stage_progress"),
  stage: runStageSchema,
  progress: z.number().min(0).max(100),
  message: z.string().optional(),
  error: runErrorSchema.optional(),
  diagramKind: umlDiagramKindSchema.optional(),
  modelId: z.string().min(1).optional(),
  subtaskId: z.string().min(1).optional(),
  subtaskLabel: z.string().min(1).optional(),
  subtaskStatus: z
    .enum([
      "queued",
      "running",
      "repairing",
      "rendering",
      "completed",
      "failed",
      "pending_review",
    ])
    .optional(),
  parallelGroup: z.string().min(1).optional(),
  queuePosition: z.number().int().min(0).optional(),
  queueAhead: z.number().int().min(0).optional(),
  waitMs: z.number().int().min(0).optional(),
  estimatedWaitMs: z.number().int().min(0).optional(),
  queueReason: z.enum(["global", "provider", "project", "user", "run"]).optional(),
});

export const artifactReadyRunEventSchema = z.object({ type: z.literal("artifact_ready"),
  artifactKind: z.enum(["model", "document", "test"]), modelId: z.string().optional(), diagramKind: z.string().optional(),
});

export const completedRunEventSchema = z.object({ type: z.literal("completed"), previewCount: z.number().int().nonnegative().optional(), snapshot: runSnapshotSchema });

export const failedRunEventSchema = z.object({
  type: z.literal("failed"),
  stage: runStageSchema.optional(),
  error: runErrorSchema,
});

export const cancelledRunEventSchema = z.object({
  type: z.literal("cancelled"),
  stage: runStageSchema.optional(),
  message: z.string().min(1),
});

export const runActionSchema = z.enum(["cancel", "retry", "rerun"]);
export type RunAction = z.infer<typeof runActionSchema>;

export const runActionRunEventSchema = z.object({
  type: z.literal("run_action"),
  action: runActionSchema,
  sourceRunId: z.string().min(1),
  newRunId: z.string().min(1).optional(),
  actorUserId: z.string().min(1).optional(),
  createdAt: z.string().min(1),
});

// Images belong to the exact model call that consumed them, including during replay.
export const runInputImageSchema = z.object({
  url: z.string().min(1),
  caption: z.string().optional(),
});
export type RunInputImage = z.infer<typeof runInputImageSchema>;

// Size diagnostics contain counts only; provider token usage remains the billing source of truth.
export const runInputMetricsSchema = z.object({
  unit: z.literal("utf16-characters"),
  messages: z.number().int().nonnegative(),
  responseFormat: z.number().int().nonnegative(),
  sections: z.record(z.number().int().nonnegative()),
  repair: z.object({ targetId: z.string(), mode: z.string(), baseFingerprint: z.string(), paths: z.array(z.string()), round: z.number().int().min(1).max(MAX_GENERATION_REPAIR_ATTEMPTS), reason: z.string().optional() }).optional(),
});
export type RunInputMetrics = z.infer<typeof runInputMetricsSchema>;

// User-visible execution records are separate from bounded technical diagnostics.
export const runActivityEventSchema = z.object({
  type: z.literal("run_activity"),
  eventId: z.string().min(1),
  createdAt: z.string().datetime(),
  runId: z.string().min(1),
  stage: runStageSchema,
  callId: z.string().min(1),
  modelId: z.string().optional(),
  operation: z.enum(["structure_check", "visual_check", "model_repair", "render_repair"]).optional(),
  round: z.number().int().min(0).max(MAX_GENERATION_REPAIR_ATTEMPTS).optional(),
  subtaskId: z.string().optional(),
  subtaskLabel: z.string().optional(),
  phase: z.enum(["started", "output", "thinking", "reasoning", "summary", "completed", "failed"]),
  format: z.enum(["text", "technical"]).default("technical"),
  text: z.string().optional(),
  inputImages: z.array(runInputImageSchema).optional(),
  inputMetrics: runInputMetricsSchema.optional(),
});
export type RunActivityEvent = z.infer<typeof runActivityEventSchema>;

// Pipelines supply new event inputs; publication assigns the required replay identity once.
export type RunEventInput = { eventId?: string; createdAt?: string; sequence?: number } & (
  | RunActivityEvent
  | z.infer<typeof queuedRunEventSchema>
  | z.infer<typeof stageStartedRunEventSchema>
  | z.infer<typeof stageFinishedRunEventSchema>
  | z.infer<typeof llmChunkRunEventSchema>
  | z.infer<typeof stageProgressRunEventSchema>
  | z.infer<typeof artifactReadyRunEventSchema>
  |  z.infer<typeof completedRunEventSchema>
  | z.infer<typeof failedRunEventSchema>
  | z.infer<typeof cancelledRunEventSchema>
  | z.infer<typeof runActionRunEventSchema>);

export const runEventMetadataSchema = z.object({
  eventId: z.string().min(1),
  createdAt: z.string().datetime(),
  sequence: z.number().int().positive().optional(),
});
export type RunEvent = RunEventInput & z.infer<typeof runEventMetadataSchema>;

export const runEventSchema: z.ZodType<RunEvent, z.ZodTypeDef, unknown> = z.discriminatedUnion("type", [
  runActivityEventSchema,
  queuedRunEventSchema,
  stageStartedRunEventSchema,
  stageFinishedRunEventSchema,
  llmChunkRunEventSchema,
  stageProgressRunEventSchema,
  artifactReadyRunEventSchema,

  completedRunEventSchema,
  failedRunEventSchema,
  cancelledRunEventSchema,
  runActionRunEventSchema,
]).and(runEventMetadataSchema);
