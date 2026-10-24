// Accepts only the current conversation workspace and its recorded run format.
import { z } from "zod";
import { storedStandardProjectStateSchema } from "./standard-project.js";
import { runSnapshotSchema } from "../runs/runs.js";
const workspaceSchema = z.object({ standardProject: storedStandardProjectStateSchema.optional() }).strict();
export function assertCurrentWorkspaceState(value: unknown): asserts value is Record<string, unknown> { workspaceSchema.parse(value); }
export function assertCurrentRunSnapshot(value: unknown): void {
  const snapshot = runSnapshotSchema.parse(value);
  z.literal("quick_modeling").parse(snapshot.operationType);
  if (!snapshot.standardRun) throw new Error("缺少项目会话任务记录");
}
