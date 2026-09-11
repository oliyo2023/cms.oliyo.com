"use client";

import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";

/**
 * 全站统一的动效策略：`reducedMotion="user"` 会跟随系统的"减少动态效果"设置，
 * 自动跳过位移/缩放/布局类动画并直接落到最终态，只保留淡入淡出。
 *
 * 注意：它只作用于 motion 的声明式动画；手工绑定到 style 的 MotionValue
 * （视差、聚光灯、横向轨道）不受影响，那些位置需要各自显式判断 reduced motion。
 */
export default function MotionRoot({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
