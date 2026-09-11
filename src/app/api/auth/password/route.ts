import { currentUserFromRequest, fail, json } from "@/lib/api";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { UNUSABLE_PASSWORD, updateUser } from "@/lib/repos/users";

export const dynamic = "force-dynamic";

/**
 * 修改当前登录账户的密码。
 * 纯 OAuth 账户（passHash 为哨兵值、没有本地密码）允许直接设置首个密码——
 * 要求输入「当前密码」对这类账户是无解的，而请求本身已经带着有效会话。
 */
export async function POST(req: Request) {
  const user = await currentUserFromRequest(req);
  if (!user) return fail(401, "未登录");
  let body: { currentPassword?: string; newPassword?: string };
  try {
    body = await req.json();
  } catch {
    return fail(400, "请求格式错误");
  }
  const currentPassword = body.currentPassword ?? "";
  const newPassword = body.newPassword ?? "";
  if (newPassword.length < 8) return fail(400, "新密码至少 8 位");
  if (newPassword === currentPassword) return fail(400, "新密码不能与当前密码相同");

  if (user.passHash !== UNUSABLE_PASSWORD) {
    if (!currentPassword) return fail(400, "请输入当前密码");
    if (!(await verifyPassword(currentPassword, user.passHash))) return fail(403, "当前密码不正确");
  }

  await updateUser(user.id, { passHash: await hashPassword(newPassword) });
  return json({ ok: true });
}
