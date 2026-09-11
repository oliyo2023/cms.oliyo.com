import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import { getDb } from "./db";
import { schema } from "./schema";

export type Db = DrizzleD1Database<typeof schema>;

export function db(): Db {
  return drizzle(getDb(), { schema });
}
