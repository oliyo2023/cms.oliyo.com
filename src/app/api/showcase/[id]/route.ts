import { currentUserFromRequest, fail, json } from "@/lib/api";
import {
  deleteShowcaseItem,
  getShowcaseItem,
  updateShowcaseItem,
} from "@/lib/repos/showcase";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUserFromRequest(req);
  if (!user) return fail(401, "未登录");
  const { id } = await ctx.params;
  const existing = await getShowcaseItem(id);
  if (!existing) return fail(404, "条目不存在");
  let body: {
    title?: string;
    description?: string;
    media?: string;
    thumb?: string;
    shots?: string;
    seriesId?: string | null;
    sort?: number;
    published?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return fail(400, "请求格式错误");
  }
  await updateShowcaseItem(id, body);
  return json({ ok: true });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUserFromRequest(req);
  if (!user) return fail(401, "未登录");
  const { id } = await ctx.params;
  const existing = await getShowcaseItem(id);
  if (!existing) return fail(404, "条目不存在");
  await deleteShowcaseItem(id);
  return json({ ok: true });
}
