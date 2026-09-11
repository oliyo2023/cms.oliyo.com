import type { MetadataRoute } from "next";
import { getSiteSeo } from "@/lib/seo";

// 依赖 D1 配置，必须按请求生成，否则会在构建期被静态化（CI 上没有真实配置）。
export const dynamic = "force-dynamic";

/**
 * robots.txt：默认放开公开内容，屏蔽后台与 API；「允许收录」关闭时整站禁止抓取。
 * sitemap 只在配置了 SITE_URL 时给出——没有 canonical 基址就无法生成合法条目。
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const seo = await getSiteSeo();

  if (!seo.indexable) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // /login 与 /manage 对搜索无价值；/api 是接口。
      disallow: ["/manage", "/api", "/login"],
    },
    ...(seo.url ? { sitemap: `${seo.url}/sitemap.xml`, host: seo.url } : {}),
  };
}
