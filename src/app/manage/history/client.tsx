"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Clapperboard, FileIcon, Film, Image as ImageIcon, Repeat2, Sparkles, Trash2 } from "lucide-react";

type Kind = "article_gen" | "rewrite" | "image_gen" | "video_gen" | "drama_gen" | "article_format" | "manual";

type HistoryRow = {
  id: string;
  kind: Kind;
  title: string;
  model: string;
  input: string;
  output: string;
  extra: string;
  status: "done" | "failed";
  createdAt: number;
};

const KIND_META: Record<Kind, { label: string; icon: typeof Sparkles }> = {
  article_gen: { label: "AI 图文", icon: Sparkles },
  rewrite: { label: "智能洗稿", icon: Repeat2 },
  image_gen: { label: "图片生成", icon: ImageIcon },
  video_gen: { label: "视频生成", icon: Film },
  drama_gen: { label: "短剧生成", icon: Clapperboard },
  article_format: { label: "智能排版", icon: Sparkles },
  manual: { label: "手动", icon: FileIcon },
};

function parseRows(json: string): HistoryRow[] {
  try {
    const raw: unknown = JSON.parse(json);
    if (!Array.isArray(raw)) return [];
    const rows: HistoryRow[] = [];
    for (const item of raw) {
      if (item === null || typeof item !== "object") continue;
      const rec = item as Record<string, unknown>;
      if (typeof rec.id === "string" && typeof rec.createdAt === "number") {
        rows.push({
          id: rec.id,
          kind: (rec.kind as Kind) ?? "manual",
          title: typeof rec.title === "string" ? rec.title : "",
          model: typeof rec.model === "string" ? rec.model : "",
          input: typeof rec.input === "string" ? rec.input : "",
          output: typeof rec.output === "string" ? rec.output : "",
          extra: typeof rec.extra === "string" ? rec.extra : "{}",
          status: rec.status === "failed" ? "failed" : "done",
          createdAt: rec.createdAt,
        });
      }
    }
    return rows;
  } catch {
    return [];
  }
}

function extraUrl(extra: string): string | null {
  try {
    const parsed: unknown = JSON.parse(extra);
    if (parsed === null || typeof parsed !== "object") return null;
    const url: unknown = (parsed as Record<string, unknown>).url;
    return typeof url === "string" && url ? url : null;
  } catch {
    return null;
  }
}

function fmt(t: number): string {
  return new Date(t).toLocaleString("zh-CN", { dateStyle: "short", timeStyle: "short" });
}

export default function HistoryClient({ initialJson }: { initialJson: string }) {
  const router = useRouter();
  const [rows, setRows] = useState<HistoryRow[]>(() => parseRows(initialJson));

  async function remove(id: string) {
    if (!confirm("删除这条记录？")) return;
    const res = await fetch(`/api/history/${id}`, { method: "DELETE" });
    if (res.ok) {
      setRows((prev) => prev.filter((r) => r.id !== id));
      router.refresh();
    }
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-800 p-12 text-center text-sm text-zinc-500">
        还没有记录。去「AI 图文」「智能洗稿」生成内容后，会自动保存在这里。
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {rows.map((r) => {
        const meta = KIND_META[r.kind] ?? KIND_META.manual;
        const Icon = meta.icon;
        const url = extraUrl(r.extra);
        return (
          <li key={r.id} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-indigo-400" />
                  <span className="text-sm font-medium text-zinc-100">{r.title || "(无标题)"}</span>
                  <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">{meta.label}</span>
                  {r.status === "failed" && <span className="rounded bg-red-900/40 px-1.5 py-0.5 text-[10px] text-red-300">失败</span>}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-zinc-500">
                  <span>{fmt(r.createdAt)}</span>
                  {r.model && <span>模型 {r.model}</span>}
                  {r.output && <span>输出 {r.output.length} 字</span>}
                </div>
                {r.input && (
                  <details className="mt-2">
                    <summary className="inline-flex min-h-6 cursor-pointer items-center text-xs text-zinc-500 hover:text-zinc-300">
                      查看输入
                    </summary>
                    <p className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-zinc-950/60 p-3 text-xs text-zinc-400">
                      {r.input}
                    </p>
                  </details>
                )}
                {r.output && (
                  <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-xs text-zinc-400">{r.output}</p>
                )}
                {url && (
                  <a
                    href={url.startsWith("http") ? url : `/media/${url.slice(5)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-flex min-h-6 items-center break-all text-xs text-indigo-400 hover:underline"
                  >
                    查看生成结果 ↗
                  </a>
                )}
              </div>
              <button
                title="删除记录"
                onClick={() => void remove(r.id)}
                className="shrink-0 rounded-lg p-2 text-zinc-600 transition hover:bg-zinc-800 hover:text-red-400"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
