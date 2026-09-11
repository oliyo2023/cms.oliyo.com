import { currentUserFromRequest, fail, json } from "@/lib/api";
import { deleteHistory } from "@/lib/repos/history";

export const dynamic = "force-dynamic";

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUserFromRequest(req);
  if (!user) return fail(401, "未登录");
  const { id } = await ctx.params;
  await deleteHistory(id, user.id);
  return json({ ok: true });
}
