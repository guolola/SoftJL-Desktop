// Uses filesystem-backed PostgreSQL and serializes repository operations within the local process.
import { PGlite } from "@electric-sql/pglite";
import { join } from "node:path";
import {
  currentSchemaSql,
  type Queryable,
} from "../../modeling/application/index.js";
const DATABASE_SCHEMA = "desktop-v2";

export async function openDatabase(dataDir: string) {
  // Each incompatible schema starts with its own empty store; old project data is never migrated.
  const directory = join(dataDir, `database-${DATABASE_SCHEMA}`);
  const engine = new PGlite(directory);
  await engine.waitReady;
  let tail = Promise.resolve();
  async function locked<T>(run: () => Promise<T>): Promise<T> {
    const previous = tail;
    let release!: () => void;
    tail = new Promise((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await run();
    } finally {
      release();
    }
  }
  const db: Queryable = {
    async query<T>(sql: string, params?: readonly unknown[]) {
      return locked(async () => {
        const result = await engine.query<T>(sql, params ? [...params] : []);
        return {
          rows: result.rows,
          rowCount: result.affectedRows ?? result.rows.length,
        };
      });
    },
  };
  const tables = await db.query<{ table_name: string }>(
    "select table_name from information_schema.tables where table_schema='public'",
  );
  if (tables.rows.length === 0) {
    await engine.exec(
      "BEGIN;" +
        currentSchemaSql +
        `;CREATE TABLE desktop_metadata(key text primary key,value text not null);INSERT INTO desktop_metadata VALUES('schema','${DATABASE_SCHEMA}');COMMIT;`,
    );
  } else {
    const schema = await db.query<{ value: string }>(
      "select value from desktop_metadata where key='schema'",
    );
    if (schema.rows[0]?.value !== DATABASE_SCHEMA)
      throw new Error("本地数据库版本不兼容，请使用匹配的桌面版本。");
  }
  return { db, engine, close: () => locked(() => engine.close()) };
}
