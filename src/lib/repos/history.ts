import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/drizzle";
import { history, type HistoryRow } from "@/lib/schema";

export async function createHistory(entry: {
  ownerId: string;
  kind: HistoryRow["kind"];
  title?: string;
  model?: string;
  input?: string;
  output?: string;
  extra?: Record<string, unknown>;
  status?: HistoryRow["status"];
}): Promise<string> {
  const id = crypto.randomUUID();
  await db().insert(history).values({
    id,
    ownerId: entry.ownerId,
    kind: entry.kind,
    title: entry.title ?? "",
    model: entry.model ?? "",
    input: entry.input ?? "",
    output: entry.output ?? "",
    extra: JSON.stringify(entry.extra ?? {}),
    status: entry.status ?? "done",
    createdAt: Date.now(),
  });
  return id;
}

export async function listHistory(
  ownerId: string,
  opts?: { limit?: number; kind?: HistoryRow["kind"] },
): Promise<HistoryRow[]> {
  const limit = opts?.limit ?? 50;
  const cond = opts?.kind ? and(eq(history.ownerId, ownerId), eq(history.kind, opts.kind)) : eq(history.ownerId, ownerId);
  return db().select().from(history).where(cond).orderBy(desc(history.createdAt)).limit(limit);
}

export async function deleteHistory(id: string, ownerId: string): Promise<void> {
  await db()
    .delete(history)
    .where(and(eq(history.id, id), eq(history.ownerId, ownerId)));
}
