import { count, type SQL } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import { db } from "@/lib/drizzle";

/** Row count helper shared by list pages. */
export async function countWhere(table: SQLiteTable, cond?: SQL): Promise<number> {
  const rows = await db().select({ n: count() }).from(table).where(cond);
  return rows[0]?.n ?? 0;
}
