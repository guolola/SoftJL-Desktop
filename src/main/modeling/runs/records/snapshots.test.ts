// Initializes only the current project conversation history envelope.
import test from "node:test";
import assert from "node:assert/strict";
import { createEmptySnapshot } from "./snapshots.js";
test("new conversation history has no engineering inputs", () => {
  const value = createEmptySnapshot("run");
  assert.equal(value.operationType, "quick_modeling"); assert.equal(value.status, "queued");
  for (const field of ["rules", "models", "requirementBaseline", "designModelTraceability", "feasibilityInputs"]) assert.equal(Object.hasOwn(value, field), false);
});
