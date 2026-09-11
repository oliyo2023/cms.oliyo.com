import { currentUserFromRequest, fail, json } from "@/lib/api";
import { htmlToText } from "@/lib/md";
import { deleteArticle, getArticle, updateArticle } from "@/lib/repos/articles";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUserFromRequest(req);
  if (!user) return fail(401, "未登录");
  const { id } = await ctx.params;
  const article = await getArticle(id);
  if (!article) return fail(404, "文章不存在");
  if (article.ownerId !== user.id && user.role !== "admin") return fail(403, "无权操作该文章");

  let body: {
    title?: string;
    summary?: string;
    contentHtml?: string;
    cover?: string;
    status?: "draft" | "published";
  };
  try {
    body = await req.json();
  } catch {
    return fail(400, "请求格式错误");
  }
  const patch: Parameters<typeof updateArticle>[1] = {};
  if (typeof body.title === "string") patch.title = body.title.trim() || article.title;
  if (typeof body.summary === "string") patch.summary = body.summary;
  if (typeof body.cover === "string") patch.cover = body.cover;
  if (typeof body.contentHtml === "string") {
    patch.contentHtml = body.contentHtml;
    patch.plainText = htmlToText(body.contentHtml);
  }
  if (body.status === "draft" || body.status === "published") patch.status = body.status;
  const updated = await updateArticle(id, patch);
  return json({ article: updated });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUserFromRequest(req);
  if (!user) return fail(401, "未登录");
  const { id } = await ctx.params;
  const article = await getArticle(id);
  if (!article) return fail(404, "文章不存在");
  if (article.ownerId !== user.id && user.role !== "admin") return fail(403, "无权操作该文章");
  await deleteArticle(id);
  return json({ ok: true });
}
