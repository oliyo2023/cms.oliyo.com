import Link from "next/link";
import { PenTool } from "lucide-react";
import { currentUser } from "@/lib/api";

const SECTIONS = [
  { id: "gallery", label: "画廊" },
  { id: "series", label: "剧集" },
  { id: "articles", label: "文章" },
  { id: "videos", label: "视频成片" },
];

/** 公开站点头部（服务端；无会话时显示登录入口） */
export default async function SiteHeader() {
  const user = await currentUser();
  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-zinc-950/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <PenTool className="h-4.5 w-4.5" />
          </div>
          <span className="text-base font-semibold text-zinc-100">创作台</span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`/#${s.id}`}
              className="rounded-lg px-3 py-1.5 text-sm text-zinc-400 transition hover:bg-zinc-800/60 hover:text-zinc-100"
            >
              {s.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {user ? (
            <Link
              href="/manage"
              className="rounded-lg bg-indigo-600 px-3.5 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-500"
            >
              管理控制台
            </Link>
          ) : (
            <>
              <Link href="/login" className="rounded-lg px-3 py-1.5 text-sm text-zinc-300 transition hover:text-white">
                登录
              </Link>
              <Link
                href="/login?register=1"
                className="rounded-lg bg-indigo-600 px-3.5 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-500"
              >
                开始创作
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-zinc-800/80 py-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-4 text-center text-xs text-zinc-400">
        <div className="flex items-center gap-1.5">
          <PenTool className="h-3.5 w-3.5" />
          创作台 · AI 生成图文 / 智能洗稿 / 公众号排版
        </div>
        <p>内容由 AI 辅助创作，请注意核对事实与版权信息。</p>
      </div>
    </footer>
  );
}
