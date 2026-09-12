"use client";

import { useEffect, useState } from "react";
import { Film, Loader2, Sparkles } from "lucide-react";
import Modal from "@/components/modal";
import { btnGhost, btnPrimary, cx, inputCls } from "@/components/ui";

type MediaRow = { id: string; key: string; name: string; kind: string };

/**
 * 选择图片/视频，返回 r2:// 引用（与 showcase、编辑器共用的引用格式）。
 * `aiGenerate` 为图片打开「AI 生成」页签：生成结果由 /api/ai/image 落素材库，
 * 因此与素材库共用同一套引用，调用方无需区分来源。
 */
export default function MediaPicker({
  kind,
  aiGenerate,
  initialTab,
  onPick,
  onClose,
}: {
  kind: "image" | "video";
  aiGenerate?: boolean;
  /** 打开时默认页签；仅在 aiGenerate 生效时可用于直达「AI 生成」。 */
  initialTab?: "library" | "ai";
  onPick: (ref: string) => void;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<MediaRow[] | null>(null);
  const [tab, setTab] = useState<"library" | "ai">(initialTab ?? "library");
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [generated, setGenerated] = useState<{ ref: string; url: string } | null>(null);

  const showAi = Boolean(aiGenerate) && kind === "image";
  const kindLabel = kind === "image" ? "图片" : "视频";

  useEffect(() => {
    fetch(`/api/media?kind=${kind}`)
      .then((r) => r.json())
      .then((d: { media?: MediaRow[] }) => {
        const m = d.media;
        setRows(Array.isArray(m) ? m : []);
      })
      .catch(() => setRows([]));
  }, [kind]);

  async function generate() {
    const desc = prompt.trim();
    if (!desc) {
      setError("请先描述画面");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/ai/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: desc, note: desc.slice(0, 40) }),
      });
      const data = (await res.json()) as { image?: { url?: string }; error?: string };
      const url = data.image?.url;
      if (!res.ok || !url) {
        setError(data.error ?? "生成失败，请重试");
        return;
      }
      // 生成结果已入库（/media/<key>）；转回 r2:// 引用，外链兜底则原样使用。
      const key = url.startsWith("/media/") ? url.slice("/media/".length) : "";
      const ref = key ? `r2://${key}` : url;
      setGenerated({ ref, url });
      if (key) {
        setRows((prev) => [{ id: `ai-${key}`, key, name: `AI 生成 ${desc.slice(0, 20)}`, kind: "image" }, ...(prev ?? [])]);
      }
    } catch {
      setError("网络错误，请重试");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={tab === "ai" && showAi ? "AI 生成图片" : `从素材库选择${kindLabel}`} onClose={onClose}>
      {showAi && (
        <div className="mb-4 flex gap-1 rounded-lg bg-zinc-950/70 p-1">
          {([["library", "素材库"], ["ai", "AI 生成"]] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={tab === id}
              onClick={() => {
                setTab(id);
                setError("");
              }}
              className={cx(
                "flex-1 rounded-lg px-3 py-1.5 text-xs transition",
                tab === id ? "bg-indigo-600/15 font-medium text-indigo-300" : "text-zinc-400 hover:text-zinc-200",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {tab === "ai" && showAi && (
        <div className="space-y-3">
          <div>
            <label htmlFor="media-ai-prompt" className="mb-1.5 block text-sm text-zinc-300">
              画面描述
            </label>
            <textarea
              id="media-ai-prompt"
              className={cx(inputCls, "h-20 resize-none")}
              placeholder="例如：竖屏短剧首帧，雨夜豪宅门口，冷调光影"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
            <p className="mt-1.5 text-xs text-zinc-500">生成结果自动存入素材库，消耗图片生成配额。</p>
          </div>
          {generated && (
            <div className="space-y-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={generated.url} alt="生成预览" className="max-h-56 w-full rounded-lg bg-black object-contain" />
              <p className="text-xs text-emerald-400">已存入素材库，可直接使用。</p>
            </div>
          )}
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex justify-end gap-2">
            <button className={btnGhost} disabled={busy} onClick={() => void generate()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}
              {busy ? "生成中…" : generated ? "重新生成" : "生成"}
            </button>
            <button className={btnPrimary} disabled={busy || !generated} onClick={() => generated && onPick(generated.ref)}>
              使用
            </button>
          </div>
        </div>
      )}

      {tab === "library" && (
        <>
          {rows === null && <p className="text-sm text-zinc-500">加载中…</p>}
          {rows !== null && rows.length === 0 && (
            <p className="text-sm text-zinc-500">
              素材库为空，请先到「素材库」上传{showAi ? "，或切到「AI 生成」" : ""}。
            </p>
          )}
          <div className="grid grid-cols-3 gap-2">
            {rows?.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => onPick(`r2://${m.key}`)}
                className="group overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 text-left transition hover:border-indigo-600"
                title={m.name}
              >
                {m.kind === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/media/${m.key}`} alt={m.name} className="h-20 w-full object-cover" />
                ) : (
                  <div className="flex h-20 items-center justify-center bg-black">
                    <Film className="h-6 w-6 text-zinc-600" aria-hidden="true" />
                  </div>
                )}
                <div className="truncate px-1.5 py-1 text-[10px] text-zinc-500 group-hover:text-zinc-300">{m.name}</div>
              </button>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}
