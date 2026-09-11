import { cookies } from "next/headers";
import { parseCookies, SESSION_COOKIE, sha256Hex } from "@/lib/auth";
import { getSessionUser } from "@/lib/repos/users";
import type { User } from "@/lib/schema";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const json = (data: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: { "Content-Type": "application/json; charset=utf-8", ...(init.headers ?? {}) },
  });

export const fail = (status: number, message: string) =>
  json({ error: message }, { status });

export async function currentUserFromRequest(req: Request): Promise<User | null> {
  const token = parseCookies(req.headers.get("cookie"))[SESSION_COOKIE];
  if (!token) return null;
  return getSessionUser(await sha256Hex(token));
}

export async function requireUser(req: Request): Promise<User> {
  const user = await currentUserFromRequest(req);
  if (!user) throw new HttpError(401, "未登录或会话已过期");
  return user;
}

export async function requireAdmin(req: Request): Promise<User> {
  const user = await requireUser(req);
  if (user.role !== "admin") throw new HttpError(403, "需要管理员权限");
  return user;
}

/** Server-component side: user for pages, or null. */
export async function currentUser(): Promise<User | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return getSessionUser(await sha256Hex(token));
}
