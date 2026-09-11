import { fail, json, requireAdmin } from "@/lib/api";
import { hashPassword, newId } from "@/lib/auth";
import { deleteUser, getByEmail, listUsers, userCount, createUser } from "@/lib/repos/users";
import { publicUser } from "@/lib/repos/settings";
import { db } from "@/lib/drizzle";
import { usageEvents } from "@/lib/schema";
import { sql } from "drizzle-orm";
import { monthWindow } from "@/lib/repos/quota";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const admin = await requireAdmin(req);
  void admin;
  const { start } = monthWindow();
  const users = await listUsers();
  const usageRows = await db()
    .select({
      userId: usageEvents.userId,
      metric: usageEvents.metric,
      total: sql<number>`sum(${usageEvents.amount})`,
    })
    .from(usageEvents)
    .where(sql`${usageEvents.createdAt} >= ${start}`)
    .groupBy(usageEvents.userId, usageEvents.metric);
  const byUser = new Map<string, Record<string, number>>();
  for (const r of usageRows) {
    const m = byUser.get(r.userId) ?? {};
    m[r.metric] = Number(r.total ?? 0);
    byUser.set(r.userId, m);
  }
  return json({
    users: users.map((u) => ({
      ...publicUser(u),
      usage: {
        textChars: byUser.get(u.id)?.text_chars ?? 0,
        rewriteChars: byUser.get(u.id)?.rewrite_chars ?? 0,
        images: byUser.get(u.id)?.images ?? 0,
        videos: byUser.get(u.id)?.videos ?? 0,
      },
    })),
    count: await userCount(),
  });
}

export async function POST(req: Request) {
  const admin = await requireAdmin(req);
  void admin;
  let body: {
    email?: string;
    name?: string;
    password?: string;
    role?: "admin" | "user";
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
  const email = body.email?.trim().toLowerCase() ?? "";
  const name = body.name?.trim() ?? "";
  const password = body.password ?? "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail(400, "邮箱格式不正确");
  if (!name) return fail(400, "请填写昵称");
  if (password.length < 8) return fail(400, "密码至少 8 位");
  const existing = await getByEmail(email);
  if (existing) return fail(409, "该邮箱已存在");
  const user = await createUser({
    id: newId(),
    email,
    name,
    passHash: await hashPassword(password),
    role: body.role === "admin" ? "admin" : "user",
    quotaTextChars: body.quotaTextChars ?? 0,
    quotaImages: body.quotaImages ?? 0,
    quotaVideos: body.quotaVideos ?? 0,
    quotaRewriteChars: body.quotaRewriteChars ?? 0,
  });
  return json({ user: publicUser(user) }, { status: 201 });
}

export async function DELETE(req: Request) {
  const admin = await requireAdmin(req);
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return fail(400, "缺少 id");
  if (id === admin.id) return fail(400, "不能删除自己");
  await deleteUser(id);
  return json({ ok: true });
}
