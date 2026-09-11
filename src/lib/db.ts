import { getCloudflareContext } from "@opennextjs/cloudflare";
import fs from "node:fs";
import path from "node:path";
import type {
  D1Database,
  D1PreparedStatement,
  D1Result,
  R2Bucket,
} from "@cloudflare/workers-types/experimental";

/**
 * Single data path across runtimes:
 *  - Cloudflare worker (wrangler dev / deployed): real D1 binding.
 *  - `next dev` on Node: node:sqlite file database behind a D1-compatible shim.
 *
 * node:sqlite is a Node-only builtin. It is loaded lazily via createRequire inside
 * the dev branch only — the worker branch returns the real D1 binding before ever
 * touching it, so the module must not be statically imported (bundling would try
 * to externalize it for workerd). Type-only imports are erased at build time.
 */

type SqlValue = string | number | null;

const fakeMeta = {
  duration: 0,
  size_after: 0,
  rows_read: 0,
  rows_written: 0,
  last_row_id: 0,
  changed_db: false,
  changes: 0,
} as unknown as D1Result["meta"];

type RawStmt = {
  all(...params: SqlValue[]): Array<Record<string, unknown>>;
  get(...params: SqlValue[]): Record<string, unknown> | undefined;
  run(...params: SqlValue[]): { changes: number | bigint; lastInsertRowid: number | bigint };
};

type RawDb = {
  exec(sql: string): void;
  prepare(sql: string): RawStmt;
};

type SqliteApi = { DatabaseSync: new (path: string) => RawDb };

function loadSqlite(): SqliteApi {
  // Node-only builtin for the local dev shim; never executed inside workerd
  // (env.DB exists there and the worker branch returns before this runs).
  // process.getBuiltinModule sidesteps bundler static analysis of `node:` imports.
  const mod = process.getBuiltinModule("node:sqlite");
  if (!mod || typeof mod.DatabaseSync !== "function") {
    throw new Error("node:sqlite unavailable — run under Node >= 22.13");
  }
  return mod as unknown as SqliteApi;
}

const num = (v: number | bigint | unknown): number => (typeof v === "bigint" ? Number(v) : (v as number));

class ShimStmt {
  #sql: string;
  #args: SqlValue[] = [];
  #db: ShimDatabase;

  constructor(db: ShimDatabase, sql: string) {
    this.#db = db;
    this.#sql = sql;
  }

  bind(...values: unknown[]): ShimStmt {
    this.#args = values as SqlValue[];
    return this;
  }

  #stmt() {
    return this.#db.raw.prepare(this.#sql);
  }

  async all<T = unknown>(): Promise<D1Result<T>> {
    const rows = this.#stmt().all(...this.#args).map((r) => {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(r)) out[k] = typeof v === "bigint" ? num(v) : v;
      return out;
    });
    return { results: rows as T[], success: true, meta: fakeMeta };
  }

  async first<T = unknown>(colName?: string): Promise<T | null> {
    const row = this.#stmt().get(...this.#args);
    if (row === undefined) return null;
    if (colName !== undefined) {
      const v = row[colName];
      return v === undefined ? null : ((typeof v === "bigint" ? num(v) : v) as T);
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) out[k] = typeof v === "bigint" ? num(v) : v;
    return out as T;
  }

  async run(): Promise<D1Result> {
    const r = this.#stmt().run(...this.#args);
    return { results: [], success: true, meta: fakeMeta };
  }

  /** drizzle's d1 driver reads `.values()` through raw(): row objects → column arrays. */
  async raw<T = unknown>(): Promise<T[]> {
    const rows = this.#stmt().all(...this.#args);
    return rows.map((r) => Object.values(r).map((v) => (typeof v === "bigint" ? num(v) : v))) as T[];
  }
}

class ShimDatabase {
  raw: RawDb;

  constructor(file: string) {
    const DatabaseSync = loadSqlite().DatabaseSync;
    this.raw = new DatabaseSync(file);
  }

  prepare(sql: string): D1PreparedStatement {
    return new ShimStmt(this, sql) as unknown as D1PreparedStatement;
  }

  async batch(statements: D1PreparedStatement[]): Promise<D1Result[]> {
    return Promise.all(statements.map((s) => s.run()));
  }

  async exec(sql: string): Promise<D1Result> {
    this.raw.exec(sql);
    return { results: [], success: true, meta: fakeMeta };
  }
}

let shim: ShimDatabase | null = null;
let workerEnvCache: Record<string, unknown> | null | undefined;

function workerEnv(): Record<string, unknown> | null {
  if (workerEnvCache !== undefined) return workerEnvCache;
  try {
    const env = getCloudflareContext().env as Record<string, unknown>;
    workerEnvCache = env ?? null;
    return workerEnvCache;
  } catch {
    workerEnvCache = null;
    return null;
  }
}

/** D1 (real) when running on Cloudflare, otherwise the local file shim. */
export function getDb(): D1Database {
  const env = workerEnv();
  const real = env?.DB;
  if (real) return real as D1Database;
  if (!shim) {
    const dir = process.env.DEV_DATA_DIR ?? "dev-data";
    fs.mkdirSync(dir, { recursive: true });
    shim = new ShimDatabase(path.join(dir, "dev.db"));
  }
  return shim as unknown as D1Database;
}

/** R2 binding on Cloudflare, else null (dev store module falls back to disk). */
export function getR2(): R2Bucket | null {
  const env = workerEnv();
  return (env?.MEDIA as R2Bucket | undefined) ?? null;
}
