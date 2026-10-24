// Creates the history envelope for one accepted project conversation command.
import { runSnapshotSchema, type RunSnapshot } from "../../../../shared/contracts/index.js";
export function createEmptySnapshot(runId: string): RunSnapshot {
  return runSnapshotSchema.parse({ runId, operationType: "quick_modeling", outputManifest: [], currentStage: null, status: "queued", error: null });
}
