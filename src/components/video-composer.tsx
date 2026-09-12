"use client";

import { useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { btnGhost, cx, inputCls } from "@/components/ui";
import { SuggestButton, SuggestChips, useAiSuggest } from "@/components/ai-suggest";
import MediaPicker from "@/components/media-picker";
import { mediaUrl } from "@/lib/refs";
import type { VideoMode } from "@/lib/video-job";

/** 一次视频生成的输入：提示词 + 模式 + 该模式需要的素材（素材库引用 r2:// 或外链）。 */
export type VideoDraft = {
  prompt: string;
  mode: VideoMode;
  firstFrame: string;
  lastFrame: string;
  images: string[];
};

export const emptyVideoDraft: VideoDraft = { prompt: "", mode: "text", firstFrame: "", lastFrame: "", images: [] };

/** Flash 参考图上限（与服务端一致，见 Agnes 视频文档）。 */
const MAX_IMAGES = 5;

const MODES: Array<{ value: VideoMode; label: string; hint: string }> = [
  { value: "text", label: "文生视频", hint: "只用提示词生成画面" },
  { value: "keyframe", label: "首尾帧", hint: "给定首帧 / 尾帧，成片从它开始或结束（至少一张，可取自素材库或 AI 生成）" },
  { value: "reference", label: "图片参考", hint: "以参考图的角色、风格为准，画面可重新构图（最多 5 张，可取自素材库或 AI 生成）" },
];

/** 提交前的本地校验；返回 null 表示可以提交。服务端会再校验一次。 */
export function videoDraftError(draft: VideoDraft): string | null {
  if (!draft.prompt.trim()) return "请先描述要生成的视频画面";
  if (draft.mode === "keyframe" && !draft.firstFrame && !draft.lastFrame) return "首尾帧模式至少要选择首帧或尾帧";
  if (draft.mode === "reference" && draft.images.length === 0) return "图片参考模式至少要选择一张参考图";
  return null;
}

function FrameSlot({
  label,
  refValue,
  onPick,
  onClear,
}: {
  label: string;
  refValue: string;
  onPick: () => void;
  onClear: () => void;
}) {
  if (!refValue) {
    return (
      <button
        type="button"
        onClick={onPick}
        className="flex h-20 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-zinc-700 text-[11px] text-zinc-500 transition hover:border-indigo-600 hover:text-zinc-300"
      >
        <ImagePlus className="h-4 w-4" />
        {label}
      </button>
    );
  }
  return (
    <div className="relative overflow-hidden rounded-lg border border-zinc-700">
      <button type="button" onClick={onPick} title={`更换${label}`} className="block w-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={mediaUrl(refValue)} alt={label} className="h-20 w-full object-cover" />
      </button>
      <span className="pointer-events-none absolute bottom-0 left-0 bg-black/70 px-1.5 py-0.5 text-[10px] text-zinc-300">{label}</span>
      <button
        type="button"
        aria-label={`移除${label}`}
        onClick={onClear}
        className="absolute right-1 top-1 rounded bg-black/70 p-0.5 text-zinc-300 transition hover:text-red-400"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

/**
 * 视频生成输入区：提示词（含 AI 生成候选）+ 模式（文生视频 / 首尾帧 / 图片参考）+ 素材选择。
 * 「AI 视频」栏目的生成区与「作品展示」的生成弹窗共用，避免两处模式能力漂移。
 */
export function VideoComposer({
  draft,
  onChange,
  disabled,
}: {
  draft: VideoDraft;
  onChange: (next: VideoDraft) => void;
  disabled?: boolean;
}) {
  const [picking, setPicking] = useState<null | "first" | "last" | "images">(null);
  const suggest = useAiSuggest("/api/ai/video-prompt", "prompts");
  const patch = (next: Partial<VideoDraft>) => onChange({ ...draft, ...next });
  const mode = MODES.find((m) => m.value === draft.mode) ?? MODES[0];

  return (
    <div className="space-y-3">
      <div>
        <div className="mb-1 flex items-center justify-between gap-2">
          <label className="block text-xs text-zinc-400">画面描述 *</label>
          <SuggestButton
            label="AI 生成提示词"
            title="按当前构思生成一组可直接使用的画面提示词"
            busy={suggest.busy}
            onClick={() => void suggest.generate({ idea: draft.prompt })}
          />
        </div>
        <textarea
          className={cx(inputCls, "h-28 resize-none")}
          value={draft.prompt}
          onChange={(e) => patch({ prompt: e.target.value })}
          placeholder="例如：城市夜景延时摄影，车流灯光流动，镜头缓慢推近，4K 质感"
        />
        {suggest.error && <p className="mt-1 text-[11px] text-red-400">{suggest.error}</p>}
        <SuggestChips items={suggest.items} value={draft.prompt} onPick={(v) => patch({ prompt: v })} />
      </div>

      <div>
        <div className="mb-1 flex items-center gap-1 rounded-lg bg-zinc-950/70 p-1">
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              disabled={disabled}
              title={m.hint}
              onClick={() => patch({ mode: m.value })}
              className={cx(
                "flex-1 rounded-md px-2 py-1 text-[11px] transition disabled:opacity-50",
                draft.mode === m.value ? "bg-indigo-600 text-white" : "text-zinc-400 hover:text-zinc-100",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="text-[11px] leading-4 text-zinc-600">{mode.hint}</p>

        {draft.mode === "keyframe" && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <FrameSlot label="首帧" refValue={draft.firstFrame} onPick={() => setPicking("first")} onClear={() => patch({ firstFrame: "" })} />
            <FrameSlot label="尾帧" refValue={draft.lastFrame} onPick={() => setPicking("last")} onClear={() => patch({ lastFrame: "" })} />
          </div>
        )}

        {draft.mode === "reference" && (
          <div className="mt-2 space-y-2">
            <div className="grid grid-cols-3 gap-2">
              {draft.images.map((ref) => (
                <FrameSlot
                  key={ref}
                  label="参考图"
                  refValue={ref}
                  onPick={() => setPicking("images")}
                  onClear={() => patch({ images: draft.images.filter((r) => r !== ref) })}
                />
              ))}
              {draft.images.length < MAX_IMAGES && (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => setPicking("images")}
                  className="flex h-20 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-zinc-700 text-[11px] text-zinc-500 transition hover:border-indigo-600 hover:text-zinc-300 disabled:opacity-50"
                >
                  <ImagePlus className="h-4 w-4" />
                  加参考图
                </button>
              )}
            </div>
            <p className="text-[11px] text-zinc-600">
              已选 {draft.images.length}/{MAX_IMAGES} 张；提示词里可用 <code>&lt;Picture 1&gt;</code> 指代第 1 张。
            </p>
          </div>
        )}
      </div>

      {picking && (
        <MediaPicker
          kind="image"
          aiGenerate
          onPick={(ref) => {
            if (picking === "first") patch({ firstFrame: ref });
            else if (picking === "last") patch({ lastFrame: ref });
            else patch({ images: draft.images.includes(ref) ? draft.images : [...draft.images, ref].slice(0, MAX_IMAGES) });
            setPicking(null);
          }}
          onClose={() => setPicking(null)}
        />
      )}
    </div>
  );
}
