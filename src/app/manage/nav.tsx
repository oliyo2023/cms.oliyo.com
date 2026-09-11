"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Clapperboard,
  FileText,
  Globe,
  History,
  Image as ImageIcon,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  PenTool,
  Repeat2,
  Settings,
  Sparkles,
  Users,
  Video,
  X,
} from "lucide-react";
import { cx } from "@/components/ui";
import type { User } from "@/lib/schema";
import { useIsoLayoutEffect } from "@/lib/use-iso-layout-effect";
import ThemeToggle from "./theme-toggle";

/** 与 manage/layout.tsx 引导脚本共用同一 key。 */
const NAV_STORAGE_KEY = "cms.admin.nav";

const ADMIN_ITEMS = [
  { href: "/manage/users", label: "用户与配额", icon: Users },
  { href: "/manage/settings", label: "系统设置", icon: Settings },
];

/**
 * 后台导航：≥lg 常驻左侧栏；<lg 收为顶部条 + 抽屉。
 *
 * 自适应而非二选一：导航有 11 项，超过底部导航 5 项上限，故小屏用抽屉。
 * 关闭态用 `invisible` 而不是仅移出视口——不可见元素会同时退出焦点顺序与
 * 无障碍树，否则键盘 Tab 会跑进屏幕外的菜单里。visibility 在 transition 中
 * 按步进插值，因此滑出动画仍然完整（并非瞬隐）。
 */
export default function Nav({ user, siteName }: { user: User; siteName: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const menuBtn = useRef<HTMLButtonElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);

  const items = [
    { href: "/manage", label: "总览", icon: LayoutDashboard },
    { href: "/manage/generate", label: "AI 图文", icon: Sparkles },
    { href: "/manage/drama", label: "短剧生成", icon: Clapperboard },
    { href: "/manage/video", label: "AI 视频", icon: Video },
    { href: "/manage/rewrite", label: "智能洗稿", icon: Repeat2 },
    { href: "/manage/articles", label: "公众号文章", icon: FileText },
    { href: "/manage/showcase", label: "作品展示", icon: Clapperboard },
    { href: "/manage/media", label: "素材库", icon: ImageIcon },
    { href: "/manage/history", label: "历史记录", icon: History },
    ...(user.role === "admin" ? ADMIN_ITEMS : []),
  ];

  const active = (href: string) =>
    href === "/manage" ? pathname === "/manage" : pathname.startsWith(href);

  // 点导航后立即收起，否则遮罩会盖住刚打开的页面。
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Esc 关闭 + 抽屉打开期间锁住背景滚动（否则手指滑动会滚到底层页面）。
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  // 打开后把焦点移进抽屉，避免焦点留在背景内容上。
  useEffect(() => {
    if (open) closeBtn.current?.focus();
  }, [open]);

  /**
   * 是否为桌面宽度。桌面下侧栏是常驻的、不能 inert，因此需要 JS 侧知道断点
   * （`inert` 不像 `invisible` 那样能用 `lg:` 前缀响应式地开关）。
   * 用 layout effect 在绘制前定值，桌面首帧不会出现「短暂不可聚焦」。
   */
  const [desktop, setDesktop] = useState(false);
  useIsoLayoutEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => setDesktop(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // 用户主动关闭时把焦点还给触发按钮；路由变化导致的关闭不抢焦点。
  function close() {
    setOpen(false);
    menuBtn.current?.focus();
  }

  /**
   * 桌面侧栏折叠态。首帧由 <html data-admin-nav>（layout 的引导脚本）+ globals.css 决定，
   * 这里只做两件事：同步状态供 aria/title 使用，以及切换时写回属性与 localStorage。
   * 不靠 React 控制宽度，否则刷新时会先展宽再收回。
   */
  const [collapsed, setCollapsed] = useState(false);

  useIsoLayoutEffect(() => {
    // 只读取、不清理：属性一旦被删，CSS 就退回展宽态，折叠状态随之丢失。
    // 注意 dev 下的 StrictMode 会 mount→cleanup→remount，任何「卸载时删除属性」
    // 的写法都会在挂载后立刻把状态抹掉（实测：刷新后侧栏又变回 224px）。
    setCollapsed(document.documentElement.dataset.adminNav === "collapsed");
  }, []);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    document.documentElement.dataset.adminNav = next ? "collapsed" : "expanded";
    try {
      localStorage.setItem(NAV_STORAGE_KEY, next ? "collapsed" : "expanded");
    } catch {
      // 写入失败不影响本次会话内的折叠
    }
  }

  const itemCls = (href: string) =>
    cx(
      "flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition lg:min-h-0 lg:py-2",
      active(href)
        ? "bg-indigo-600/15 text-indigo-300"
        : "text-zinc-400 hover:bg-zinc-800/70 hover:text-zinc-200",
    );

  return (
    <>
      {/* 移动端顶部条：抽屉触发点，lg 以上让位给常驻侧栏 */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-1 border-b border-zinc-800 bg-zinc-950/95 px-2 backdrop-blur lg:hidden">
        <button
          ref={menuBtn}
          type="button"
          onClick={() => setOpen(true)}
          aria-label="打开导航菜单"
          aria-expanded={open}
          aria-controls="admin-nav"
          className="flex h-11 w-11 items-center justify-center rounded-lg text-zinc-300 transition hover:bg-zinc-800 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
        <span className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <PenTool className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="text-sm font-semibold text-zinc-100">{siteName}</span>
        </span>
      </header>

      {open && <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={close} aria-hidden="true" />}

      <aside
        id="admin-nav"
        aria-label="后台导航"
        inert={!open && !desktop}
        className={cx(
          "admin-rail fixed inset-y-0 left-0 z-50 flex w-64 max-w-[85vw] shrink-0 flex-col overflow-y-auto overscroll-contain border-r border-zinc-800 bg-zinc-950 transition-transform duration-200 ease-out",
          "lg:static lg:z-auto lg:w-56 lg:max-w-none lg:translate-x-0 lg:transition-none lg:bg-zinc-900/40",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="admin-rail-head flex items-center gap-2 px-5 py-4 lg:py-5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white">
            <PenTool className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="admin-label min-w-0 flex-1">
            <div className="text-sm font-semibold text-zinc-100">{siteName}</div>
            <div className="text-[11px] text-zinc-500">管理控制台</div>
          </div>
          {/* 桌面折叠开关：lg 以下不存在（移动端由顶部条抽屉负责） */}
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "展开侧栏菜单" : "折叠侧栏菜单"}
            aria-expanded={!collapsed}
            aria-controls="admin-nav"
            title={collapsed ? "展开侧栏菜单" : "折叠侧栏菜单"}
            className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 lg:flex"
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
            ) : (
              <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
          <button
            ref={closeBtn}
            type="button"
            onClick={close}
            aria-label="关闭导航菜单"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 lg:hidden"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 px-3 py-2">
          {items.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={active(href) ? "page" : undefined}
              title={collapsed ? label : undefined}
              className={cx(itemCls(href), "admin-item")}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="admin-label">{label}</span>
            </Link>
          ))}
        </nav>

        <div className="admin-rail-foot space-y-1 border-t border-zinc-800 p-3">
          <ThemeToggle />
          <Link
            href="/"
            title={collapsed ? "查看公开站点" : undefined}
            className="admin-item flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-zinc-400 transition hover:bg-zinc-800/70 hover:text-zinc-200 lg:min-h-0 lg:py-2"
          >
            <Globe className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="admin-label">查看公开站点</span>
          </Link>
          <div className="admin-user-row flex items-center justify-between gap-2 px-3 py-1">
            <div className="admin-label min-w-0">
              <div className="truncate text-xs font-medium text-zinc-300">{user.name}</div>
              <div className="truncate text-[11px] text-zinc-500">
                {user.email}
                {user.role === "admin" && " · 管理员"}
              </div>
            </div>
            <button
              type="button"
              title="退出登录"
              aria-label="退出登录"
              onClick={async () => {
                await fetch("/api/auth/logout", { method: "POST" });
                router.push("/login");
                router.refresh();
              }}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 lg:h-9 lg:w-9"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
