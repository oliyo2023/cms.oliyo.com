/**
 * Applies ./drizzle/*.sql migrations to the local dev database (dev-data/dev.db).
 * Runs automatically via `predev`; production D1 uses `wrangler d1 migrations apply`.
 */
import fs from "node:fs";
import path from "node:path";

// node:sqlite is Node-only; this script never runs inside the worker.
const mod = process.getBuiltinModule("node:sqlite") as typeof import("node:sqlite");
const { DatabaseSync } = mod;

const dir = process.env.DEV_DATA_DIR ?? "dev-data";
fs.mkdirSync(dir, { recursive: true });
const client = new DatabaseSync(path.join(dir, "dev.db"));

const metaTable = client
  .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='_migrations'")
  .all();
const applied = new Set<string>();
if (metaTable.length === 0) {
  client.exec("CREATE TABLE _migrations (name text PRIMARY KEY, applied_at integer NOT NULL)");
} else {
  for (const r of client.prepare("SELECT name FROM _migrations").all()) applied.add(String(r.name));
}

const migrationDir = path.resolve(process.cwd(), "drizzle");
const files = fs
  .readdirSync(migrationDir)
  .filter((f) => /^\d+_.+\.sql$/.test(f))
  .sort();

for (const f of files) {
  if (applied.has(f)) continue;
  const sql = fs.readFileSync(path.join(migrationDir, f), "utf8");
  client.exec(sql);
  client.prepare("INSERT INTO _migrations (name, applied_at) VALUES (?, ?)").run(f, Date.now());
  console.log(`migrated ${f}`);
}
if (files.length === 0) console.log("no migrations found in drizzle/");
