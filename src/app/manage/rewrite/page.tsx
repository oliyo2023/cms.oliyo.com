"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Eraser, FilePlus2, Loader2, Repeat2 } from "lucide-react";
import { btnGhost, btnPrimary, cx, inputCls } from "@/components/ui";
import { postSse } from "@/lib/sse-client";
import { REWRITE_MODES, type RewriteMode } from "@/lib/prompts";
import { mdToHtml } from "@/lib/md";

type State = "idle" | "running" | "done" | "error";

export default function RewritePage() {
  const router = useRouter();
  const [source, setSource] = useState("");
  const [titleHint, setTitleHint] = useState("");
  const [mode, setMode] = useState<RewriteMode>("deep");
  const [output, setOutput] = useState("");
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const flash = (msg: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice(null), 2400);
  };

  async function run() {
    if (!source.trim()) {
      flash("请先粘贴要改写的原文");
      return;
    }
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setOutput("");
    setError("");
    setState("running");
    try {
      await postSse(
        "/api/ai/rewrite",
        { source, mode, titleHint },
        {
          onDelta: (t) => setOutput((prev) => prev + t),
          onEvent: (event, data) => {
            if (event === "error" && data && typeof data === "object") {
              const rec = data as Record<string, unknown>;
              const m = rec.message;
              throw new Error(typeof m === "string" ? m : "改写失败");
            }
          },
        },
        ac.signal,
      );
      setState("done");
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof Error ? e.message : "网络错误");
      setState("error");
    }
  }

  async function copyOut() {
    await navigator.clipboard.writeText(output);
    flash("已复制改写结果");
  }

  async function saveAsDraft() {
    if (!output.trim()) return;
    const res = await fetch("/api/articles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: titleHint.trim() || "洗稿文章",
        summary: output.slice(0, 120),
        contentHtml: mdToHtml(output),
        status: "draft",
      }),
    });
    const data = (await res.json()) as { article?: { id: string }; error?: string };
    if (!res.ok) {
      flash(data.error ?? "保存失败");
      return;
    }
    router.push(`/manage/articles/${data.article?.id ?? ""}`);
    router.refresh();
  }

  const modeMeta = REWRITE_MODES.find((m) => m.id === mode);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-zinc-100">智能洗稿</h1>
        <p className="mt-1 text-sm text-zinc-500">粘贴源文 → 选择改写强度 → 输出可发布的原创表达，保留全部事实与数据。</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-zinc-400">原文 *</label>
            <span className="text-[11px] text-zinc-600">{source.length.toLocaleString()} / 20,000 字</span>
          </div>
          <textarea
            className={cx(inputCls, "h-80 resize-none font-mono text-[13px] leading-6")}
            value={source}
            onChange={(e) => setSource(e.target.value.slice(0, 20000))}
            placeholder="粘贴公众号文章、新闻或笔记原文…"
          />
          <div>
            <label className="mb-1 block text-xs text-zinc-400">原标题（可选，便于保留语气）</label>
            <input className={inputCls} value={titleHint} onChange={(e) => setTitleHint(e.target.value)} />
          </div>
        </section>

        <section className="space-y-3">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <label className="mb-2 block text-xs font-medium text-zinc-400">改写模式</label>
            <div className="grid grid-cols-2 gap-2">
              {REWRITE_MODES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  className={cx(
                    "rounded-lg border p-3 text-left transition",
                    mode === m.id ? "border-indigo-500 bg-indigo-600/10" : "border-zinc-800 bg-zinc-950 hover:border-zinc-700",
                  )}
                >
                  <div className={cx("text-sm font-medium", mode === m.id ? "text-indigo-300" : "text-zinc-200")}>{m.label}</div>
                  <div className="mt-0.5 text-[11px] leading-4 text-zinc-500">{m.hint}</div>
                </button>
              ))}
            </div>
            {state === "running" ? (
              <button className={cx(btnGhost, "mt-3 w-full")} onClick={() => abortRef.current?.abort()}>
                <Loader2 className="h-4 w-4 animate-spin" />
                停止
              </button>
            ) : (
              <button className={cx(btnPrimary, "mt-3 w-full")} onClick={() => void run()}>
                <Repeat2 className="h-4 w-4" />
                开始改写（{modeMeta?.label}）
              </button>
            )}
            <p className="mt-2 text-[11px] leading-5 text-zinc-600">
              {modeMeta?.hint}。改写按输出字数计入本月洗稿配额。
            </p>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-400">改写结果</span>
              {output && (
                <span className="flex items-center gap-2">
                  <span className="text-[11px] text-zinc-600">{output.replace(/\s/g, "").length} 字</span>
                  <button className={cx(btnGhost, "px-2 py-1 text-xs")} onClick={() => void copyOut()}>
                    <Copy className="h-3 w-3" />
                    复制
                  </button>
                  <button className={cx(btnGhost, "px-2 py-1 text-xs")} onClick={() => { setOutput(""); setState("idle"); }}>
                    <Eraser className="h-3 w-3" />
                    清空
                  </button>
                </span>
              )}
            </div>
            {!output && state !== "running" && (
              <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-zinc-800 text-sm text-zinc-600">
                改写结果将在这里显示
              </div>
            )}
            {output && (
              <textarea
                readOnly
                value={output}
                className="h-64 w-full resize-none rounded-lg border border-zinc-800 bg-zinc-950 p-3 font-mono text-[13px] leading-6 text-zinc-200 outline-none"
              />
            )}
            {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
            {notice && <p className="mt-2 text-sm text-emerald-400">{notice}</p>}
            {state === "done" && (
              <button className={cx(btnPrimary, "mt-2 text-xs")} onClick={() => void saveAsDraft()}>
                <FilePlus2 className="h-3.5 w-3.5" />
                保存为文章草稿 →
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
