import { redirect } from "next/navigation";
import { currentUser } from "@/lib/api";
import { listHistory } from "@/lib/repos/history";
import HistoryClient from "./client";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  const rows = await listHistory(user.id, { limit: 200 });
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-zinc-100">历史记录</h1>
        <p className="mt-1 text-sm text-zinc-500">AI 生成、洗稿与图片/视频生成的记录库。</p>
      </header>
      <HistoryClient initialJson={JSON.stringify(rows)} />
    </div>
  );
}
