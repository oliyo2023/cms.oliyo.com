import type { Transition, Variants } from "motion/react";

/**
 * 全站共享动效 token。
 *
 * 所有页面共用这一套时长与缓动，保证节奏一致（motion-consistency）：入场用减速曲线
 * （ease-out），退场比入场更快（exit-faster-than-enter），微交互与光标跟随交给弹簧曲线。
 * 位移量刻意压小（y ≤ 24），读起来是"淡入就位"而不是"滑入"（parallax-subtle）。
 */

export const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];
export const EASE_IN_OUT: [number, number, number, number] = [0.65, 0, 0.35, 1];

export const DURATION = {
  /** 状态切换、图标互换 */
  micro: 0.18,
  /** 标题/文案 crossfade、条件字段展开 */
  fast: 0.24,
  /** 常规元素入场 */
  base: 0.36,
  /** 卡片等大块元素入场 */
  slow: 0.56,
} as const;

/** 通用入场：轻微上移 + 淡入 */
export const riseIn: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: DURATION.base, ease: EASE_OUT } },
};

/** 容器：让子元素依次入场，而不是齐刷刷出现 */
export function staggerContainer(stagger = 0.05, delayChildren = 0.08): Variants {
  return {
    hidden: {},
    show: { transition: { staggerChildren: stagger, delayChildren } },
  };
}

/** 卡片入场：带一点纵深，落定后不再有位移 */
export const cardIn: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.985 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: DURATION.slow, ease: EASE_OUT } },
};

/** 错误提示：抖动传达"出错了"的因果，而不是无声地出现 */
export const shakeIn: Variants = {
  hidden: { opacity: 0, x: 0 },
  show: {
    opacity: 1,
    x: [0, -6, 6, -4, 4, 0],
    transition: { duration: 0.4, ease: EASE_IN_OUT },
  },
  exit: { opacity: 0, transition: { duration: DURATION.micro, ease: EASE_OUT } },
};

/** 按压缩反馈 */
export const PRESS_SPRING: Transition = { type: "spring", stiffness: 420, damping: 30, mass: 0.7 };

/** 光标跟随（聚光灯、磁吸）——偏低频，避免指针抖动带来视觉噪声 */
export const CURSOR_SPRING: Transition = { type: "spring", stiffness: 140, damping: 22, mass: 0.5 };

/** 磁吸回弹——比光标跟随更紧，松手后迅速归位 */
export const MAGNETIC_SPRING: Transition = { type: "spring", stiffness: 260, damping: 20, mass: 0.5 };

/** 3D 倾斜跟随光标 */
export const TILT_SPRING: Transition = { type: "spring", stiffness: 220, damping: 26, mass: 0.6 };

/** 入场编排，供列表/网格按索引错开 */
export function staggerDelay(index: number, step = 0.06, max = 0.4): number {
  return Math.min(index * step, max);
}
