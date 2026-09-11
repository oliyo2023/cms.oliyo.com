import Link from "next/link";
import { and, count, eq, type SQL } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import { currentUser } from "@/lib/api";
import { db } from "@/lib/drizzle";
import { articles, history, showcaseItems } from "@/lib/schema";
import { usageThisMonth } from "@/lib/repos/quota";
import { redirect } from "next/navigation";
import { ArrowRight, FileText, Image as ImageIcon, Repeat2, Sparkles } from "lucide-react";
import { cx } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  const all = user.role === "admin";

  async function countWhere(table: SQLiteTable, cond?: SQL): Promise<number> {
    const rows = await db().select({ n: count() }).from(table).where(cond);
    return rows[0]?.n ?? 0;
  }

  const [myArticles, publishedArticles, videoCount, galleryCount, histCount] = await Promise.all([
    countWhere(articles, all ? undefined : eq(articles.ownerId, user.id)),
    countWhere(
      articles,
      all ? eq(articles.status, "published") : and(eq(articles.ownerId, user.id), eq(articles.status, "published")),
    ),
    countWhere(showcaseItems, all ? eq(showcaseItems.category, "video") : undefined),
    countWhere(showcaseItems, all ? eq(showcaseItems.category, "gallery") : undefined),
    countWhere(history, all ? undefined : eq(history.ownerId, user.id)),
  ]);

  const [usedText, usedRewrite, usedImgs, usedVids] = await Promise.all([
    usageThisMonth(user.id, "text_chars"),
    usageThisMonth(user.id, "rewrite_chars"),
    usageThisMonth(user.id, "images"),
    usageThisMonth(user.id, "videos"),
  ]);

  const cards = [
    { href: "/manage/articles", icon: FileText, label: "文章（公众号排版）", value: myArticles, sub: `已发布 ${publishedArticles}` },
    { href: "/manage/showcase?cat=video", icon: ImageIcon, label: "视频成片", value: videoCount, sub: "公开展示" },
    { href: "/manage/showcase?cat=gallery", icon: Sparkles, label: "画廊作品", value: galleryCount, sub: "公开展示" },
    { href: "/manage/history", icon: Repeat2, label: "AI 操作记录", value: histCount, sub: "本账号历史" },
  ];

  const quotaRows = [
    { label: "文本生成", used: usedText, limit: user.quotaTextChars, unit: "字" },
    { label: "智能洗稿", used: usedRewrite, limit: user.quotaRewriteChars, unit: "字" },
    { label: "图片生成", used: usedImgs, limit: user.quotaImages, unit: "张" },
    { label: "视频生成", used: usedVids, limit: user.quotaVideos, unit: "个" },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-zinc-100">总览</h1>
        <p className="mt-1 text-sm text-zinc-500">你好，{user.name}。本月用量与内容概况（每月 1 日重置）。</p>
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ href, icon: Icon, label, value, sub }) => (
          <Link
            key={label}
            href={href}
            className="group rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 transition hover:border-indigo-600/60"
          >
            <div className="flex items-center gap-2 text-zinc-400">
              <Icon className="h-4 w-4" />
              <span className="text-xs">{label}</span>
            </div>
            <div className="mt-3 text-2xl font-semibold text-zinc-100">{value}</div>
            <div className="mt-1 flex items-center justify-between text-xs text-zinc-500">
              {sub}
              <ArrowRight className="h-3.5 w-3.5 opacity-0 transition group-hover:opacity-100" />
            </div>
          </Link>
        ))}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-zinc-300">本月配额用量</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {quotaRows.map((r) => {
            const unlimited = r.limit < 0;
            const pct = unlimited || r.limit === 0 ? 0 : Math.min(100, (r.used / r.limit) * 100);
            const within = r.limit < 0 || r.used <= r.limit;
            return (
              <div key={r.label} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
                <div className="flex justify-between text-xs">
                  <span className={cx("font-medium", within ? "text-zinc-300" : "text-red-400")}>{r.label}</span>
                  <span className="text-zinc-500">
                    {unlimited ? "不限量" : `${r.used.toLocaleString()} / ${r.limit.toLocaleString()} ${r.unit}`}
                  </span>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-800">
                  <div className="h-full rounded-full bg-indigo-500" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
