import type { Metadata, Viewport } from "next";
import { siteMetadata } from "@/lib/seo";
import "./globals.css";

// 站点名称/标题/描述等在后台「系统设置 → 站点与 SEO」里改，因此元数据按请求从 D1 组装。
export function generateMetadata(): Promise<Metadata> {
  return siteMetadata();
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#09090b",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning：后台在 hydration 前用引导脚本设置 <html data-admin-theme>（防主题闪烁），
    // 该属性是客户端先行写入的合法差异，不需要 React 参与比对。
    <html lang="zh-CN" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
