// Exposes saved conversation run history; generation and cancellation belong to the project conversation routes.
import type { FastifyInstance } from "fastify";
import type { AuthStore } from "../../auth/in-memory-auth-store.js";
import { requireProjectPermission, isProjectPermissionError } from "../../auth/guards.js";
import { listRunRecordsIfAvailable, refreshRunRecordIfAvailable, type RunRecordStore } from "../../runs/records/run-record-store.js";
import { summarizeRunRecord } from "../../runs/records/run-record-summaries.js";
import { loadProjectRunTokenConsumption } from "../../runs/records/run-token-consumption.js";
import type { RunTelemetryStore } from "../../runs/records/run-telemetry-store.js";

export function registerRunRoutes({ app, authStore, runs, analyticsStore }: {
  app: FastifyInstance; authStore: AuthStore; runs: RunRecordStore; analyticsStore?: RunTelemetryStore;
}) {
  app.get("/api/projects/:projectId/runs", async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const access = await requireProjectPermission(request, reply, authStore, projectId, "view_runs");
    if (isProjectPermissionError(access)) return access;
    const records = (await listRunRecordsIfAvailable(runs, [projectId])).filter(record => record.metadata?.projectId === projectId)
      .sort((a, b) => (b.metadata?.createdAt ?? "").localeCompare(a.metadata?.createdAt ?? ""));
    const usage = await loadProjectRunTokenConsumption({ projectId, records, analyticsStore });
    return { generatedAt: new Date().toISOString(), projectId, runs: records.map(record => summarizeRunRecord(record, usage.get(record.snapshot.runId))) };
  });
  app.get("/api/projects/:projectId/runs/:runId", async (request, reply) => {
    const { projectId, runId } = request.params as { projectId: string; runId: string };
    const access = await requireProjectPermission(request, reply, authStore, projectId, "view_runs");
    if (isProjectPermissionError(access)) return access;
    const record = await refreshRunRecordIfAvailable(runs, runId, { events: "none" });
    if (!record || record.metadata?.projectId !== projectId) return reply.code(404).send({ message: "任务不存在" });
    const usage = await loadProjectRunTokenConsumption({ projectId, records: [record], analyticsStore });
    return { projectId, run: summarizeRunRecord(record, usage.get(runId)), snapshot: record.snapshot };
  });
  app.delete("/api/projects/:projectId/runs/:runId", async (request, reply) => {
    const { projectId, runId } = request.params as { projectId: string; runId: string };
    const access = await requireProjectPermission(request, reply, authStore, projectId, "start_runs");
    if (isProjectPermissionError(access)) return access;
    const record = await refreshRunRecordIfAvailable(runs, runId, { events: "none" });
    if (!record || record.metadata?.projectId !== projectId) return reply.code(404).send({ message: "任务不存在" });
    if (!record.terminal) return reply.code(409).send({ message: "请先停止当前任务" });
    runs.delete(runId);
    return reply.code(204).send();
  });
}
