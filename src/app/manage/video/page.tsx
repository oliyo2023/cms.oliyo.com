import { redirect } from "next/navigation";
import { currentUser } from "@/lib/api";
import { videoConfig } from "@/lib/ai";
import { listHistory } from "@/lib/repos/history";
import VideoClient, { type RecentVideo } from "./client";

export const dynamic = "force-dynamic";

export default async function VideoPage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  const [rows, cfg] = await Promise.all([listHistory(user.id, { limit: 12, kind: "video_gen" }), videoConfig()]);
  const recent: RecentVideo[] = [];
  for (const r of rows) {
    try {
      const extra = JSON.parse(r.extra) as { url?: unknown };
      if (typeof extra.url === "string" && extra.url) recent.push({ id: r.id, url: extra.url, createdAt: r.createdAt });
    } catch {
      // 历史里 extra 损坏的行直接跳过，不让它挡住整个列表
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-zinc-100">AI 视频</h1>
        <p className="mt-1 text-sm text-zinc-500">
          描述画面或给定首尾帧 / 参考图 → 异步生成视频 → 发布为公开站「视频成片」或先存草稿。
        </p>
      </header>
      <VideoClient recent={recent} configured={Boolean(cfg)} />
    </div>
  );
}
