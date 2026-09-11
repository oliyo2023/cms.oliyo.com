import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/drizzle";
import { articles, type Article } from "@/lib/schema";

export async function createArticle(data: {
  ownerId: string;
  title: string;
  summary?: string;
  contentHtml?: string;
  plainText?: string;
  cover?: string;
  status?: Article["status"];
}): Promise<Article> {
  const now = Date.now();
  const id = crypto.randomUUID();
  const published = data.status === "published";
  await db().insert(articles).values({
    id,
    ownerId: data.ownerId,
    title: data.title,
    summary: data.summary ?? "",
    contentHtml: data.contentHtml ?? "",
    plainText: data.plainText ?? "",
    cover: data.cover ?? "",
    status: data.status ?? "draft",
    publishedAt: published ? now : null,
    createdAt: now,
    updatedAt: now,
  });
  const row = await getArticle(id);
  if (!row) throw new Error("article insert failed");
  return row;
}

export async function getArticle(id: string): Promise<Article | null> {
  const rows = await db().select().from(articles).where(eq(articles.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function listArticles(opts: {
  ownerId?: string;
  status?: Article["status"];
  limit?: number;
}): Promise<Article[]> {
  const conds = [];
  if (opts.ownerId) conds.push(eq(articles.ownerId, opts.ownerId));
  if (opts.status) conds.push(eq(articles.status, opts.status));
  const where = conds.length ? and(...conds) : undefined;
  return db()
    .select()
    .from(articles)
    .where(where)
    .orderBy(desc(articles.updatedAt))
    .limit(opts.limit ?? 100);
}

export async function updateArticle(
  id: string,
  patch: Partial<{
    title: string;
    summary: string;
    contentHtml: string;
    plainText: string;
    cover: string;
    status: Article["status"];
  }>,
): Promise<Article | null> {
  const existing = await getArticle(id);
  if (!existing) return null;
  const willPublish = patch.status === "published" && existing.status !== "published";
  const willUnpublish = patch.status !== undefined && patch.status !== "published" && existing.status === "published";
  await db()
    .update(articles)
    .set({
      ...patch,
      updatedAt: Date.now(),
      ...(willPublish ? { publishedAt: Date.now() } : {}),
      ...(willUnpublish ? { publishedAt: null } : {}),
    })
    .where(eq(articles.id, id));
  return getArticle(id);
}

export async function deleteArticle(id: string): Promise<void> {
  await db().delete(articles).where(eq(articles.id, id));
}

/** Public site: published articles, newest first. */
export async function listPublishedArticles(limit = 60): Promise<Article[]> {
  return db()
    .select()
    .from(articles)
    .where(eq(articles.status, "published"))
    .orderBy(desc(articles.publishedAt))
    .limit(limit);
}
