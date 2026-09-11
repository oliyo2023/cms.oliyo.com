import { redirect } from "next/navigation";
import { currentUser } from "@/lib/api";
import { listUsers, userCount } from "@/lib/repos/users";
import { db } from "@/lib/drizzle";
import { usageEvents } from "@/lib/schema";
import { sql } from "drizzle-orm";
import { monthWindow } from "@/lib/repos/quota";
import UsersClient from "./client";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const me = await currentUser();
  if (!me) redirect("/login");
  if (me.role !== "admin") redirect("/manage");
  const { start } = monthWindow();
  const rows = await listUsers();
  const usageRows = await db()
    .select({
      userId: usageEvents.userId,
      metric: usageEvents.metric,
      total: sql<number>`sum(${usageEvents.amount})`,
    })
    .from(usageEvents)
    .where(sql`${usageEvents.createdAt} >= ${start}`)
    .groupBy(usageEvents.userId, usageEvents.metric);

  const usageByUser = new Map<string, Record<string, number>>();
  for (const r of usageRows) {
    const cur = usageByUser.get(r.userId) ?? {};
    cur[r.metric] = Number(r.total ?? 0);
    usageByUser.set(r.userId, cur);
  }
  const users = rows.map((u) => {
    const usage = usageByUser.get(u.id) ?? {};
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      quotas: {
        textChars: u.quotaTextChars,
        images: u.quotaImages,
        videos: u.quotaVideos,
        rewriteChars: u.quotaRewriteChars,
      },
      usage: {
        textChars: usage.text_chars ?? 0,
        rewriteChars: usage.rewrite_chars ?? 0,
        images: usage.images ?? 0,
        videos: usage.videos ?? 0,
      },
      createdAt: u.createdAt,
    };
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">用户与配额</h1>
          <p className="mt-1 text-sm text-zinc-500">
            共 {await userCount()} 位用户。配额为每月上限（-1 = 不限），每月 1 日自动重置用量。
          </p>
        </div>
      </header>
      <UsersClient meId={me.id} initialJson={JSON.stringify(users)} />
    </div>
  );
}
