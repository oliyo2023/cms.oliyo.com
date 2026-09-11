import { currentUserFromRequest, fail, json } from "@/lib/api";
import { createSeries, listSeries } from "@/lib/repos/showcase";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await currentUserFromRequest(req);
  if (!user) return fail(401, "未登录");
  return json({ series: await listSeries() });
}

export async function POST(req: Request) {
  const user = await currentUserFromRequest(req);
  if (!user) return fail(401, "未登录");
  let body: { title?: string; description?: string; cover?: string; sort?: number; published?: boolean };
  try {
    body = await req.json();
  } catch {
    return fail(400, "请求格式错误");
  }
  const title = body.title?.trim() ?? "";
  if (!title) return fail(400, "请填写剧集标题");
  const s = await createSeries({
    ownerId: user.id,
    title,
    description: body.description ?? "",
    cover: body.cover ?? "",
    sort: body.sort ?? 0,
    published: body.published ?? true,
  });
  return json({ series: s }, { status: 201 });
}
