"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Loader2, Play, Save, Sparkles, Upload } from "lucide-react";
import { btnGhost, btnPrimary, cx, inputCls } from "@/components/ui";
import { runVideoJob } from "@/lib/video-job";

export type RecentVideo = { id: string; url: string; createdAt: number };

type PublishState = "idle" | "busy" | "published" | "draft";

function fmt(t: number): string {
  return new Date(t).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** 视频成片卡片：预览 + 快捷发布（标题/简介由提示词生成，细节到「作品展示」再改）。 */
function VideoCard({
  url,
  prompt,
  createdAt,
  state,
  onPublish,
}: {
  url: string;
  prompt: string;
  createdAt: number;
  state: PublishState;
  onPublish: (published: boolean) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50">
      <video src={url} controls preload="metadata" className="aspect-video w-full bg-black" />
      <div className="space-y-2 p-3">
        <p className="line-clamp-2 text-xs leading-5 text-zinc-300">{prompt || "（来自历史记录）"}</p>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] text-zinc-500">{fmt(createdAt)}</span>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-indigo-400 hover:underline"
          >
            原视频 <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        {state === "published" || state === "draft" ? (
          <p className="text-[11px] text-emerald-400">
            {state === "published" ? "已发布为视频成片" : "已存为未发布草稿（到「作品展示」发布）"}
          </p>
        ) : (
          <div className="flex gap-2">
            <button className={cx(btnPrimary, "flex-1 px-2 py-1.5 text-xs")} disabled={state === "busy"} onClick={() => onPublish(true)}>
              {state === "busy" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              发布为视频成片
            </button>
            <button className={cx(btnGhost, "px-2 py-1.5 text-xs")} disabled={state === "busy"} onClick={() => onPublish(false)}>
              <Save className="h-3.5 w-3.5" />
              存草稿
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function VideoClient({ recent, configured }: { recent: RecentVideo[]; configured: boolean }) {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [phase, setPhase] = useState<"idle" | "running" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const [results, setResults] = useState<Array<RecentVideo & { prompt: string }>>([]);
  const [states, setStates] = useState<Record<string, PublishState>>({});
  const [notice, setNotice] = useState("");

  const flash = (msg: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice(""), 2400);
  };

  async function generate() {
    const text = prompt.trim();
    if (!text) {
      flash("请先描述要生成的视频画面");
      return;
    }
    setPhase("running");
    setMessage("已提交任务，等待生成…");
    const result = await runVideoJob(text, setMessage);
    if (!result.ok) {
      setPhase("error");
      setMessage(result.message);
      return;
    }
    setResults((prev) => [{ id: `local-${Date.now()}`, url: result.url, createdAt: Date.now(), prompt: text }, ...prev]);
    setPhase("done");
    setMessage("生成完成");
  }

  async function publish(id: string, url: string, prompt: string, published: boolean) {
    setStates((prev) => ({ ...prev, [id]: "busy" }));
    const title = prompt.trim() ? prompt.trim().slice(0, 40) : "视频成片";
    const res = await fetch("/api/showcase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: "video",
        title,
        description: prompt.trim().slice(0, 120),
        media: url,
        published,
      }),
    });
    if (!res.ok) {
      setStates((prev) => ({ ...prev, [id]: "idle" }));
      flash("发布失败，请重试");
      return;
    }
    setStates((prev) => ({ ...prev, [id]: published ? "published" : "draft" }));
    flash(published ? "已发布到公开站「视频成片」" : "已存为未发布草稿");
    router.refresh();
  }

  const running = phase === "running";

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
      <section className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <div>
          <label className="mb-1 block text-xs text-zinc-400">画面描述 *</label>
          <textarea
            className={cx(inputCls, "h-28 resize-none")}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="例如：城市夜景延时摄影，车流灯光流动，镜头缓慢推近，4K 质感"
          />
        </div>
        {running ? (
          <button className={cx(btnGhost, "w-full")} disabled>
            <Loader2 className="h-4 w-4 animate-spin" />
            生成中…
          </button>
        ) : (
          <button className={cx(btnPrimary, "w-full")} onClick={() => void generate()}>
            <Sparkles className="h-4 w-4" />
            生成视频
          </button>
        )}
        {!configured && (
          <p className="text-[11px] leading-5 text-amber-400">
            视频生成服务未配置：请到「系统设置」填写 VIDEO_API_KEY / AGNES_API_KEY。
          </p>
        )}
        <p className="text-[11px] leading-5 text-zinc-600">
          单条视频消耗 1 次视频配额；任务为异步排队，完成后可直接发布或先存草稿。
        </p>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <Play className="h-4 w-4 text-indigo-400" />
          生成结果
          {phase === "running" && <span className="text-xs text-indigo-300">{message}</span>}
          {phase === "error" && <span className="text-xs text-amber-400">{message}</span>}
        </div>

        {phase === "idle" && results.length === 0 && (
          <div className="flex h-56 items-center justify-center rounded-xl border border-dashed border-zinc-800 text-sm text-zinc-600">
            填写左侧画面描述后点击「生成视频」
          </div>
        )}

        {results.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {results.map((r) => (
              <VideoCard
                key={r.id}
                url={r.url}
                prompt={r.prompt}
                createdAt={r.createdAt}
                state={states[r.id] ?? "idle"}
                onPublish={(published) => void publish(r.id, r.url, r.prompt, published)}
              />
            ))}
          </div>
        )}

        <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-medium text-zinc-200">最近生成</h2>
            <Link href="/manage/history" className="inline-flex min-h-6 items-center text-[11px] text-indigo-400 hover:underline">
              全部历史记录 →
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="text-xs text-zinc-600">还没有视频生成记录。</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {recent.map((r) => (
                <VideoCard
                  key={r.id}
                  url={r.url}
                  prompt=""
                  createdAt={r.createdAt}
                  state={states[r.id] ?? "idle"}
                  onPublish={(published) => void publish(r.id, r.url, "", published)}
                />
              ))}
            </div>
          )}
        </div>

        {notice && <p className="text-sm text-emerald-400">{notice}</p>}
      </section>
    </div>
  );
}
