import type { MetadataRoute } from "next";
import { getSiteSeo } from "@/lib/seo";
import { listPublishedArticles } from "@/lib/repos/articles";
import { listPublicSeries, listShowcaseItems } from "@/lib/repos/showcase";

// 依赖 D1，必须按请求生成；否则构建期会读到空库并把结果静态化。
export const dynamic = "force-dynamic";

/**
 * sitemap.xml：首页 + 已发布文章/剧集/作品（画廊与视频成片）。
 *
 * 单集（category === "episode"）没有独立路由（在 /series/[id] 内展示），因此不单独出条目；
 * 未配置 SITE_URL 时返回空列表，避免产出相对 URL 的非法 sitemap。
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const seo = await getSiteSeo();
  if (!seo.url || !seo.indexable) return [];

  const [articles, series, items] = await Promise.all([
    listPublishedArticles(200),
    listPublicSeries(),
    listShowcaseItems({ publishedOnly: true }),
  ]);

  const entries: MetadataRoute.Sitemap = [
    { url: `${seo.url}/`, changeFrequency: "daily", priority: 1 },
  ];

  for (const a of articles) {
    entries.push({
      url: `${seo.url}/article/${a.id}`,
      lastModified: a.publishedAt ? new Date(a.publishedAt) : undefined,
      changeFrequency: "weekly",
      priority: 0.8,
    });
  }
  for (const s of series) {
    entries.push({
      url: `${seo.url}/series/${s.id}`,
      lastModified: new Date(s.createdAt),
      changeFrequency: "weekly",
      priority: 0.7,
    });
  }
  for (const w of items) {
    if (w.category !== "gallery" && w.category !== "video") continue;
    entries.push({
      url: `${seo.url}/works/${w.category}/${w.id}`,
      lastModified: new Date(w.createdAt),
      changeFrequency: "monthly",
      priority: 0.6,
    });
  }
  return entries;
}
