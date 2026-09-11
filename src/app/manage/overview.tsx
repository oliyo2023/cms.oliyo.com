"use client";

import Link from "next/link";
import { useRef } from "react";
import { animate, motion, useReducedMotion } from "motion/react";
import { ArrowRight, FileText, Image as ImageIcon, Repeat2, Sparkles } from "lucide-react";
import { cardIn, DURATION, EASE_OUT, staggerContainer } from "@/lib/motion";
import { useIsoLayoutEffect } from "@/lib/use-iso-layout-effect";
import { cx } from "@/components/ui";

/**
 * 后台总览的展示层（客户端岛）。
 *
 * 页面本身是 Server Component（要查库），动效只落在这一层，避免把整页标成 "use client"
 * 而把数据查询也拖进客户端。所有时长/缓动取自 src/lib/motion.ts 的共享 token，
 * 与首页保持同一套节奏（motion-consistency）。
 */

export type StatItem = { key: string; label: string; sub: string; value: number; href: string };
export type QuotaItem = { label: string; used: number; limit: number; unit: string };

const STAT_STYLE: Record<string, { icon: typeof Sparkles; tint: string }> = {
  articles: { icon: FileText, tint: "bg-indigo-600/15 text-indigo-400" },
  video: { icon: ImageIcon, tint: "bg-violet-600/15 text-violet-400" },
  gallery: { icon: Sparkles, tint: "bg-emerald-600/15 text-emerald-400" },
  history: { icon: Repeat2, tint: "bg-sky-600/15 text-sky-400" },
};

const fmt = (n: number) => n.toLocaleString("zh-CN");

/**
 * 数字自增入场。
 *
 * 可见数字在 SSR 就渲染为 0，而不是最终值——否则 hydration 前会先绘制最终值，
 * 随后被补间重置为 0 再数上去，形成 3→0→1→2→3 的可见跳变（实测该窗口约 270ms，
 * 生产端首屏更慢）。屏幕阅读器依赖旁边 sr-only 的确切值，不受动画影响。
 */
function CountUp({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  const text = fmt(value);

  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduce || value === 0) {
      el.textContent = text;
      return;
    }
    el.textContent = "0";
    const controls = animate(0, value, {
      duration: DURATION.slow,
      ease: EASE_OUT,
      onUpdate: (v) => {
        el.textContent = fmt(Math.round(v));
      },
    });
    return () => {
      controls.stop();
      el.textContent = text;
    };
  }, [value, reduce, text]);

  return (
    <>
      <span ref={ref} aria-hidden="true" className="tabular-nums">
        0
      </span>
      <span className="sr-only">{text}</span>
    </>
  );
}

export function OverviewStats({ items }: { items: StatItem[] }) {
  return (
    <motion.section
      variants={staggerContainer(0.07)}
      initial="hidden"
      animate="show"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      {items.map(({ key, label, sub, value, href }) => {
        const { icon: Icon, tint } = STAT_STYLE[key] ?? STAT_STYLE.articles;
        return (
          <motion.div key={key} variants={cardIn}>
            <Link
              href={href}
              className="group flex h-full flex-col rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 transition-colors duration-200 hover:border-indigo-600/60 hover:bg-zinc-900 focus-visible:border-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60"
            >
              <div className="flex items-center gap-2.5">
                <span className={cx("flex h-8 w-8 items-center justify-center rounded-lg", tint)}>
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="text-xs text-zinc-400">{label}</span>
              </div>
              <div className="mt-3 text-2xl font-semibold text-zinc-100">
                <CountUp value={value} />
              </div>
              <div className="mt-1 flex items-center justify-between text-xs text-zinc-400">
                {sub}
                {/* 悬停与键盘聚焦都要给出口，不能只靠 hover */}
                <ArrowRight
                  className="h-3.5 w-3.5 -translate-x-1 opacity-0 transition duration-200 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100"
                  aria-hidden="true"
                />
              </div>
            </Link>
          </motion.div>
        );
      })}
    </motion.section>
  );
}

/** 配额阈值：仅用颜色不足以传达状态，因此同时给出文字标签。 */
function quotaTone(pct: number, over: boolean, unlimited: boolean) {
  if (unlimited) return { bar: "bg-zinc-600", text: "text-zinc-300", chip: "不限量", chipCls: "bg-zinc-800 text-zinc-400" };
  if (over) return { bar: "bg-red-500", text: "text-red-400", chip: "已超额", chipCls: "bg-red-950/60 text-red-300" };
  if (pct >= 80) return { bar: "bg-amber-500", text: "text-amber-400", chip: "接近上限", chipCls: "bg-amber-950/50 text-amber-300" };
  return { bar: "bg-indigo-500", text: "text-zinc-300", chip: null, chipCls: "" };
}

export function OverviewQuotas({ rows }: { rows: QuotaItem[] }) {
  return (
    <motion.div
      variants={staggerContainer(0.06)}
      initial="hidden"
      animate="show"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      {rows.map((r) => {
        const unlimited = r.limit < 0;
        const over = !unlimited && r.used > r.limit;
        const pct = unlimited || r.limit === 0 ? 0 : Math.min(100, (r.used / r.limit) * 100);
        const tone = quotaTone(pct, over, unlimited);
        const valueText = unlimited ? `本月已用 ${fmt(r.used)} ${r.unit}` : `${fmt(r.used)} / ${fmt(r.limit)} ${r.unit}`;

        return (
          <motion.div key={r.label} variants={cardIn} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className={cx("font-medium", tone.text)}>{r.label}</span>
              {tone.chip ? (
                <span className={cx("rounded px-1.5 py-0.5 text-[10px] font-medium", tone.chipCls)}>{tone.chip}</span>
              ) : (
                <span className="text-zinc-400 tabular-nums">{Math.round(pct)}%</span>
              )}
            </div>

            <div
              role="progressbar"
              aria-label={`${r.label}用量`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={unlimited ? undefined : Math.round(pct)}
              aria-valuetext={valueText}
              className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-800"
            >
              {/* 只做 transform 动画（scaleX），不动 width，避免每帧触发布局 */}
              <motion.div
                className={cx("h-full w-full origin-left rounded-full", tone.bar)}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: pct / 100 }}
                transition={{ duration: DURATION.slow, ease: EASE_OUT, delay: 0.12 }}
              />
            </div>

            <p className="mt-2 text-[11px] tabular-nums text-zinc-400">{valueText}</p>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
