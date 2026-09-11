"use client";

import { useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { btnPrimary, cx, inputCls } from "@/components/ui";

/** 修改当前登录账户（管理员）的密码。 */
export default function PasswordCard() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (next.length < 8) {
      setNotice({ ok: false, text: "新密码至少 8 位" });
      return;
    }
    if (next !== confirm) {
      setNotice({ ok: false, text: "两次输入的新密码不一致" });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setNotice({ ok: false, text: data.error ?? "修改失败" });
        return;
      }
      setCurrent("");
      setNext("");
      setConfirm("");
      setNotice({ ok: true, text: "密码已更新，下次登录请使用新密码" });
    } catch {
      setNotice({ ok: false, text: "网络错误" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
      <div className="flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-indigo-400" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-zinc-100">账户安全</h2>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-zinc-500">
        修改当前登录账户的密码；至少 8 位。用第三方登录创建的账户没有本地密码，可直接在这里设置一个。
      </p>

      <form className="mt-5 grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" onSubmit={(e) => void submit(e)}>
        <div className="sm:col-span-2 sm:max-w-md">
          <label className="mb-1.5 block text-sm text-zinc-300" htmlFor="pw-current">
            当前密码
          </label>
          <input
            id="pw-current"
            type="password"
            autoComplete="current-password"
            className={inputCls}
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            placeholder="第三方登录的账户可留空"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm text-zinc-300" htmlFor="pw-next">
            新密码
          </label>
          <input
            id="pw-next"
            type="password"
            autoComplete="new-password"
            className={inputCls}
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm text-zinc-300" htmlFor="pw-confirm">
            确认新密码
          </label>
          <input
            id="pw-confirm"
            type="password"
            autoComplete="new-password"
            className={inputCls}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <button type="submit" className={btnPrimary} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <KeyRound className="h-4 w-4" aria-hidden="true" />}
            修改密码
          </button>
          {notice && (
            <p
              role="status"
              aria-live="polite"
              className={cx("text-xs", notice.ok ? "text-emerald-400" : "text-red-400")}
            >
              {notice.text}
            </p>
          )}
        </div>
      </form>
    </section>
  );
}
