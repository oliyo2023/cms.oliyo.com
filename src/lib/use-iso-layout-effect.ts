import { useEffect, useLayoutEffect } from "react";

/**
 * 测量类副作用需要在浏览器绘制前完成，否则用户会看到一次布局跳变（CLS）。
 * 服务端没有 layout effect，降级为 useEffect 以避免 SSR 警告。
 */
export const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;
