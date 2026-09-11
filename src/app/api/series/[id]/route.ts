import { currentUserFromRequest, fail, json } from "@/lib/api";
import { deleteSeries, updateSeries } from "@/lib/repos/showcase";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUserFromRequest(req);
  if (!user) return fail(401, "未登录");
  const { id } = await ctx.params;
  let body: {
    title?: string;
    description?: string;
    cover?: string;
    sort?: number;
    published?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return fail(400, "请求格式错误");
  }
  await updateSeries(id, body);
  return json({ ok: true });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUserFromRequest(req);
  if (!user) return fail(401, "未登录");
  const { id } = await ctx.params;
  await deleteSeries(id);
  return json({ ok: true });
}
