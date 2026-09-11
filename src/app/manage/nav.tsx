"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Clapperboard,
  FileText,
  Globe,
  History,
  Image as ImageIcon,
  LayoutDashboard,
  LogOut,
  PenTool,
  Repeat2,
  Settings,
  Sparkles,
  Users,
  Video,
} from "lucide-react";
import { cx } from "@/components/ui";
import type { User } from "@/lib/schema";
import ThemeToggle from "./theme-toggle";

const ADMIN_ITEMS = [
  { href: "/manage/users", label: "用户与配额", icon: Users },
  { href: "/manage/settings", label: "系统设置", icon: Settings },
];

export default function Nav({ user }: { user: User }) {
  const pathname = usePathname();
  const router = useRouter();

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

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-zinc-800 bg-zinc-900/40">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white">
          <PenTool className="h-5 w-5" />
        </div>
        <div>
          <div className="text-sm font-semibold text-zinc-100">创作台</div>
          <div className="text-[11px] text-zinc-500">管理控制台</div>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
        {items.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cx(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
              active(href)
                ? "bg-indigo-600/15 text-indigo-300"
                : "text-zinc-400 hover:bg-zinc-800/70 hover:text-zinc-200",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>
      <div className="space-y-1 border-t border-zinc-800 p-3">
        <ThemeToggle />
        <Link
          href="/"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-400 transition hover:bg-zinc-800/70 hover:text-zinc-200"
        >
          <Globe className="h-4 w-4" />
          查看公开站点
        </Link>
        <div className="flex items-center justify-between px-3 py-1">
          <div className="min-w-0">
            <div className="truncate text-xs font-medium text-zinc-300">{user.name}</div>
            <div className="truncate text-[11px] text-zinc-500">
              {user.email}
              {user.role === "admin" && " · 管理员"}
            </div>
          </div>
          <button
            title="退出登录"
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              router.push("/login");
              router.refresh();
            }}
            className="rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-200"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
