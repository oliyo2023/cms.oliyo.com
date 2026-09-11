import { fail, json, requireAdmin } from "@/lib/api";
import { hashPassword } from "@/lib/auth";
import { getById, updateUser } from "@/lib/repos/users";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req);
  const { id } = await ctx.params;
  const user = await getById(id);
  if (!user) return fail(404, "用户不存在");
  let body: {
    name?: string;
    role?: "admin" | "user";
    password?: string;
    quotaTextChars?: number;
    quotaImages?: number;
    quotaVideos?: number;
    quotaRewriteChars?: number;
  };
  try {
    body = await req.json();
  } catch {
    return fail(400, "请求格式错误");
  }
  if (body.role === "user" && id === admin.id) return fail(400, "不能取消自己的管理员");
  const patch: Parameters<typeof updateUser>[1] = {};
  if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim();
  if (body.role === "admin" || body.role === "user") patch.role = body.role;
  if (typeof body.password === "string" && body.password.length >= 8) {
    patch.passHash = await hashPassword(body.password);
  }
  for (const key of ["quotaTextChars", "quotaImages", "quotaVideos", "quotaRewriteChars"] as const) {
    const v = body[key];
    if (typeof v === "number" && Number.isInteger(v)) patch[key] = v;
  }
  await updateUser(id, patch);
  return json({ ok: true });
}
