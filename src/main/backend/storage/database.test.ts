// Verifies incompatible desktop data is left behind while the new schema persists independently.
import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { openDatabase } from "./database.js";

test("starts a fresh database alongside the retired store and reuses the new database on restart", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "softjl-database-"));
  let storage: Awaited<ReturnType<typeof openDatabase>> | undefined;
  try {
    const previous = new PGlite(join(dataDir, "database"));
    await previous.waitReady;
    await previous.exec("CREATE TABLE desktop_metadata(key text primary key, value text not null); INSERT INTO desktop_metadata VALUES('schema', 'desktop-v1'); CREATE TABLE retired_project(name text); INSERT INTO retired_project VALUES('old project');");
    await previous.close();

    storage = await openDatabase(dataDir);
    assert.deepEqual((await storage.db.query("select id from projects")).rows, []);
    assert.deepEqual((await storage.db.query("select value from desktop_metadata where key='schema'")).rows, [{ value: "desktop-v2" }]);
    await storage.db.query("CREATE TABLE persistence_check(value text)");
    await storage.db.query("INSERT INTO persistence_check VALUES('new data')");
    await storage.close();
    storage = await openDatabase(dataDir);
    assert.deepEqual((await storage.db.query("select value from persistence_check")).rows, [{ value: "new data" }]);
    const oldStore = new PGlite(join(dataDir, "database"));
    try {
      await oldStore.waitReady;
      assert.deepEqual((await oldStore.query("select name from retired_project")).rows, [{ name: "old project" }]);
    } finally { await oldStore.close(); }
  } finally {
    await storage?.close();
    await rm(dataDir, { recursive: true, force: true });
  }
});
