import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/drizzle";
import { series, showcaseItems, type Series, type ShowcaseItem } from "@/lib/schema";

export type Category = ShowcaseItem["category"];

export async function createSeries(data: {
  ownerId: string;
  title: string;
  description?: string;
  cover?: string;
  sort?: number;
  published?: boolean;
}): Promise<Series> {
  const id = crypto.randomUUID();
  await db().insert(series).values({
    id,
    ownerId: data.ownerId,
    title: data.title,
    description: data.description ?? "",
    cover: data.cover ?? "",
    sort: data.sort ?? 0,
    published: data.published ?? true,
    createdAt: Date.now(),
  });
  const rows = await db().select().from(series).where(eq(series.id, id)).limit(1);
  if (!rows[0]) throw new Error("series insert failed");
  return rows[0];
}

export async function listSeries(ownerId?: string): Promise<Series[]> {
  const cond = ownerId ? eq(series.ownerId, ownerId) : undefined;
  return db().select().from(series).where(cond).orderBy(desc(series.createdAt));
}

export async function listPublicSeries(): Promise<Series[]> {
  return db()
    .select()
    .from(series)
    .where(eq(series.published, true))
    .orderBy(asc(series.sort), desc(series.createdAt));
}

export async function updateSeries(
  id: string,
  patch: Partial<Pick<Series, "title" | "description" | "cover" | "sort" | "published">>,
): Promise<void> {
  await db().update(series).set(patch).where(eq(series.id, id));
}

export async function deleteSeries(id: string): Promise<void> {
  await db().delete(series).where(eq(series.id, id));
  await db().delete(showcaseItems).where(eq(showcaseItems.seriesId, id));
}

// ---------- showcase items ----------

export async function createShowcaseItem(data: {
  category: Category;
  title: string;
  description?: string;
  media?: string;
  thumb?: string;
  seriesId?: string | null;
  sort?: number;
  published?: boolean;
}): Promise<ShowcaseItem> {
  const id = crypto.randomUUID();
  await db().insert(showcaseItems).values({
    id,
    category: data.category,
    title: data.title,
    description: data.description ?? "",
    media: data.media ?? "",
    thumb: data.thumb ?? "",
    seriesId: data.seriesId ?? null,
    sort: data.sort ?? 0,
    published: data.published ?? true,
    createdAt: Date.now(),
  });
  const rows = await db().select().from(showcaseItems).where(eq(showcaseItems.id, id)).limit(1);
  if (!rows[0]) throw new Error("showcase item insert failed");
  return rows[0];
}

export async function listShowcaseItems(opts: {
  category?: Category;
  seriesId?: string;
  publishedOnly?: boolean;
  ownerId?: string;
}): Promise<ShowcaseItem[]> {
  const conds = [];
  if (opts.category) conds.push(eq(showcaseItems.category, opts.category));
  if (opts.seriesId) conds.push(eq(showcaseItems.seriesId, opts.seriesId));
  if (opts.publishedOnly) conds.push(eq(showcaseItems.published, true));
  const cond = conds.length ? and(...conds) : undefined;
  return db()
    .select()
    .from(showcaseItems)
    .where(cond)
    .orderBy(asc(showcaseItems.sort), desc(showcaseItems.createdAt))
    .limit(300);
}

export async function getShowcaseItem(id: string): Promise<ShowcaseItem | null> {
  const rows = await db().select().from(showcaseItems).where(eq(showcaseItems.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function updateShowcaseItem(
  id: string,
  patch: Partial<
    Pick<
      ShowcaseItem,
      "category" | "title" | "description" | "media" | "thumb" | "seriesId" | "sort" | "published"
    >
  >,
): Promise<void> {
  await db().update(showcaseItems).set(patch).where(eq(showcaseItems.id, id));
}

export async function deleteShowcaseItem(id: string): Promise<void> {
  await db().delete(showcaseItems).where(eq(showcaseItems.id, id));
}

export async function seriesWithEpisodeCount(): Promise<Array<Series & { episodeCount: number }>> {
  const rows = await db()
    .select({
      series: series,
      episodeCount: sql<number>`count(${showcaseItems.id})`,
    })
    .from(series)
    .leftJoin(showcaseItems, eq(showcaseItems.seriesId, series.id))
    .groupBy(series.id)
    .orderBy(desc(series.createdAt));
  return rows.map((r) => ({ ...r.series, episodeCount: Number(r.episodeCount ?? 0) }));
}
