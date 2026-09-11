import { redirect } from "next/navigation";
import { and, count, eq, type SQL } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import { currentUser } from "@/lib/api";
import { db } from "@/lib/drizzle";
import { articles, history, showcaseItems } from "@/lib/schema";
import { usageThisMonth } from "@/lib/repos/quota";
import { OverviewQuotas, OverviewStats, type QuotaItem, type StatItem } from "./overview";

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
    // showcase_items 是全站共享的（无 owner 维度），两个卡片必须各按自己的分类计数，
    // 否则非管理员会看到「视频成片」与「画廊作品」显示同一个数字。
    countWhere(showcaseItems, eq(showcaseItems.category, "video")),
    countWhere(showcaseItems, eq(showcaseItems.category, "gallery")),
    countWhere(history, all ? undefined : eq(history.ownerId, user.id)),
  ]);

  const [usedText, usedRewrite, usedImgs, usedVids] = await Promise.all([
    usageThisMonth(user.id, "text_chars"),
    usageThisMonth(user.id, "rewrite_chars"),
    usageThisMonth(user.id, "images"),
    usageThisMonth(user.id, "videos"),
  ]);

  const stats: StatItem[] = [
    { key: "articles", href: "/manage/articles", label: "文章（公众号排版）", value: myArticles, sub: `已发布 ${publishedArticles}` },
    { key: "video", href: "/manage/showcase?tab=video", label: "视频成片", value: videoCount, sub: "公开展示" },
    { key: "gallery", href: "/manage/showcase?tab=gallery", label: "画廊作品", value: galleryCount, sub: "公开展示" },
    { key: "history", href: "/manage/history", label: "AI 操作记录", value: histCount, sub: "本账号历史" },
  ];

  const quotas: QuotaItem[] = [
    { label: "文本生成", used: usedText, limit: user.quotaTextChars, unit: "字" },
    { label: "智能洗稿", used: usedRewrite, limit: user.quotaRewriteChars, unit: "字" },
    { label: "图片生成", used: usedImgs, limit: user.quotaImages, unit: "张" },
    { label: "视频生成", used: usedVids, limit: user.quotaVideos, unit: "个" },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-zinc-100">总览</h1>
        <p className="mt-1 text-sm text-zinc-400">
          你好，{user.name}。{all ? "以下为全站内容概况" : "以下为你自己的内容概况"}，用量每月 1 日重置。
        </p>
      </div>

      <OverviewStats items={stats} />

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-zinc-300">本月配额用量</h2>
        <OverviewQuotas rows={quotas} />
      </section>
    </div>
  );
}
