"use client";

import { useEffect, useRef } from "react";
import { animate, motion, useInView, useMotionValue, useReducedMotion, useScroll, useTransform } from "motion/react";
import { ArrowDown, Sparkles } from "lucide-react";
import { EASE_OUT, riseIn, staggerContainer } from "@/lib/motion";
import { useIsoLayoutEffect } from "@/lib/use-iso-layout-effect";
import { MagneticLink } from "./effects";

export type HeroStat = { label: string; value: number; href: string };

/** 桌面端按数量等分；字面量写成映射表，静态可被 Tailwind 扫描到 */
const STAT_COLS: Record<number, string> = {
  1: "sm:grid-cols-1",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-4",
};

/**
 * 首屏：视频墙 + 标题编排。
 *
 * 素材库里没有静帧（封面与作品全是 .mp4），所以背景用静音循环视频拼成。
 * 视差只作用于装饰层——正文永不位移，避免阅读不适与动效晕眩（parallax-subtle）。
 */
export default function Hero({
  tiles,
  stats,
  primaryHref,
  primaryLabel,
  browseHref,
}: {
  tiles: string[];
  stats: HeroStat[];
  primaryHref: string;
  primaryLabel: string;
  browseHref: string;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const inView = useInView(sectionRef, { amount: 0.2 });

  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end start"] });
  const mosaicY = useTransform(scrollYProgress, [0, 1], ["0%", "10%"]);
  const glowY = useTransform(scrollYProgress, [0, 1], ["0%", "20%"]);

  // 装饰视频只在首屏可见、未要求减少动效、且标签页可见时播放；否则一律暂停
  useEffect(() => {
    const videos = sectionRef.current?.querySelectorAll("video");
    if (!videos?.length) return;

    const sync = () => {
      const hidden = document.visibilityState === "hidden";
      videos.forEach((v) => {
        if (inView && !reduce && !hidden) {
          void v.play().catch(() => {});
        } else {
          v.pause();
        }
      });
    };

    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, [inView, reduce]);

  return (
    <section
      ref={sectionRef}
      className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-24"
    >
      {/* 装饰层：视频墙 → 极光 → 网格 → 压暗，全部 aria-hidden */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        {tiles.length > 0 && (
          <motion.div
            className="parallax-layer mosaic-mask absolute inset-0 opacity-35"
            style={{ y: reduce ? 0 : mosaicY }}
          >
            <div className="mosaic-grid">
              {tiles.map((src, i) => (
                <div key={`${src}-${i}`} className="mosaic-tile">
                  <video src={src} muted loop playsInline autoPlay={!reduce} preload="metadata" tabIndex={-1} />
                </div>
              ))}
            </div>
          </motion.div>
        )}

        <motion.div className="parallax-layer absolute inset-0" style={{ y: reduce ? 0 : glowY }}>
          <span className="aurora aurora-1 anim-aurora-a -left-40 -top-40 h-[40rem] w-[40rem]" />
          <span className="aurora aurora-2 anim-aurora-b -bottom-56 right-0 h-[34rem] w-[34rem]" />
        </motion.div>

        <div className="bg-grid-faint absolute inset-0" />
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/75 via-zinc-950/55 to-zinc-950" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-3xl text-center">
        <motion.div variants={staggerContainer(0.08, 0.1)} initial="hidden" animate="show">
          <motion.p
            variants={riseIn}
            className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700/70 bg-zinc-900/60 px-3 py-1 text-xs text-zinc-300 backdrop-blur"
          >
            <Sparkles className="h-3.5 w-3.5 text-indigo-400" aria-hidden />
            AI 生成图文 · 智能洗稿 · 公众号排版
          </motion.p>

          <motion.h1
            variants={riseIn}
            className="mt-6 text-4xl font-bold leading-[1.15] tracking-tight text-zinc-50 sm:text-5xl lg:text-6xl"
          >
            把灵感
            <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
              变成作品
            </span>
          </motion.h1>

          <motion.p variants={riseIn} className="mx-auto mt-5 max-w-xl text-sm leading-7 text-zinc-300 sm:text-base">
            这里汇总创作台产出的图片、文章、剧集与视频成片；登录后可创作、排版并发布你的内容。
          </motion.p>

          {/* 分类计数兼锚点导航：同时兜底移动端隐藏的顶部导航 */}
          <motion.ul
            variants={riseIn}
            className={`mx-auto mt-10 grid max-w-lg grid-cols-2 gap-px overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-800/40 ${
              STAT_COLS[stats.length] ?? "sm:grid-cols-4"
            }`}
          >
            {stats.map((s, i) => (
              <li key={s.label} className="bg-zinc-950/70 backdrop-blur-sm">
                <a
                  href={s.href}
                  className="group flex flex-col items-center px-4 py-4 transition-colors duration-200 hover:bg-zinc-900/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-400/70"
                >
                  <StatCounter value={s.value} label={s.label} delay={0.35 + i * 0.1} />
                </a>
              </li>
            ))}
          </motion.ul>

          <motion.div variants={riseIn} className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <MagneticLink
              href={primaryHref}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-indigo-600 px-6 text-sm font-semibold text-white shadow-lg shadow-indigo-600/25 transition-colors duration-200 hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70"
            >
              {primaryLabel}
            </MagneticLink>
            <a
              href={browseHref}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-zinc-700 px-6 text-sm font-medium text-zinc-200 transition-colors duration-200 hover:border-zinc-500 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70"
            >
              浏览作品
            </a>
          </motion.div>
        </motion.div>
      </div>

      {/* 滚动提示：是真实锚点，键盘可达；减少动效时高光线停住 */}
      <a
        href={browseHref}
        className="absolute bottom-7 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-2 rounded text-[11px] tracking-[0.2em] text-zinc-400 transition-colors duration-200 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70"
      >
        向下探索
        <span aria-hidden className="relative block h-10 w-px overflow-hidden bg-zinc-700/70">
          <span className="anim-scroll-hint absolute inset-x-0 top-0 block h-4 bg-gradient-to-b from-transparent via-indigo-400 to-transparent" />
        </span>
        <ArrowDown className="h-3.5 w-3.5" aria-hidden />
      </a>
    </section>
  );
}

/**
 * 计数滚动。服务端直接渲染真实数值（无 JS 与爬虫看到的是正确数字），
 * 客户端在首次绘制前归零再滚上去，因此不会出现"先看到终值再跳回 0"的闪烁。
 */
function StatCounter({ value, label, delay }: { value: number; label: string; delay: number }) {
  const reduce = useReducedMotion();
  const counter = useMotionValue(value);
  const rounded = useTransform(counter, (v) => Math.round(v).toString());

  useIsoLayoutEffect(() => {
    if (reduce) {
      counter.set(value);
      return;
    }
    counter.set(0);
    const controls = animate(counter, value, { duration: 1.2, ease: EASE_OUT, delay });
    return () => controls.stop();
  }, [counter, value, delay, reduce]);

  return (
    <>
      <motion.span aria-hidden className="text-2xl font-semibold tabular-nums text-zinc-50">
        {rounded}
      </motion.span>
      <span className="mt-1 text-[11px] tracking-wide text-zinc-400 transition-colors duration-200 group-hover:text-zinc-200">
        {label}
      </span>
    </>
  );
}
