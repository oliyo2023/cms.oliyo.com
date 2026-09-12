"use client";

import { useState } from "react";
import { Loader2, WandSparkles } from "lucide-react";
import { btnGhost, cx } from "@/components/ui";
import type { SuggestField } from "@/lib/prompts";

type SuggestState = { items: string[]; busy: boolean; error: string };

/**
 * 候选文本接口（关键词 / 短剧设定 / 视频提示词）的客户端状态机。
 * 接口各自返回自己的字段名，这里按 field 取；失败一律收敛成可展示的文案。
 * 配合 <SuggestButton>、<SuggestChips> 使用，避免每个入口各写一份取数与错误处理。
 */
export function useAiSuggest(endpoint: string, field: SuggestField) {
  const [state, setState] = useState<SuggestState>({ items: [], busy: false, error: "" });

  async function generate(body: unknown) {
    setState((s) => ({ ...s, busy: true, error: "" }));
    let res: Response;
    try {
      res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      setState({ items: [], busy: false, error: "网络错误，请重试" });
      return;
    }
    const data = (await res.json().catch(() => null)) as (Record<string, unknown> & { error?: string }) | null;
    if (!res.ok) {
      setState({ items: [], busy: false, error: data?.error ?? "生成失败，请重试" });
      return;
    }
    const raw = data?.[field];
    const items = Array.isArray(raw) ? raw.filter((v): v is string => typeof v === "string" && v.trim() !== "") : [];
    setState({ items, busy: false, error: items.length === 0 ? "生成失败，请重试" : "" });
  }

  return { ...state, generate };
}

/** 标签行里的「AI 生成…」小按钮。 */
export function SuggestButton({
  label,
  busyLabel = "生成中…",
  title,
  busy,
  onClick,
}: {
  label: string;
  busyLabel?: string;
  title: string;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className={cx(btnGhost, "px-2 py-0.5 text-[11px]")} disabled={busy} onClick={onClick} title={title}>
      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <WandSparkles className="h-3 w-3" />}
      {busy ? busyLabel : label}
    </button>
  );
}

/** 候选 chips：点击填入对应输入框，当前值高亮。 */
export function SuggestChips({ items, value, onPick }: { items: string[]; value: string; onPick: (v: string) => void }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {items.map((k, i) => (
        <button
          key={`${i}-${k}`}
          type="button"
          onClick={() => onPick(k)}
          title="点击填入"
          className={cx(
            "rounded-lg border px-2 py-1 text-left text-[11px] leading-4 transition",
            value.trim() === k
              ? "border-indigo-500 bg-indigo-600/15 text-indigo-300"
              : "border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:border-indigo-600/60 hover:text-zinc-200",
          )}
        >
          {k}
        </button>
      ))}
    </div>
  );
}
