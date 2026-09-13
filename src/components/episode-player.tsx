"use client";

import { useEffect, useRef, useState } from "react";
import { ListVideo, Play } from "lucide-react";
import { cx } from "@/components/ui";
import type { EpisodeShot } from "@/lib/episode";

/**
 * 单集连播：按镜头顺序自动接续播放，字幕取该镜头台词。
 * 成片是逐镜头生成的几秒片段，拼成完整一集靠这里顺序播放；
 * 手动切换或播完最后一镜头即停止自动续播，避免循环抢焦点。
 */
export default function EpisodePlayer({ shots, title }: { shots: EpisodeShot[]; title: string }) {
  const playable = shots.filter((s) => s.video);
  const [index, setIndex] = useState(0);
  const [auto, setAuto] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  const current = playable[index];
  const src = current?.video ?? "";
  const url = src.startsWith("r2://") ? `/media/${src.slice(5)}` : src;

  // 换镜头后从头播放；自动播放被浏览器拦下时只影响「是否自动出声」，
  // 不能因此关掉连播开关——两者是不同的用户意图（播放结束仍应接下一个镜头）。
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.load();
    void el.play().catch(() => undefined);
  }, [url]);

  if (playable.length === 0) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950 text-sm text-zinc-500">
        本集还没有生成任何镜头成片
      </div>
    );
  }

  function onEnded() {
    if (!auto) return;
    if (index + 1 < playable.length) setIndex(index + 1);
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-black">
        <video
          ref={videoRef}
          key={url}
          src={url}
          controls
          autoPlay
          playsInline
          onEnded={onEnded}
          className="max-h-[70vh] w-full"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
        <span className="inline-flex items-center gap-1.5">
          <ListVideo className="h-3.5 w-3.5 text-indigo-400" />
          第 {index + 1} / {playable.length} 镜头
          {current?.prompt ? ` · ${current.prompt}` : ""}
        </span>
        <label className="inline-flex items-center gap-1.5">
          <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} className="accent-indigo-500" />
          自动连播下一镜头
        </label>
      </div>

      {current?.dialogue && (
        <p className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-center text-sm leading-6 text-zinc-200">
          {current.dialogue}
        </p>
      )}

      <ol className="grid grid-cols-4 gap-2 sm:grid-cols-6">
        {playable.map((s, i) => (
          <li key={s.shot}>
            <button
              type="button"
              onClick={() => setIndex(i)}
              aria-current={i === index}
              title={s.prompt}
              className={cx(
                "w-full rounded-lg border px-2 py-1.5 text-[11px] transition",
                i === index
                  ? "border-indigo-500 bg-indigo-600/15 text-indigo-300"
                  : "border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:border-indigo-600/60 hover:text-zinc-200",
              )}
            >
              镜头 {s.shot}
            </button>
          </li>
        ))}
      </ol>
      <p className="text-[11px] text-zinc-600">{title} · 共 {shots.length} 个镜头，已生成 {playable.length} 个</p>
    </div>
  );
}
