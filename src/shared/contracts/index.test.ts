// Checks the current public facade exposes conversation contracts and excludes retired workflow APIs.
import test from "node:test";
import assert from "node:assert/strict";
import * as contracts from "./index.js";
import { standardModelFixture } from "./testing/standard-model-fixtures.js";
test("the public model surface accepts all eight current conversation models", () => {
  for (const kind of contracts.standardDiagramKinds) assert.equal(contracts.validateStandardModel(kind, standardModelFixture(kind)).diagramKind, kind);
});
test("retired engineering generation, baseline and traceability APIs are absent", () => {
  for (const name of ["startRunRequestSchema", "startDesignRunRequestSchema", "startDocumentRunRequestSchema", "startFeasibilityRunRequestSchema", "designRunSnapshotSchema", "documentRunSnapshotSchema", "feasibilityRunSnapshotSchema", "createRequirementBaselineSnapshot", "buildAcceptedRequirementSnapshot", "invalidateDesignDependents", "projectModeSchema"]) assert.equal(Object.hasOwn(contracts, name), false, name);
});
