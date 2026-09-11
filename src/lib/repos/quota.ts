import { eq, sql, sum } from "drizzle-orm";
import { db } from "@/lib/drizzle";
import { usageEvents } from "@/lib/schema";

export type QuotaMetric = "text_chars" | "rewrite_chars" | "images" | "videos" | "media_bytes";

const MONTH_MS = 30 * 24 * 3600 * 1000;

/** Current calendar month window start (ms epoch). Usage resets monthly. */
export function monthWindow(): { start: number; end: number } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  return { start, end: now.getTime() };
}

export async function usageThisMonth(userId: string, metric: QuotaMetric): Promise<number> {
  const { start } = monthWindow();
  const rows = await db()
    .select({ total: sql<number>`coalesce(sum(${usageEvents.amount}), 0)` })
    .from(usageEvents)
    .where(
      sql`${usageEvents.userId} = ${userId} AND ${usageEvents.metric} = ${metric} AND ${usageEvents.createdAt} >= ${start}`,
    );
  return Number(rows[0]?.total ?? 0);
}

export async function recordUsage(userId: string, metric: QuotaMetric, amount: number): Promise<void> {
  await db().insert(usageEvents).values({
    id: crypto.randomUUID(),
    userId,
    metric,
    amount,
    createdAt: Date.now(),
  });
}

export async function recentUsageByUser(userId: string, limit = 50): Promise<typeof usageEvents.$inferSelect[]> {
  return db()
    .select()
    .from(usageEvents)
    .where(eq(usageEvents.userId, userId))
    .orderBy(sql`${usageEvents.createdAt} desc`)
    .limit(limit);
}

/** Bytes staged into R2 this month, to pair with quota_media bytes. */
export async function mediaBytesThisMonth(userId: string): Promise<number> {
  return usageThisMonth(userId, "media_bytes");
}

export { sum };
