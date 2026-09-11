import { fail, json } from "@/lib/api";
import { cookieHeader, newToken, sha256Hex, SESSION_TTL_MS, verifyPassword } from "@/lib/auth";
import { createSession, getByEmail } from "@/lib/repos/users";

export async function POST(req: Request) {
  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return fail(400, "请求格式错误");
  }
  const email = body.email?.trim().toLowerCase() ?? "";
  const password = body.password ?? "";
  const user = email && password ? await getByEmail(email) : null;
  if (!user || !(await verifyPassword(password, user.passHash))) {
    return fail(401, "邮箱或密码错误");
  }
  const token = newToken();
  await createSession(user.id, await sha256Hex(token), Date.now() + SESSION_TTL_MS);
  return json(
    { ok: true },
    { headers: { "Set-Cookie": cookieHeader(token, req.url.startsWith("https://")) } },
  );
}
