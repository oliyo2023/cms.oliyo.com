"use client";

import { useEffect, useState } from "react";
import { Film } from "lucide-react";
import Modal from "@/components/modal";

type MediaRow = { id: string; key: string; name: string; kind: string };

/** 从素材库选择图片/视频；返回 r2:// 引用（与 showcase、编辑器共用的引用格式）。 */
export default function MediaPicker({
  kind,
  onPick,
  onClose,
}: {
  kind: "image" | "video";
  onPick: (ref: string) => void;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<MediaRow[] | null>(null);
  useEffect(() => {
    fetch(`/api/media?kind=${kind}`)
      .then((r) => r.json())
      .then((d: { media?: MediaRow[] }) => {
        const m = d.media;
        setRows(Array.isArray(m) ? m : []);
      })
      .catch(() => setRows([]));
  }, [kind]);

  return (
    <Modal title={`从素材库选择${kind === "image" ? "图片" : "视频"}`} onClose={onClose}>
      {rows === null && <p className="text-sm text-zinc-500">加载中…</p>}
      {rows !== null && rows.length === 0 && (
        <p className="text-sm text-zinc-500">素材库为空，请先到「素材库」上传。</p>
      )}
      <div className="grid grid-cols-3 gap-2">
        {rows?.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onPick(`r2://${m.key}`)}
            className="group overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 text-left transition hover:border-indigo-600"
            title={m.name}
          >
            {m.kind === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/media/${m.key}`} alt={m.name} className="h-20 w-full object-cover" />
            ) : (
              <div className="flex h-20 items-center justify-center bg-black">
                <Film className="h-6 w-6 text-zinc-600" aria-hidden="true" />
              </div>
            )}
            <div className="truncate px-1.5 py-1 text-[10px] text-zinc-500 group-hover:text-zinc-300">{m.name}</div>
          </button>
        ))}
      </div>
    </Modal>
  );
}
