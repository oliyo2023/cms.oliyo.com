import { currentUserFromRequest, fail, json } from "@/lib/api";
import { deleteMediaRow } from "@/lib/repos/media";
import { storeDelete } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUserFromRequest(req);
  if (!user) return fail(401, "未登录");
  const { id } = await ctx.params;
  const row = await deleteMediaRow(id, user.id);
  if (!row) return fail(404, "素材不存在");
  await storeDelete(row.key);
  return json({ ok: true });
}
