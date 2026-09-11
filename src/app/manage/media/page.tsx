import { redirect } from "next/navigation";
import { currentUser } from "@/lib/api";
import { listMedia } from "@/lib/repos/media";
import MediaClient from "./client";

export const dynamic = "force-dynamic";

export default async function MediaPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const sp = await searchParams;
  const kind =
    sp.kind === "image" || sp.kind === "video" || sp.kind === "audio" || sp.kind === "file" ? sp.kind : undefined;
  const rows = await listMedia(user.id, kind ? { kind } : undefined);
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-zinc-100">素材库</h1>
        <p className="mt-1 text-sm text-zinc-500">上传的图片/视频文件，供作品展示引用。</p>
      </header>
      <MediaClient initialJson={JSON.stringify(rows)} kind={kind} />
    </div>
  );
}
