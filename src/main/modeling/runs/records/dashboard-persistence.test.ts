// Reads persisted conversation metadata for authorized projects without hydrating full snapshots.
import assert from "node:assert/strict";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import type { Queryable } from "../../db/transactions.js";
import { createPostgresRunRecordStore } from "./postgres-run-record-store.js";
import { createEmptySnapshot } from "./snapshots.js";
test("dashboard reads current persisted conversations without hydrating snapshots", async t => {
  const db = new PGlite(); t.after(() => db.close());
  await db.exec(`create table run_records (id text primary key, user_id text, project_id text, source_run_id text, source_action text, source_run_status text, snapshot jsonb, status text, stage text, model text, provider_config_id text, error_message text, error jsonb, error_code text, created_at timestamptz, completed_at timestamptz); create table run_events (run_id text, sequence integer, payload jsonb, created_at timestamptz);`);
  const store = await createPostgresRunRecordStore(db as unknown as Queryable);
  for (const project of ["visible", "private"]) {
    const snapshot = { ...createEmptySnapshot(project), standardRun: { operation: "chat", providerConfigId: "provider", model: "model-a", baseline: {}, artifacts: [] } };
    await db.query("insert into run_records(id,project_id,snapshot,status,stage,model,created_at,completed_at) values($1,$1,$2,'completed','queued','model-a','2026-10-01T00:00:00Z','2026-10-01T00:03:00Z')", [project, JSON.stringify(snapshot)]);
  }
  const rows = await store.listDashboardRuns!(["visible"]);
  assert.equal(rows.length, 1); assert.equal(rows[0].projectId, "visible"); assert.equal(rows[0].runKind, "requirements");
  assert.equal(rows[0].startedAt, "2026-10-01T00:00:00.000Z"); assert.equal(rows[0].completedAt, "2026-10-01T00:03:00.000Z");
  assert.deepEqual(rows[0].artifactTimings, []); assert.equal(store.size, 0);
});
