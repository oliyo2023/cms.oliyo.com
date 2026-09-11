"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cx } from "@/components/ui";
import { useIsoLayoutEffect } from "@/lib/use-iso-layout-effect";

/** 与 manage/layout.tsx 的引导脚本共用同一 key 与取值。 */
const STORAGE_KEY = "cms.admin.theme";

type ThemeMode = "light" | "dark" | "system";

const OPTIONS: Array<{ id: ThemeMode; label: string; icon: typeof Sun }> = [
  { id: "light", label: "浅色", icon: Sun },
  { id: "dark", label: "深色", icon: Moon },
  { id: "system", label: "跟随系统", icon: Monitor },
];

function readStored(): ThemeMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "light" || v === "dark" || v === "system" ? v : "system";
  } catch {
    // 隐私模式下 localStorage 不可读：回落默认档。
    return "system";
  }
}

/** 后台主题切换：浅色 / 深色 / 跟随系统，选择存在浏览器本地。 */
export default function ThemeToggle() {
  // 不在初始化器里读 localStorage：SSR 首帧与 hydration 必须一致，
  // 挂载后再同步；真正的首屏主题由 manage/layout.tsx 的引导脚本先行应用。
  const [mode, setMode] = useState<ThemeMode>("system");

  useEffect(() => {
    setMode(readStored());
  }, []);

  // 在浏览器绘制前应用主题：服务端渲染的后台外壳在客户端导航进入时
  // （如登录后跳转）不会重跑 layout 的内联脚本，若放在普通 effect 里会先闪一帧错误主题。
  useIsoLayoutEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.adminTheme = mode === "system" ? (mq.matches ? "dark" : "light") : mode;
    };
    apply();
    if (mode === "system") mq.addEventListener("change", apply);
    return () => {
      mq.removeEventListener("change", apply);
      // 离开后台（客户端导航到公开站）时清掉属性，避免影响公开站。
      delete document.documentElement.dataset.adminTheme;
    };
  }, [mode]);

  function select(next: ThemeMode) {
    setMode(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // 写入失败不影响本次会话内的切换。
    }
  }

  return (
    <div className="flex items-center justify-between px-3 pt-1">
      <span className="text-[11px] text-zinc-500">主题</span>
      <div
        role="group"
        aria-label="界面主题"
        className="flex items-center gap-0.5 rounded-lg border border-zinc-800 bg-zinc-900/60 p-0.5"
      >
        {OPTIONS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={mode === id}
            onClick={() => select(id)}
            className={cx(
              "flex h-6 w-7 items-center justify-center rounded-md transition",
              mode === id ? "bg-zinc-800 text-zinc-100" : "text-zinc-500 hover:text-zinc-300",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        ))}
      </div>
    </div>
  );
}
