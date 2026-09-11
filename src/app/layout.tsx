import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "创作台 — AI 生成图文 · 智能洗稿 · 公众号排版",
  description: "AI 图文创作、洗稿与公众号排版管理平台",
};

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
