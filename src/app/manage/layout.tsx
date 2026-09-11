import { redirect } from "next/navigation";
import type { Viewport } from "next";
import { currentUser } from "@/lib/api";
import { getSiteSeo } from "@/lib/seo";
import Nav from "./nav";
import type { User } from "@/lib/schema";

export const dynamic = "force-dynamic";

/** 移动端浏览器 UI 跟随系统深浅，与默认的「跟随系统」档一致。 */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
};

/**
 * 后台主题引导：优先读 localStorage，未设置过则跟随系统。
 * 必须在后台标记解析前同步执行（`<script>` 无 src，不阻塞外部资源），
 * 否则浅色用户会先看到一帧深色再翻转。
 */
const THEME_BOOT =
  '(function(){try{var t=localStorage.getItem("cms.admin.theme")||"system";var m=t==="system"?(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):t;document.documentElement.dataset.adminTheme=m;}catch(e){document.documentElement.dataset.adminTheme=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}})();';

export default async function ManageLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const seo = await getSiteSeo();
  return (
    <div className="admin flex min-h-screen flex-col bg-zinc-950 lg:flex-row">
      <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      <Nav user={user} siteName={seo.name} />
      <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-10 lg:py-6">{children}</main>
    </div>
  );
}

export type ManageUser = User;
