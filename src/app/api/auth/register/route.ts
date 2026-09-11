import { fail, json } from "@/lib/api";
import { cookieHeader, hashPassword, newId, newToken, sha256Hex, SESSION_TTL_MS } from "@/lib/auth";
import { getVar, isVarTruthy } from "@/lib/config";
import { createSession, createUser, getByEmail } from "@/lib/repos/users";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  if (!isVarTruthy(getVar("REGISTRATION_OPEN"))) return fail(403, "暂未开放注册，请联系管理员开通账号");
  let body: { email?: string; name?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return fail(400, "请求格式错误");
  }
  const email = body.email?.trim().toLowerCase() ?? "";
  const name = body.name?.trim() ?? "";
  const password = body.password ?? "";
  if (!EMAIL_RE.test(email)) return fail(400, "邮箱格式不正确");
  if (name.length < 2 || name.length > 40) return fail(400, "昵称需 2-40 字");
  if (password.length < 8) return fail(400, "密码至少 8 位");
  if (await getByEmail(email)) return fail(409, "该邮箱已注册");

  const user = await createUser({
    id: newId(),
    email,
    name,
    passHash: await hashPassword(password),
    role: "user",
    quotaTextChars: Number(getVar("NEW_USER_TEXT_QUOTA") ?? 100000),
    quotaImages: Number(getVar("NEW_USER_IMAGE_QUOTA") ?? 30),
    quotaVideos: Number(getVar("NEW_USER_VIDEO_QUOTA") ?? 10),
    quotaRewriteChars: Number(getVar("NEW_USER_REWRITE_QUOTA") ?? 200000),
  });

  const token = newToken();
  await createSession(user.id, await sha256Hex(token), Date.now() + SESSION_TTL_MS);
  return json(
    { ok: true },
    { headers: { "Set-Cookie": cookieHeader(token, req.url.startsWith("https://")) } },
  );
}
