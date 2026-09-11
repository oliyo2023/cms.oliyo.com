import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/drizzle";
import { media, type MediaRow } from "@/lib/schema";

export async function createMediaRow(data: {
  ownerId: string;
  key: string;
  name: string;
  kind: MediaRow["kind"];
  mime: string;
  size: number;
  width?: number | null;
  height?: number | null;
}): Promise<MediaRow> {
  const id = crypto.randomUUID();
  await db().insert(media).values({
    id,
    ownerId: data.ownerId,
    key: data.key,
    name: data.name,
    kind: data.kind,
    mime: data.mime,
    size: data.size,
    width: data.width ?? null,
    height: data.height ?? null,
    createdAt: Date.now(),
  });
  const rows = await db().select().from(media).where(eq(media.id, id)).limit(1);
  if (!rows[0]) throw new Error("media insert failed");
  return rows[0];
}

export async function listMedia(ownerId: string, opts?: { kind?: MediaRow["kind"]; limit?: number }): Promise<MediaRow[]> {
  const cond = opts?.kind ? and(eq(media.ownerId, ownerId), eq(media.kind, opts.kind)) : eq(media.ownerId, ownerId);
  return db()
    .select()
    .from(media)
    .where(cond)
    .orderBy(desc(media.createdAt))
    .limit(opts?.limit ?? 100);
}

export async function deleteMediaRow(id: string, ownerId: string): Promise<MediaRow | null> {
  const rows = await db().select().from(media).where(eq(media.id, id)).limit(1);
  const row = rows[0];
  if (!row || row.ownerId !== ownerId) return null;
  await db().delete(media).where(eq(media.id, id));
  return row;
}
