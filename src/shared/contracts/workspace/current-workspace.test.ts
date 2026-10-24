// Rejects removed engineering workspaces and accepts only current project conversation records.
import assert from "node:assert/strict";
import test from "node:test";
import { assertCurrentWorkspaceState, assertCurrentRunSnapshot } from "./current-workspace.js";
import { createStandardProjectState } from "./standard-project.js";
import { projectCreateRequestSchema } from "./projects.js";
test("accepts current conversation state without rewriting its saved facts", () => {
  const state = { standardProject: createStandardProjectState("图书借阅") }, before = structuredClone(state);
  assertCurrentWorkspaceState(state); assert.deepEqual(state, before);
});
test("rejects every engineering workspace field without migration", () => {
  for (const state of [{ requirementText: "旧需求" }, { models: {} }, { designModels: {} }, { requirementBaseline: null }, { feasibilityInputs: {} }, { engineeringCoding: {} }]) assert.throws(() => assertCurrentWorkspaceState(state));
});
test("new project requests have no mode selector or obsolete mode field", () => {
  assert.equal(projectCreateRequestSchema.safeParse({ name: "项目" }).success, true);
  for (const projectMode of ["standard", "professional"]) assert.equal(projectCreateRequestSchema.safeParse({ name: "项目", projectMode }).success, false);
});
test("run reads require current conversation receipts and reject engineering snapshots", () => {
  const snapshot = { runId: "run", operationType: "quick_modeling", outputManifest: [], currentStage: null, status: "completed", error: null,
    standardRun: { operation: "chat", model: "test", providerConfigId: "provider", baseline: {}, artifacts: [] } };
  assert.doesNotThrow(() => assertCurrentRunSnapshot(snapshot));
  for (const operationType of ["requirement_extraction", "requirement_modeling", "design_modeling", "document_generation", "feasibility_analysis"]) assert.throws(() => assertCurrentRunSnapshot({ ...snapshot, operationType }));
  assert.throws(() => assertCurrentRunSnapshot({ ...snapshot, standardRun: undefined }));
});
