import { cache } from "react";
import type { Metadata } from "next";
import { resolveVars } from "@/lib/config";

/**
 * 站点级品牌与 SEO 配置。
 *
 * 全部走 D1 settings（后台「系统设置 → 站点与 SEO」），未配置时回退环境变量与内置默认，
 * 与其它配置同一套优先级。用 React `cache` 做请求级去重：同一请求里根布局的
 * generateMetadata 与页头/页脚都会读它，否则一次渲染要查好几遍库。
 */
export type SiteSeo = {
  /** 站点名称：标题后缀、og:site_name、页头文字 */
  name: string;
  /** 首页完整标题；未配置则回退站点名称 */
  title: string;
  description: string;
  keywords: string[];
  ogImage: string;
  /** canonical 基址（无尾斜杠）；未配置时为空串 */
  url: string;
  /** 是否允许搜索引擎收录 */
  indexable: boolean;
};

/**
 * 默认标题后缀。刻意不把完整标题（含「创作台」）写进 config 默认值：
 * 那样 SITE_TITLE 永远非空，只改「站点名称」的用户会得到后缀仍是旧站名的标题
 * （`|| name` 会变成死代码）。这里让首页标题由站点名称推导，名称一改即同步。
 */
const DEFAULT_TAGLINE = "AI 生成图文 · 智能洗稿 · 公众号排版";

export const getSiteSeo = cache(async (): Promise<SiteSeo> => {
  const v = await resolveVars([
    "SITE_NAME",
    "SITE_TITLE",
    "SITE_DESCRIPTION",
    "SITE_KEYWORDS",
    "SITE_OG_IMAGE",
    "SITE_URL",
    "SITE_INDEXABLE",
  ]);
  const name = v.SITE_NAME?.trim() || "创作台";
  return {
    name,
    title: v.SITE_TITLE?.trim() || `${name} — ${DEFAULT_TAGLINE}`,
    description: v.SITE_DESCRIPTION?.trim() ?? "",
    keywords: (v.SITE_KEYWORDS ?? "")
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean),
    ogImage: v.SITE_OG_IMAGE?.trim() ?? "",
    url: (v.SITE_URL?.trim() ?? "").replace(/\/$/, ""),
    indexable: (v.SITE_INDEXABLE ?? "true") !== "false",
  };
});

/**
 * 根布局元数据。
 *
 * `title.template` 统一追加「— 站点名称」，所以子页面只给自己的标题（如「登录」、
 * 文章标题），不要再自行拼后缀——否则会出现「登录 — 创作台 — 创作台」。
 */
export async function siteMetadata(): Promise<Metadata> {
  const seo = await getSiteSeo();
  const images = seo.ogImage ? [seo.ogImage] : undefined;

  return {
    // 有 SITE_URL 才有 canonical 基址；分享图等相对地址依赖它解析为绝对 URL。
    metadataBase: seo.url ? new URL(seo.url) : undefined,
    title: { default: seo.title, template: `%s — ${seo.name}` },
    description: seo.description,
    keywords: seo.keywords.length > 0 ? seo.keywords : undefined,
    applicationName: seo.name,
    openGraph: {
      type: "website",
      siteName: seo.name,
      title: seo.title,
      description: seo.description,
      locale: "zh_CN",
      images,
    },
    twitter: {
      card: images ? "summary_large_image" : "summary",
      title: seo.title,
      description: seo.description,
      images,
    },
    robots: seo.indexable ? { index: true, follow: true } : { index: false, follow: false },
  };
}
