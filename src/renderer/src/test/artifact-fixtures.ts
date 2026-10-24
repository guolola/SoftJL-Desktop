// Builds complete typed snapshot and render fixtures without mounting the application providers.
import {
  type RunSnapshot,
  type SvgArtifact,
} from "../../../shared/contracts/index.js";

export function createRunSnapshot(overrides: Partial<RunSnapshot> = {}): RunSnapshot {
  return { runId: "run-test", operationType: "quick_modeling", outputManifest: [], currentStage: null, status: "completed", error: null,
    standardRun: { operation: "chat", model: "test", providerConfigId: "provider", baseline: {}, artifacts: [] }, ...overrides };
}

export function createRenderMeta(overrides: Partial<SvgArtifact["renderMeta"]> = {}): SvgArtifact["renderMeta"] {
  return {
    engine: "plantuml", generatedAt: "2026-06-05T00:00:00.000Z", sourceLength: 0, durationMs: 0,
    ...overrides,
  };
}
