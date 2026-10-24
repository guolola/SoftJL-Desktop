// Projects only explicit operation identity and accepted outputs recorded by current pipelines.
import {
  runOperationTypeSchema,
  runOutputReferenceSchema,
  type RunOperationType,
  type RunOutputReference,
} from "../../../../shared/contracts/index.js";
import type { RunRecord } from "./run-record-store.js";

export function object(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}
function list(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}
export function modelOutputId(model: unknown): string {
  const value = object(model);
  const id = value.modelId ?? value.diagramKind;
  if (typeof id !== "string" || !id.trim()) throw new Error("Current model output identity is required");
  return id;
}
export function operationForSnapshot(value: unknown): RunOperationType {
  return runOperationTypeSchema.exclude(["unknown"]).parse(object(value).operationType);
}

export function acceptRunOutput(snapshot: RunRecord["snapshot"], reference: RunOutputReference) {
  const index = snapshot.outputManifest.findIndex(
    (item) => item.kind === reference.kind && item.id === reference.id,
  );
  if (index < 0) snapshot.outputManifest.push(reference);
  else snapshot.outputManifest[index] = reference;
}

export function acceptOutputEvent(_record: RunRecord, _event: RunRecord["events"][number]) {
  // Conversation artifacts are attributed by syncStandardRunRecord after each durable save.
}
