// Counts current conversation outputs without retired engineering stages or task-success inference.
import test from "node:test";
import assert from "node:assert/strict";
import { buildDashboardProgress } from "./dashboard-progress.js";
import { createStandardProjectState, standardDiagramKinds } from "../../../../shared/contracts/index.js";
import { standardModelFixture } from "../../../../shared/contracts/testing/index.js";
test("empty projects expose only the eight models and two specifications", () => {
  const progress = buildDashboardProgress({}, []);
  assert.equal(progress.total, 10); assert.equal(progress.completed, 0);
  assert.deepEqual(progress.stages.map(item => [item.kind, item.total]), [["requirements", 3], ["design", 5], ["document", 2]]);
});
test("counts each completed conversation model type once and requires a saved model and preview", () => {
  const state = createStandardProjectState();
  state.diagrams.first = { id: "first", kind: "activity", title: "借阅", status: "completed", model: standardModelFixture("activity"), svg: "<svg/>" };
  state.diagrams.second = { ...state.diagrams.first, id: "second" };
  state.diagrams.failed = { id: "failed", kind: "class", title: "类", status: "failed", model: standardModelFixture("class"), svg: "<svg/>" };
  state.diagrams.missing = { id: "missing", kind: "usecase", title: "用例", status: "completed" };
  assert.equal(buildDashboardProgress({ standardProject: state }, []).completed, 1);
  assert.equal(buildDashboardProgress({ models: { class: {} }, designModels: { class: {} } }, []).completed, 0);
});
test("all current outputs reach full progress while deleted documents do not count", () => {
  const state = createStandardProjectState();
  for (const kind of standardDiagramKinds) state.diagrams[kind] = { id: kind, kind, title: kind, status: "completed", model: standardModelFixture(kind), svg: "<svg/>" };
  const docs = [{ documentKind: "requirementsSpec" as const, status: "active" as const }, { documentKind: "softwareDesignSpec" as const, status: "active" as const }];
  assert.equal(buildDashboardProgress({ standardProject: state }, docs).percentage, 100);
  assert.equal(buildDashboardProgress({ standardProject: state }, docs.map(item => ({ ...item, status: "deleted" as const }))).completed, 8);
});
