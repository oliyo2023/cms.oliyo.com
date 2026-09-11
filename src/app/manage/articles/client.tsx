"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Pencil, Send, Trash2 } from "lucide-react";

type Status = "draft" | "published";

type Article = {
  id: string;
  title: string;
  summary: string;
  cover: string;
  contentHtml: string;
  status: Status;
  publishedAt: number | null;
  updatedAt: number;
  createdAt: number;
  ownerId: string;
};

function parseRows(json: string): Article[] {
  try {
    const raw: unknown = JSON.parse(json);
    if (!Array.isArray(raw)) return [];
    return raw as Article[];
  } catch {
    return [];
  }
}

const fmt = (t: number) => new Date(t).toLocaleString("zh-CN", { dateStyle: "short", timeStyle: "short" });

export default function ArticlesClient({
  initialJson,
  isAdmin,
  showAll,
}: {
  initialJson: string;
  isAdmin: boolean;
  showAll: boolean;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Article[]>(() => parseRows(initialJson));
  const [tip, setTip] = useState<string | null>(null);
  const notify = (msg: string) => {
    setTip(msg);
    window.setTimeout(() => setTip(null), 2400);
  };

  async function changeStatus(a: Article, status: Status) {
    const res = await fetch(`/api/articles/${a.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      notify(status === "published" ? "已发布，公开站可见" : "已下线");
      setRows((prev) => prev.map((r) => (r.id === a.id ? { ...r, status, publishedAt: status === "published" ? Date.now() : null } : r)));
      router.refresh();
    }
  }

  async function remove(a: Article) {
    if (!confirm(`删除文章「${a.title}」？不可恢复。`)) return;
    const res = await fetch(`/api/articles/${a.id}`, { method: "DELETE" });
    if (res.ok) {
      notify("已删除");
      setRows((prev) => prev.filter((r) => r.id !== a.id));
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      {tip && <p className="text-sm text-emerald-400">{tip}</p>}
      {isAdmin && (
        <div className="flex gap-2 text-sm">
          <Link
            href="/manage/articles"
            className={showAll ? "text-zinc-500 hover:text-zinc-300" : "font-medium text-indigo-400"}
          >
            我的文章
          </Link>
          <span className="text-zinc-500">/</span>
          <Link
            href="/manage/articles?all=1"
            className={showAll ? "font-medium text-indigo-400" : "text-zinc-500 hover:text-zinc-300"}
          >
            全部文章
          </Link>
        </div>
      )}
      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 p-12 text-center text-sm text-zinc-500">
          还没有文章。用「AI 图文」生成内容，或直接新建后用编辑器排版发布。
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((a) => (
            <li key={a.id} className="flex items-start justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 shrink-0 text-indigo-400" />
                  <Link href={`/manage/articles/${a.id}`} className="truncate text-sm font-medium text-zinc-100 hover:text-indigo-300">
                    {a.title || "(无标题)"}
                  </Link>
                  <span
                    className={
                      a.status === "published"
                        ? "rounded bg-emerald-900/40 px-1.5 py-0.5 text-[10px] text-emerald-300"
                        : "rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400"
                    }
                  >
                    {a.status === "published" ? "已发布" : "草稿"}
                  </span>
                </div>
                <p className="mt-1 line-clamp-1 text-xs text-zinc-500">{a.summary || "无摘要"}</p>
                <p className="mt-1 text-[11px] text-zinc-600">更新于 {fmt(a.updatedAt)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Link
                  href={`/manage/articles/${a.id}`}
                  className="flex items-center gap-1 rounded-lg border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300 hover:border-zinc-500"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  排版
                </Link>
                {a.status === "draft" ? (
                  <button
                    className="flex items-center gap-1 rounded-lg bg-indigo-600/80 px-2.5 py-1.5 text-xs text-white hover:bg-indigo-500"
                    onClick={() => void changeStatus(a, "published")}
                  >
                    <Send className="h-3.5 w-3.5" />
                    发布
                  </button>
                ) : (
                  <button
                    className="rounded-lg border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
                    onClick={() => void changeStatus(a, "draft")}
                  >
                    下线
                  </button>
                )}
                <button className="rounded-lg p-2 text-zinc-600 hover:bg-zinc-800 hover:text-red-400" title="删除" onClick={() => void remove(a)}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="flex items-center gap-1 text-xs text-zinc-600">
        <Send className="h-3 w-3" />
        发布后的文章会出现在公开站「文章」栏目（/article/文章ID）。
      </p>
    </div>
  );
}
