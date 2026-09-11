"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Eraser, FilePlus2, Image as ImageIcon, Loader2, Play, Sparkles, WandSparkles } from "lucide-react";
import { btnGhost, btnPrimary, cx, inputCls } from "@/components/ui";
import { postSse } from "@/lib/sse-client";
import { AUDIENCES, buildImagePrompt, TONES } from "@/lib/prompts";
import { mdToHtml } from "@/lib/md";

type GenState = "idle" | "running" | "done" | "error";

const LENGTHS = [
  { value: "short", label: "短篇（400-600 字）" },
  { value: "medium", label: "中篇（800-1200 字）" },
  { value: "long", label: "长篇（1500-2500 字）" },
] as const;

export default function GeneratePage() {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [angle, setAngle] = useState("");
  const [tone, setTone] = useState<string>("正式");
  const [audience, setAudience] = useState<string>("公众号读者");
  const [length, setLength] = useState<string>("medium");
  const [extra, setExtra] = useState("");
  const [output, setOutput] = useState("");
  const [state, setState] = useState<GenState>("idle");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [imgBusy, setImgBusy] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [kwBusy, setKwBusy] = useState(false);
  const [kwError, setKwError] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const outRef = useRef<HTMLTextAreaElement>(null);

  const flash = (msg: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice(null), 2400);
  };

  async function generate() {
    if (!topic.trim()) {
      flash("请先输入主题");
      return;
    }
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setOutput("");
    setError("");
    setImageUrl(null);
    setState("running");
    try {
      await postSse(
        "/api/ai/article",
        { topic, angle, tone, audience, length, extra },
        {
          onDelta: (t) => {
            setOutput((prev) => prev + t);
            requestAnimationFrame(() => {
              const el = outRef.current;
              if (el) el.scrollTop = el.scrollHeight;
            });
          },
          onEvent: (event, data) => {
            if (event === "error" && data && typeof data === "object") {
              const rec = data as Record<string, unknown>;
              const m = rec.message;
              throw new Error(typeof m === "string" ? m : "生成失败");
            }
          },
        },
        ac.signal,
      );
      setState("done");
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      throwError(e instanceof Error ? e.message : "网络错误");
    }
  }

  function throwError(msg: string) {
    setError(msg);
    setState("error");
  }

  function stop() {
    abortRef.current?.abort();
  }

  async function genKeywords() {
    setKwBusy(true);
    setKwError("");
    try {
      const res = await fetch("/api/ai/keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seed: topic.trim() || undefined, tone, audience }),
      });
      const data = (await res.json()) as { keywords?: string[]; error?: string };
      if (!res.ok || !data.keywords?.length) {
        setKwError(data.error ?? "生成失败，请重试");
        return;
      }
      setKeywords(data.keywords);
    } catch {
      setKwError("网络错误，请重试");
    } finally {
      setKwBusy(false);
    }
  }

  async function saveAsDraft() {
    if (!output.trim()) return;
    const title = firstHeading(output) || topic || "AI 生成图文";
    const res = await fetch("/api/articles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.slice(0, 60),
        summary: output.slice(0, 120),
        contentHtml: mdToHtml(output),
        cover: imageUrl ?? "",
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

  async function genImage() {
    if (!output.trim()) return;
    setImgBusy(true);
    setError("");
    try {
      const res = await fetch("/api/ai/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: buildImagePrompt(output), note: topic }),
      });
      const data = (await res.json()) as { error?: string; image?: { url?: string; b64?: string } };
      if (!res.ok) {
        setError(data.error ?? "图片生成失败");
        return;
      }
      const img = data.image;
      if (img?.url) setImageUrl(img.url);
      else if (img?.b64) setImageUrl(`data:image/png;base64,${img.b64}`);
      flash("封面图已生成");
    } catch (e) {
      setError(e instanceof Error ? e.message : "图片生成失败");
    } finally {
      setImgBusy(false);
    }
  }

  async function copyOut() {
    await navigator.clipboard.writeText(output);
    flash("已复制全文");
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-zinc-100">AI 生成图文</h1>
        <p className="mt-1 text-sm text-zinc-500">输入主题 → 流式生成图文 → 可选生成封面 → 保存到文章排版。</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        <section className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <label className="block text-xs text-zinc-400">主题 / 关键词 *</label>
              <button
                type="button"
                className={cx(btnGhost, "px-2 py-0.5 text-[11px]")}
                disabled={kwBusy}
                onClick={() => void genKeywords()}
                title="按当前主题方向与文风/读者，生成一批候选选题"
              >
                {kwBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <WandSparkles className="h-3 w-3" />}
                {kwBusy ? "生成中…" : "AI 生成关键词"}
              </button>
            </div>
            <textarea className={cx(inputCls, "h-16 resize-none")} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="例如：AI 时代如何保护注意力" />
            {kwError && <p className="mt-1 text-[11px] text-red-400">{kwError}</p>}
            {keywords.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {keywords.map((k, i) => (
                  <button
                    key={`${i}-${k}`}
                    type="button"
                    onClick={() => setTopic(k)}
                    title="点击填入主题"
                    className={cx(
                      "rounded-lg border px-2 py-1 text-left text-[11px] leading-4 transition",
                      topic.trim() === k
                        ? "border-indigo-500 bg-indigo-600/15 text-indigo-300"
                        : "border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:border-indigo-600/60 hover:text-zinc-200",
                    )}
                  >
                    {k}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-400">切入角度（可选）</label>
            <input className={inputCls} value={angle} onChange={(e) => setAngle(e.target.value)} placeholder="例如：从程序员视角" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-zinc-400">文风</label>
              <select className={cx(inputCls, "bg-zinc-900")} value={tone} onChange={(e) => setTone(e.target.value)}>
                {TONES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-400">读者</label>
              <select className={cx(inputCls, "bg-zinc-900")} value={audience} onChange={(e) => setAudience(e.target.value)}>
                {AUDIENCES.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-400">篇幅</label>
            <select className={cx(inputCls, "bg-zinc-900")} value={length} onChange={(e) => setLength(e.target.value)}>
              {LENGTHS.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-400">补充要求（可选）</label>
            <textarea className={cx(inputCls, "h-14 resize-none")} value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="例如：多给具体数据案例" />
          </div>
          {state === "running" ? (
            <button className={cx(btnGhost, "w-full")} onClick={stop}>
              <Loader2 className="h-4 w-4 animate-spin" />
              停止生成
            </button>
          ) : (
            <button className={cx(btnPrimary, "w-full")} onClick={() => void generate()}>
              <Sparkles className="h-4 w-4" />
              开始生成
            </button>
          )}
          <p className="text-[11px] leading-5 text-zinc-600">
            生成的图片/文本会扣除当月配额；「AI 图文」保存为草稿后可在公众号排版中继续编辑。
          </p>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <Sparkles className="h-4 w-4 text-indigo-400" />
              生成结果
              {output && <span className="text-xs text-zinc-600">（{output.replace(/\s/g, "").length} 字）</span>}
            </div>
            {output && (
              <div className="flex items-center gap-2">
                <button className={cx(btnGhost, "px-2.5 py-1 text-xs")} onClick={() => void copyOut()}>
                  <Copy className="h-3.5 w-3.5" />
                  复制
                </button>
                <button className={cx(btnGhost, "px-2.5 py-1 text-xs")} onClick={() => { setOutput(""); setImageUrl(null); setState("idle"); }}>
                  <Eraser className="h-3.5 w-3.5" />
                  清空
                </button>
              </div>
            )}
          </div>

          {state === "idle" && !output && (
            <div className="flex h-72 items-center justify-center rounded-xl border border-dashed border-zinc-800 text-sm text-zinc-600">
              结果将在这里流式显示
            </div>
          )}
          {output && (
            <textarea
              ref={outRef}
              readOnly
              value={output}
              className="h-72 w-full resize-none rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 font-mono text-[13px] leading-6 text-zinc-200 outline-none"
            />
          )}
          {error && <p className="text-sm text-red-400">{error}</p>}
          {notice && <p className="text-sm text-emerald-400">{notice}</p>}

          {state === "done" && (
            <div className="flex flex-wrap items-center gap-2">
              <button className={cx(btnPrimary, "text-xs")} onClick={() => void saveAsDraft()}>
                <FilePlus2 className="h-3.5 w-3.5" />
                保存为文章草稿 →
              </button>
              <button className={cx(btnGhost, "text-xs")} disabled={imgBusy} onClick={() => void genImage()}>
                {imgBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5" />}
                {imgBusy ? "生成中…" : "生成封面图"}
              </button>
              <button className={cx(btnGhost, "text-xs")} onClick={() => void generate()}>
                <Play className="h-3.5 w-3.5" />
                重新生成
              </button>
              {imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageUrl} alt="封面预览" className="ml-auto h-20 rounded-lg border border-zinc-800 object-cover" />
              )}
            </div>
          )}
          <p className="text-[11px] text-zinc-600">生成的图片/文本会扣除当月配额（未接入模型时按钮会提示配置缺失）。</p>
        </section>
      </div>
    </div>
  );
}

function firstHeading(md: string): string {
  const m = md.match(/^#\s+(.+)$/m);
  return m?.[1]?.trim() ?? "";
}
