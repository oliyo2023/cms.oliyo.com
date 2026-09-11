"use client";

import Link from "next/link";
import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { Play } from "lucide-react";
import { useIsoLayoutEffect } from "@/lib/use-iso-layout-effect";
import { Reveal, Tilt } from "./reveal";

export type FeaturedWork = {
  id: string;
  href: string;
  title: string;
  subtitle: string;
  media: string;
  kind: string;
};

/**
 * 作品横向轨道：纵向滚动驱动横向位移。
 *
 * 降级策略全部走 CSS，不依赖 JS，因此不会在 hydration 后跳版：
 * - < 1024px：还原为普通网格。主内容区不做横向滑动，避免手势冲突。
 * - prefers-reduced-motion：同样还原为网格，彻底取消滚动接管（scroll-jacking）。
 * - 作品不足 2 件：服务端直接给 static，横向轨道没有意义。
 */
export default function WorksTrack({
  id,
  title,
  icon,
  description,
  items,
  total,
  limit,
  empty,
  editHref,
  canEdit,
}: {
  id: string;
  title: string;
  icon: ReactNode;
  description: string;
  items: FeaturedWork[];
  total: number;
  limit: number;
  empty: string;
  editHref: string;
  canEdit: boolean;
}) {
  const mode = items.length >= 2 ? "track" : "static";
  const sectionRef = useRef<HTMLElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLUListElement>(null);
  const reduce = useReducedMotion();
  const [distance, setDistance] = useState(0);

  // 在首次绘制前量出需要横向位移的像素数，避免可见的布局跳变
  useIsoLayoutEffect(() => {
    if (reduce || mode !== "track") {
      setDistance(0);
      return;
    }
    const measure = () => {
      const track = trackRef.current;
      const container = containerRef.current;
      if (!track || !container) return;
      setDistance(Math.max(0, track.scrollWidth - container.clientWidth));
    };
    measure();
    window.addEventListener("resize", measure);
    const observer = new ResizeObserver(measure);
    if (trackRef.current) observer.observe(trackRef.current);
    return () => {
      window.removeEventListener("resize", measure);
      observer.disconnect();
    };
  }, [reduce, mode]);

  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end end"] });
  const x = useTransform(scrollYProgress, [0, 1], [0, -distance]);

  // Tab 到轨道外的卡片时把纵向滚动带过去，否则焦点会停在视口外（WCAG 2.2 AA）
  function revealCard(index: number) {
    const section = sectionRef.current;
    if (!section || distance <= 0) return;
    const range = section.offsetHeight - window.innerHeight;
    if (range <= 0) return;
    const progress = items.length > 1 ? index / (items.length - 1) : 0;
    window.scrollTo({
      top: window.scrollY + section.getBoundingClientRect().top + progress * range,
      behavior: "smooth",
    });
  }

  const hidden = total - Math.min(total, limit);

  return (
    <section
      ref={sectionRef}
      id={id}
      data-mode={mode}
      style={{ "--track-h": `calc(100dvh + ${(items.length - 1) * 46}vw)` } as CSSProperties}
      className="works-section relative scroll-mt-20 border-t border-zinc-800/70 py-10"
    >
      <div ref={containerRef} className="works-sticky px-4 sm:px-6 lg:px-0">
        <div className="mb-6 lg:px-[6vw]">
          <div className="flex items-center gap-2.5">
            <span
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600/15 text-indigo-400"
              aria-hidden="true"
            >
              {icon}
            </span>
            <h2 className="text-lg font-semibold text-zinc-100">{title}</h2>
            <span className="text-sm tabular-nums text-zinc-400">{total}</span>
            {canEdit && (
              <Link href={editHref} className="ml-auto text-xs text-zinc-400 transition hover:text-indigo-300">
                管理 →
              </Link>
            )}
          </div>
          <p className="mt-2 text-sm text-zinc-400">{description}</p>
        </div>

        {items.length === 0 ? (
          <div className="lg:px-[6vw]">
            <p className="mx-auto max-w-md rounded-xl border border-dashed border-zinc-800 px-4 py-5 text-center text-xs text-zinc-400">
              {empty}
              {" · "}
              <Link href={canEdit ? editHref : "/login"} className="text-indigo-400 transition hover:underline">
                {canEdit ? "去发布 →" : "登录后发布 →"}
              </Link>
            </p>
          </div>
        ) : (
          <>
            <motion.ul ref={trackRef} style={reduce ? undefined : { x }} className="works-track">
              {items.slice(0, limit).map((item, i) => (
                <li key={item.id} className="works-item min-w-0">
                  <Reveal delay={Math.min(i * 0.06, 0.36)}>
                    <Tilt className="h-full">
                      <Link
                        href={item.href}
                        onFocus={() => revealCard(i)}
                        className="group relative block overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 transition-colors duration-300 hover:border-indigo-500/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70"
                      >
                        <span className="relative block aspect-[16/10] overflow-hidden bg-zinc-950">
                          <video
                            src={item.media}
                            muted
                            playsInline
                            preload="metadata"
                            aria-hidden="true"
                            tabIndex={-1}
                            className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                          />
                          <span className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent" />
                          <span className="absolute left-3 top-3 rounded-md border border-white/15 bg-black/50 px-2 py-0.5 text-[11px] text-zinc-200 backdrop-blur">
                            {item.kind}
                          </span>
                          <span
                            aria-hidden="true"
                            className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/70 text-white ring-1 ring-white/20 transition-colors duration-300 group-hover:bg-indigo-600"
                          >
                            <Play className="h-3.5 w-3.5" />
                          </span>
                        </span>
                        <span className="absolute inset-x-0 bottom-0 block p-4 pr-14">
                          <h3 className="truncate text-sm font-semibold text-white">{item.title}</h3>
                          <span className="mt-1 block line-clamp-2 text-xs leading-5 text-zinc-300">
                            {item.subtitle}
                          </span>
                        </span>
                      </Link>
                    </Tilt>
                  </Reveal>
                </li>
              ))}
            </motion.ul>
            {hidden > 0 && (
              <p className="mt-4 text-xs text-zinc-400 lg:px-[6vw]">
                共 {total} 件，此处展示前 {limit} 件。
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
