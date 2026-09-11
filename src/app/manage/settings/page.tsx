import { redirect } from "next/navigation";
import { currentUser } from "@/lib/api";
import SettingsClient from "./client";
import PasswordCard from "./password-card";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/manage");
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-zinc-100">系统设置</h1>
        <p className="mt-1 text-sm text-zinc-500">
          模型凭据与参数、账户安全。配置优先级：此处保存值（数据库） &gt; 环境变量/Secret &gt; 内置默认（Agnes）；密钥保存后仅显示尾号。
        </p>
      </header>
      <SettingsClient />
      <PasswordCard />
    </div>
  );
}
