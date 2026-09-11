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
 * 后台外观引导：主题 + 侧栏折叠状态，都在首次绘制前应用。
 *
 * 必须是同步内联脚本（无 src，不阻塞外部资源），否则浅色用户会先看到一帧深色、
 * 折叠用户会先看到一帧展宽侧栏再收回。属性挂在 <html> 上，由 globals.css 消费；
 * React 侧只读取同一 localStorage key，不参与首帧布局，因此不会有跳变。
 */
const THEME_BOOT =
  '(function(){try{var d=document.documentElement,t=localStorage.getItem("cms.admin.theme")||"system";d.dataset.adminTheme=t==="system"?(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):t;d.dataset.adminNav=localStorage.getItem("cms.admin.nav")==="collapsed"?"collapsed":"expanded";}catch(e){document.documentElement.dataset.adminTheme=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.dataset.adminNav="expanded";}})();';

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
