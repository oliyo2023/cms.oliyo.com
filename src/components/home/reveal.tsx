"use client";

import { motion, useReducedMotion, useSpring } from "motion/react";
import { useRef, type ReactNode } from "react";
import { DURATION, EASE_OUT, TILT_SPRING } from "@/lib/motion";

/**
 * 进入视口时淡入就位。`once` 保证每张卡片只播一次——来回滚动反复触发既费性能也打断阅读。
 */
export function Reveal({
  children,
  delay = 0,
  y = 24,
  className,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2, margin: "0px 0px -8% 0px" }}
      transition={{ duration: DURATION.slow, ease: EASE_OUT, delay }}
    >
      {children}
    </motion.div>
  );
}

/**
 * 卡片随光标做轻微 3D 倾斜，给平面网格一点纵深。
 *
 * 仅用 transform（不触发布局重排），幅度压到 ±7°；减少动效时直接渲染静态容器，
 * 不挂指针监听。同一屏只有被悬停的那一张在动，符合"一屏 1-2 个焦点元素"。
 */
export function Tilt({
  children,
  className,
  max = 7,
}: {
  children: ReactNode;
  className?: string;
  max?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const rotateX = useSpring(0, TILT_SPRING);
  const rotateY = useSpring(0, TILT_SPRING);

  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    if (reduce) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    rotateY.set(px * max * 2);
    rotateX.set(-py * max * 2);
  }

  function reset() {
    rotateX.set(0);
    rotateY.set(0);
  }

  if (reduce) return <div className={className}>{children}</div>;

  return (
    <motion.div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={reset}
      style={{ rotateX, rotateY, transformPerspective: 1000 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
