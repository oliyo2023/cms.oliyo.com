"use client";

import { motion, useReducedMotion, useSpring } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { CURSOR_SPRING, MAGNETIC_SPRING } from "@/lib/motion";

/**
 * 跟随光标的环境光。
 *
 * 只在精确指针设备（鼠标）上启用——触摸设备没有 hover，跟随手指只会是噪声；
 * 减少动效时完全不渲染，也不挂监听。图层 pointer-events-none，不影响交互与焦点。
 */
export function CursorSpotlight() {
  const reduce = useReducedMotion();
  const x = useSpring(-1000, CURSOR_SPRING);
  const y = useSpring(-1000, CURSOR_SPRING);
  const [finePointer, setFinePointer] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(pointer: fine)");
    const sync = () => setFinePointer(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!finePointer || reduce) return;
    const onMove = (e: PointerEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [finePointer, reduce, x, y]);

  if (!finePointer || reduce) return null;

  return (
    <motion.div aria-hidden style={{ x, y }} className="pointer-events-none fixed left-0 top-0 z-20 mix-blend-screen">
      <div
        className="h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(99,102,241,0.10), transparent 62%)" }}
      />
    </motion.div>
  );
}

/**
 * 磁吸主行动点：光标靠近时按钮轻微被吸引过去。
 *
 * 拉力钳制在 0.3，元素永远不会离开自己的点击热区；松开即用弹簧回到原位。
 * 一屏只用一次（主 CTA），否则会变成噪声。
 */
export function MagneticLink({
  href,
  children,
  className,
  strength = 0.3,
}: {
  href: string;
  children: ReactNode;
  className?: string;
  strength?: number;
}) {
  const ref = useRef<HTMLAnchorElement>(null);
  const reduce = useReducedMotion();
  const x = useSpring(0, MAGNETIC_SPRING);
  const y = useSpring(0, MAGNETIC_SPRING);

  function onMove(e: React.PointerEvent<HTMLAnchorElement>) {
    if (reduce) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    x.set((e.clientX - r.left - r.width / 2) * strength);
    y.set((e.clientY - r.top - r.height / 2) * strength);
  }

  function reset() {
    x.set(0);
    y.set(0);
  }

  return (
    <motion.a
      ref={ref}
      href={href}
      onPointerMove={onMove}
      onPointerLeave={reset}
      style={reduce ? undefined : { x, y }}
      className={className}
    >
      {children}
    </motion.a>
  );
}
