// Labels history for the single project conversation workflow.
import type { PlatformRunSummary } from "../services/platform-api.js";
export const HISTORY_OPERATIONS = ["quick"] as const;
export type HistoryOperation = typeof HISTORY_OPERATIONS[number];
export function getHistoryOperation(run: PlatformRunSummary): HistoryOperation | null {
  return run.operationType === "quick_modeling" ? "quick" : null;
}
