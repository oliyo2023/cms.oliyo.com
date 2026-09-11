import { currentUserFromRequest, fail, json } from "@/lib/api";
import { htmlToText } from "@/lib/md";
import { createArticle, listArticles } from "@/lib/repos/articles";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await currentUserFromRequest(req);
  if (!user) return fail(401, "未登录");
  const url = new URL(req.url);
  const all = url.searchParams.get("all") === "1";
  const status = url.searchParams.get("status") === "published" ? "published" : undefined;
  const list = await listArticles({
    ...(user.role === "admin" && all ? {} : { ownerId: user.id }),
    ...(status ? { status } : {}),
    limit: 200,
  });
  return json({ articles: list });
}

export async function POST(req: Request) {
  const user = await currentUserFromRequest(req);
  if (!user) return fail(401, "未登录");
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
  const title = body.title?.trim() ?? "";
  if (!title) return fail(400, "请填写标题");
  const contentHtml = body.contentHtml ?? "";
  const article = await createArticle({
    ownerId: user.id,
    title,
    summary: body.summary ?? "",
    contentHtml,
    plainText: htmlToText(contentHtml),
    cover: body.cover ?? "",
    status: body.status ?? "draft",
  });
  return json({ article }, { status: 201 });
}
