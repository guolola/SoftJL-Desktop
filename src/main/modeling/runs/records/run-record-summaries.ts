// Projects accepted conversation runs into history metadata without exposing Pi session state.
import { runOperationTypeSchema, type RunTokenConsumption } from "../../../../shared/contracts/index.js";
import type { RunRecord } from "./run-record-store.js";
export function queryValue(query: unknown, key: string) {
  const value = query && typeof query === "object" ? (query as Record<string, unknown>)[key] : undefined;
  return typeof value === "string" && value.trim() ? value : undefined;
}
export function summarizeRunRecord(record: RunRecord, tokenConsumption?: RunTokenConsumption) {
  const snapshot = record.snapshot, run = snapshot.standardRun;
  const createdAt = record.metadata?.createdAt ?? new Date().toISOString();
  const completedAt = record.metadata?.completedAt ?? null;
  const status = record.terminal && ["queued", "running"].includes(snapshot.status) ? "interrupted" : snapshot.status;
  return { runId: snapshot.runId, projectId: record.metadata?.projectId ?? null, status,
    stage: snapshot.currentStage ?? status, currentStage: snapshot.currentStage, error: snapshot.error,
    errorMessage: snapshot.error?.message ?? null, model: run?.model ?? record.metadata?.model ?? null,
    operationType: runOperationTypeSchema.exclude(["unknown"]).parse(snapshot.operationType), runKind: run?.operation.endsWith("Spec") ? "document" : "requirements",
    createdByUserId: record.metadata?.userId ?? null, startedAt: createdAt, createdAt, completedAt,
    updatedAt: completedAt ?? createdAt, metadata: record.metadata ?? null,
    eventCount: record.persistedEventCount ?? record.events.length, terminal: record.terminal,
    snapshotAvailable: true, documentDownloadAvailable: false,
    ...(tokenConsumption ? { tokenConsumption } : {}),
  };
}
export function projectRecordMatchesFilters(record: RunRecord, query: unknown) {
  const status = queryValue(query, "status"), userId = queryValue(query, "userId"), model = queryValue(query, "model");
  return (!status || record.snapshot.status === status) && (!userId || record.metadata?.userId === userId)
    && (!model || record.snapshot.standardRun?.model === model);
}
