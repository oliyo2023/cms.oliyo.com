"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, KeyRound, Loader2, Plus, Settings2, Trash2, UserCog } from "lucide-react";
import { btnGhost, btnPrimary, cx, inputCls } from "@/components/ui";
import Modal from "@/components/modal";

type MetricKey = "textChars" | "rewriteChars" | "images" | "videos";

type UserRow = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "user";
  quotas: Record<MetricKey, number>;
  usage: Record<MetricKey, number>;
  createdAt: number;
};

const METRICS: Array<{ key: MetricKey; label: string; unit: string }> = [
  { key: "textChars", label: "文本生成", unit: "字" },
  { key: "rewriteChars", label: "智能洗稿", unit: "字" },
  { key: "images", label: "图片生成", unit: "张" },
  { key: "videos", label: "视频生成", unit: "个" },
];

const UNLIMITED = -1;
const NO_USAGE: Record<MetricKey, number> = { textChars: 0, rewriteChars: 0, images: 0, videos: 0 };
const iconBtn = "rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-800";

function parseRows(json: string): UserRow[] {
  try {
    const raw: unknown = JSON.parse(json);
    if (!Array.isArray(raw)) return [];
    return raw as UserRow[];
  } catch {
    return [];
  }
}

/** 用量 / 配额进度：配额越界时标签转红（与总览页同一套样式）。 */
function QuotaMeter({ label, used, limit, unit }: { label: string; used: number; limit: number; unit: string }) {
  const unlimited = limit < 0;
  const within = unlimited || used <= limit;
  const pct = unlimited || limit === 0 ? 0 : Math.min(100, (used / limit) * 100);
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className={cx("truncate", within ? "text-zinc-400" : "font-medium text-red-400")}>{label}</span>
        <span className="shrink-0 tabular-nums text-zinc-500">
          {used.toLocaleString()} / {unlimited ? "不限" : limit.toLocaleString()} {unit}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-zinc-800">
        <div className="h-full rounded-full bg-indigo-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function UsersClient({ meId, initialJson }: { meId: string; initialJson: string }) {
  const router = useRouter();
  const [rows, setRows] = useState<UserRow[]>(() => parseRows(initialJson));
  const [creating, setCreating] = useState(false);
  const [quotasFor, setQuotasFor] = useState<UserRow | null>(null);
  const [pwFor, setPwFor] = useState<UserRow | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const notify = (text: string, ok = true) => {
    setNotice({ ok, text });
    window.setTimeout(() => setNotice(null), 3000);
  };

  async function patch(id: string, body: Record<string, unknown>) {
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        notify(data.error ?? "保存失败", false);
        return false;
      }
      router.refresh();
      return true;
    } catch {
      notify("网络错误", false);
      return false;
    }
  }

  async function remove(u: UserRow) {
    if (u.id === meId) return;
    if (!confirm(`删除用户 ${u.name}（${u.email}）？其内容仍保留。`)) return;
    const res = await fetch(`/api/admin/users?id=${encodeURIComponent(u.id)}`, { method: "DELETE" });
    if (res.ok) {
      setRows((prev) => prev.filter((r) => r.id !== u.id));
      notify("已删除用户");
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      {notice && (
        <div
          role="status"
          aria-live="polite"
          className={cx(
            "rounded-lg border px-4 py-2.5 text-sm",
            notice.ok
              ? "border-emerald-800 bg-emerald-900/30 text-emerald-300"
              : "border-red-900 bg-red-950/40 text-red-300",
          )}
        >
          {notice.text}
        </div>
      )}

      <div className="flex justify-end">
        <button className={btnPrimary} onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          添加用户
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-800">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-zinc-800 bg-zinc-900/70 text-xs text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-medium">用户</th>
              <th className="px-4 py-3 font-medium">角色</th>
              <th className="px-4 py-3 font-medium">本月用量 / 配额</th>
              <th className="px-4 py-3 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/70">
            {rows.map((u) => (
              <tr key={u.id} className="bg-zinc-900/30 align-top">
                <td className="px-4 py-4">
                  <div className="font-medium text-zinc-100">
                    {u.name}
                    {u.id === meId && <span className="ml-1.5 text-[10px] text-zinc-500">(我)</span>}
                  </div>
                  <div className="text-xs text-zinc-500">{u.email}</div>
                </td>
                <td className="px-4 py-4">
                  <span
                    className={cx(
                      "rounded-full px-2 py-0.5 text-[11px]",
                      u.role === "admin" ? "bg-indigo-600/20 text-indigo-300" : "bg-zinc-800 text-zinc-400",
                    )}
                  >
                    {u.role === "admin" ? "管理员" : "用户"}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <div className="grid grid-cols-1 gap-x-8 gap-y-3 lg:grid-cols-2">
                    {METRICS.map((m) => (
                      <QuotaMeter
                        key={m.key}
                        label={m.label}
                        used={u.usage[m.key]}
                        limit={u.quotas[m.key]}
                        unit={m.unit}
                      />
                    ))}
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      title="配额与角色"
                      aria-label={`编辑 ${u.name} 的配额与角色`}
                      className={cx(iconBtn, "hover:text-zinc-200")}
                      onClick={() => setQuotasFor(u)}
                    >
                      <Settings2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      title="重置密码"
                      aria-label={`重置 ${u.name} 的密码`}
                      className={cx(iconBtn, "hover:text-zinc-200")}
                      onClick={() => setPwFor(u)}
                    >
                      <KeyRound className="h-4 w-4" aria-hidden="true" />
                    </button>
                    {u.id !== meId && (
                      <button
                        type="button"
                        title="删除用户"
                        aria-label={`删除用户 ${u.name}`}
                        className={cx(iconBtn, "hover:text-red-400")}
                        onClick={() => void remove(u)}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-zinc-600">
        配额为每月上限，每月 1 日重置用量；「不限」= -1，配额变更即时生效，不影响本月已用量。
      </p>

      {quotasFor && (
        <QuotaDialog
          user={quotasFor}
          isSelf={quotasFor.id === meId}
          onClose={() => setQuotasFor(null)}
          onSaved={(role, quotas) => {
            setRows((prev) => prev.map((r) => (r.id === quotasFor.id ? { ...r, role, quotas } : r)));
            setQuotasFor(null);
            notify("已保存");
          }}
        />
      )}
      {pwFor && (
        <PasswordDialog
          user={pwFor}
          onClose={() => setPwFor(null)}
          onSaved={() => {
            setPwFor(null);
            notify("密码已重置");
          }}
        />
      )}
      {creating && (
        <CreateUserDialog
          onClose={() => setCreating(false)}
          onCreated={(u) => {
            setRows((prev) => [...prev, u]);
            setCreating(false);
            notify(`已创建 ${u.name}`);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

/** 配额与角色：一次只编辑一个用户，避免表格里堆满输入框。 */
function QuotaDialog({
  user,
  isSelf,
  onSaved,
  onClose,
}: {
  user: UserRow;
  isSelf: boolean;
  onSaved: (role: "admin" | "user", quotas: Record<MetricKey, number>) => void;
  onClose: () => void;
}) {
  const [role, setRole] = useState<"admin" | "user">(user.role);
  const [quotas, setQuotas] = useState<Record<MetricKey, number>>(user.quotas);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const changed = role !== user.role || METRICS.some((m) => quotas[m.key] !== user.quotas[m.key]);

  async function save() {
    setBusy(true);
    setError("");
    const body: Record<string, unknown> = {
      quotaTextChars: quotas.textChars,
      quotaRewriteChars: quotas.rewriteChars,
      quotaImages: quotas.images,
      quotaVideos: quotas.videos,
    };
    if (role !== user.role) body.role = role;
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "保存失败");
        return;
      }
      onSaved(role, quotas);
    } catch {
      setError("网络错误");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`${user.name} · 配额与角色`} onClose={onClose}>
      <div className="space-y-5">
        <div>
          <p className="mb-1.5 text-sm text-zinc-300">角色</p>
          <div className="flex gap-2">
            {(["user", "admin"] as const).map((r) => {
              const disabled = isSelf && r === "user";
              return (
                <button
                  key={r}
                  type="button"
                  disabled={disabled}
                  aria-pressed={role === r}
                  title={disabled ? "不能取消自己的管理员" : undefined}
                  onClick={() => setRole(r)}
                  className={cx(
                    "flex-1 rounded-lg border px-3 py-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-50",
                    role === r
                      ? "border-indigo-500 bg-indigo-600/10 text-indigo-300"
                      : "border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200",
                  )}
                >
                  {r === "admin" ? "管理员" : "普通用户"}
                </button>
              );
            })}
          </div>
          {isSelf && <p className="mt-1.5 text-xs text-zinc-500">这是你自己的账号，不能降级为普通用户。</p>}
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          {METRICS.map((m) => {
            const unlimited = quotas[m.key] < 0;
            return (
              <div key={m.key}>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <label htmlFor={`quota-${m.key}`} className="text-sm text-zinc-300">
                    {m.label}
                  </label>
                  <button
                    type="button"
                    aria-pressed={unlimited}
                    onClick={() => setQuotas((p) => ({ ...p, [m.key]: unlimited ? 0 : UNLIMITED }))}
                    className={cx(
                      "rounded px-1.5 py-0.5 text-[11px] transition",
                      unlimited
                        ? "bg-indigo-600/20 text-indigo-300"
                        : "text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300",
                    )}
                  >
                    不限
                  </button>
                </div>
                <input
                  id={`quota-${m.key}`}
                  type="number"
                  min={0}
                  disabled={unlimited}
                  className={cx(inputCls, "tabular-nums disabled:cursor-not-allowed disabled:opacity-50")}
                  value={unlimited ? "" : quotas[m.key]}
                  placeholder={unlimited ? "不限量" : undefined}
                  onChange={(e) =>
                    setQuotas((p) => ({ ...p, [m.key]: Math.max(0, Math.floor(Number(e.target.value) || 0)) }))
                  }
                />
                <p className="mt-1.5 text-xs text-zinc-500">
                  本月已用 {user.usage[m.key].toLocaleString()} {m.unit}
                </p>
              </div>
            );
          })}
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex justify-end gap-2">
          <button className={btnGhost} onClick={onClose}>
            取消
          </button>
          <button className={btnPrimary} disabled={busy || !changed} onClick={() => void save()}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            保存
          </button>
        </div>
      </div>
    </Modal>
  );
}

function PasswordDialog({ user, onSaved, onClose }: { user: UserRow; onSaved: () => void; onClose: () => void }) {
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (password.length < 8) {
      setError("密码至少 8 位");
      return;
    }
    if (password !== again) {
      setError("两次输入的密码不一致");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "重置失败");
        return;
      }
      onSaved();
    } catch {
      setError("网络错误");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`重置密码 · ${user.name}`} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label htmlFor="new-password" className="mb-1.5 block text-sm text-zinc-300">
            新密码
          </label>
          <div className="relative">
            <input
              id="new-password"
              type={show ? "text" : "password"}
              className={cx(inputCls, "pr-9")}
              value={password}
              autoComplete="new-password"
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShow(!show)}
              aria-label={show ? "隐藏密码" : "显示密码"}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-500 transition hover:text-zinc-300"
            >
              {show ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
            </button>
          </div>
        </div>
        <div>
          <label htmlFor="new-password-again" className="mb-1.5 block text-sm text-zinc-300">
            确认密码
          </label>
          <input
            id="new-password-again"
            type={show ? "text" : "password"}
            className={inputCls}
            value={again}
            autoComplete="new-password"
            onChange={(e) => setAgain(e.target.value)}
          />
          <p className="mt-1.5 text-xs text-zinc-500">至少 8 位；重置后该用户需用新密码重新登录。</p>
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex justify-end gap-2">
          <button className={btnGhost} onClick={onClose}>
            取消
          </button>
          <button className={btnPrimary} disabled={busy} onClick={() => void submit()}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            重置密码
          </button>
        </div>
      </div>
    </Modal>
  );
}

function CreateUserDialog({ onCreated, onClose }: { onCreated: (u: UserRow) => void; onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [role, setRole] = useState<"user" | "admin">("user");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function create() {
    if (!email.trim() || !name.trim() || password.length < 8) {
      setError("请填写邮箱、昵称与至少 8 位密码");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          name: name.trim(),
          password,
          role,
          quotaTextChars: 0,
          quotaImages: 0,
          quotaVideos: 0,
          quotaRewriteChars: 0,
        }),
      });
      const data = (await res.json()) as { user?: Omit<UserRow, "usage">; error?: string };
      if (!res.ok || !data.user) {
        setError(data.error ?? "创建失败");
        return;
      }
      onCreated({ ...data.user, usage: { ...NO_USAGE } });
    } catch {
      setError("网络错误");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="添加用户" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label htmlFor="new-user-email" className="mb-1.5 block text-sm text-zinc-300">
            邮箱 <span className="text-red-400">*</span>
          </label>
          <input
            id="new-user-email"
            type="email"
            className={inputCls}
            value={email}
            autoComplete="off"
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="new-user-name" className="mb-1.5 block text-sm text-zinc-300">
            昵称 <span className="text-red-400">*</span>
          </label>
          <input
            id="new-user-name"
            className={inputCls}
            value={name}
            autoComplete="off"
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="new-user-password" className="mb-1.5 block text-sm text-zinc-300">
            初始密码 <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <input
              id="new-user-password"
              type={show ? "text" : "password"}
              className={cx(inputCls, "pr-9")}
              value={password}
              autoComplete="new-password"
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShow(!show)}
              aria-label={show ? "隐藏密码" : "显示密码"}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-500 transition hover:text-zinc-300"
            >
              {show ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
            </button>
          </div>
          <p className="mt-1.5 text-xs text-zinc-500">至少 8 位；请转告用户首次登录后自行修改。</p>
        </div>
        <div>
          <p className="mb-1.5 text-sm text-zinc-300">角色</p>
          <div className="flex gap-2">
            {(["user", "admin"] as const).map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={role === r}
                onClick={() => setRole(r)}
                className={cx(
                  "flex-1 rounded-lg border px-3 py-2 text-sm transition",
                  role === r
                    ? "border-indigo-500 bg-indigo-600/10 text-indigo-300"
                    : "border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200",
                )}
              >
                {r === "admin" ? "管理员" : "普通用户"}
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs text-zinc-500">
          <UserCog className="mr-1 inline h-3.5 w-3.5 align-[-2px]" aria-hidden="true" />
          新用户配额默认 0，创建后用行尾的「配额与角色」调整。
        </p>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex justify-end gap-2">
          <button className={btnGhost} onClick={onClose}>
            取消
          </button>
          <button className={btnPrimary} disabled={busy} onClick={() => void create()}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            创建
          </button>
        </div>
      </div>
    </Modal>
  );
}
