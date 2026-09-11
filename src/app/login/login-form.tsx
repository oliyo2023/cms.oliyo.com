"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Check, CircleAlert, Eye, EyeOff, Loader2 } from "lucide-react";
import { cx } from "@/components/ui";
import { cardIn, DURATION, EASE_OUT, PRESS_SPRING, shakeIn } from "@/lib/motion";

type Mode = "login" | "register";
type Status = "idle" | "busy" | "done";
type OAuthId = "github" | "google";

const fieldCls =
  "h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950/70 px-3.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition-colors duration-200 hover:border-zinc-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40";

/** 入场：按出场顺序给 40–60ms 的间隔，读作"依次就位"而不是"一起跳出" */
const fieldIn = (delay: number) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: DURATION.base, ease: EASE_OUT, delay },
});

export default function LoginForm({
  initialMode = "login",
  providers = [],
  oauthError = null,
}: {
  initialMode?: Mode;
  providers?: OAuthId[];
  oauthError?: string | null;
}) {
  const router = useRouter();
  const emailId = useId();
  const nameId = useId();
  const passwordId = useId();
  const errorId = useId();

  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(oauthError ?? "");
  const [status, setStatus] = useState<Status>("idle");

  const isRegister = mode === "register";
  const describedBy = error ? errorId : undefined;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (status !== "idle") return;
    setError("");
    setStatus("busy");
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isRegister ? { email, name, password } : { email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "请求失败，请稍后重试");
        setStatus("idle");
        return;
      }
      setStatus("done");
      router.push("/manage");
      router.refresh();
    } catch {
      setError("网络错误，请检查连接后重试");
      setStatus("idle");
    }
  }

  function switchMode() {
    setMode(isRegister ? "login" : "register");
    setError("");
  }

  return (
    <motion.div
      variants={cardIn}
      initial="hidden"
      animate="show"
      className="relative w-full rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-6 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-8"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-8 -top-px h-px bg-gradient-to-r from-transparent via-indigo-400/60 to-transparent"
      />

      <div className="min-h-16">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={mode}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: DURATION.fast, ease: EASE_OUT }}
          >
            <h2 className="text-xl font-semibold tracking-tight text-zinc-100">
              {isRegister ? "创建账号" : "欢迎回来"}
            </h2>
            <p className="mt-1.5 text-sm text-zinc-400">
              {isRegister ? "注册后即可开始创作与发布。" : "登录以进入创作台管理你的内容。"}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      {providers.length > 0 && (
        <motion.div {...fieldIn(0.07)} className="mt-6">
          <div className="flex flex-col gap-3">
            {providers.map((p) => (
              <a
                key={p}
                href={`/api/auth/${p}`}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/70 text-sm font-medium text-zinc-200 transition-colors duration-200 hover:border-zinc-600 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60"
              >
                {p === "github" ? (
                  <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 48 48" className="h-4 w-4" aria-hidden="true">
                    <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.09-4.33 6.64v5.52h7.02c4.12-3.78 6.59-9.36 6.59-16.17Z" />
                    <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.02-5.52c-1.95 1.31-4.45 2.08-7.54 2.08-5.79 0-10.7-3.91-12.45-9.16H4.34v5.71C7.97 41.36 15.47 46 24 46Z" />
                    <path fill="#FBBC05" d="M11.55 28.07c-.45-1.31-.7-2.71-.7-4.07s.25-2.76.7-4.07v-5.71H4.34C2.86 17.19 2 20.49 2 24c0 3.51.86 6.81 2.34 9.78l7.21-5.71Z" />
                    <path fill="#EA4335" d="M24 10.78c3.25 0 6.17 1.12 8.46 3.31l6.3-6.3C34.91 4.18 29.93 2 24 2 15.47 2 7.97 6.64 4.34 14.22l7.21 5.71c1.75-5.25 6.66-9.15 12.45-9.15Z" />
                  </svg>
                )}
                使用 {p === "github" ? "GitHub" : "Google"} 登录
              </a>
            ))}
          </div>
          <div className="my-4 flex items-center gap-3" aria-hidden="true">
            <span className="h-px flex-1 bg-zinc-800" />
            <span className="text-[11px] text-zinc-400">或</span>
            <span className="h-px flex-1 bg-zinc-800" />
          </div>
        </motion.div>
      )}

      <form onSubmit={submit} className={providers.length > 0 ? "mt-0" : "mt-6"}>
        <motion.div layout className="flex flex-col gap-4">
          <motion.div {...fieldIn(0.12)} layout>
            <label htmlFor={emailId} className="mb-1.5 block text-xs font-medium text-zinc-400">
              邮箱 <span aria-hidden className="text-indigo-400">*</span>
            </label>
            <input
              id={emailId}
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={fieldCls}
              placeholder="you@example.com"
              aria-describedby={describedBy}
            />
          </motion.div>

          <AnimatePresence initial={false} mode="popLayout">
            {isRegister && (
              <motion.div
                key="name"
                layout
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: DURATION.fast, ease: EASE_OUT }}
              >
                <label htmlFor={nameId} className="mb-1.5 block text-xs font-medium text-zinc-400">
                  昵称 <span aria-hidden className="text-indigo-400">*</span>
                </label>
                <input
                  id={nameId}
                  required
                  minLength={2}
                  autoComplete="nickname"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={fieldCls}
                  placeholder="怎么称呼你"
                />
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div {...fieldIn(0.17)} layout>
            <label htmlFor={passwordId} className="mb-1.5 block text-xs font-medium text-zinc-400">
              密码 <span aria-hidden className="text-indigo-400">*</span>
            </label>
            <div className="relative">
              <input
                id={passwordId}
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                autoComplete={isRegister ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={cx(fieldCls, "pr-12")}
                placeholder="至少 8 位"
                aria-describedby={describedBy}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "隐藏密码" : "显示密码"}
                aria-pressed={showPassword}
                className="absolute right-0 top-0 flex h-11 w-11 cursor-pointer items-center justify-center rounded-r-xl text-zinc-400 transition-colors duration-200 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60"
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={showPassword ? "hide" : "show"}
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.7 }}
                    transition={{ duration: DURATION.micro, ease: EASE_OUT }}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
                  </motion.span>
                </AnimatePresence>
              </button>
            </div>
          </motion.div>

          <AnimatePresence initial={false}>
            {error && (
              <motion.p
                key="error"
                id={errorId}
                role="alert"
                variants={shakeIn}
                initial="hidden"
                animate="show"
                exit="exit"
                className="flex items-start gap-2 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs leading-5 text-red-300"
              >
                <CircleAlert className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="min-w-0">{error}</span>
              </motion.p>
            )}
          </AnimatePresence>

          <motion.button
            {...fieldIn(0.22)}
            layout
            type="submit"
            disabled={status !== "idle"}
            whileHover={status === "idle" ? { y: -1 } : undefined}
            whileTap={status === "idle" ? { scale: 0.985 } : undefined}
            transition={PRESS_SPRING}
            className="group relative flex h-11 w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl bg-indigo-600 text-sm font-semibold text-white shadow-lg shadow-indigo-600/25 transition-colors duration-200 hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full motion-reduce:hidden"
            />
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={status === "idle" ? mode : status}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: DURATION.micro, ease: EASE_OUT }}
                className="flex items-center gap-2"
              >
                {status === "busy" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    正在{isRegister ? "注册" : "登录"}…
                  </>
                ) : status === "done" ? (
                  <>
                    <Check className="h-4 w-4" aria-hidden />
                    成功，正在跳转…
                  </>
                ) : (
                  <>
                    {isRegister ? "注册并登录" : "登录"}
                    <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
                  </>
                )}
              </motion.span>
            </AnimatePresence>
          </motion.button>
        </motion.div>
      </form>

      <motion.div {...fieldIn(0.27)} className="mt-5 flex items-center justify-center gap-1.5 text-xs text-zinc-400">
        <span>{isRegister ? "已有账号？" : "还没有账号？"}</span>
        <button
          type="button"
          onClick={switchMode}
          className="cursor-pointer rounded font-medium text-indigo-400 transition-colors duration-200 hover:text-indigo-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60"
        >
          {isRegister ? "去登录" : "注册一个"}
        </button>
      </motion.div>
    </motion.div>
  );
}
