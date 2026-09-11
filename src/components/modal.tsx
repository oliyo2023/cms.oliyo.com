"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";

/** 同时打开的弹窗栈；Esc 只应关闭最上面一层（如条目表单里再开素材库）。 */
const modalStack: string[] = [];

/** 通用弹窗：遮罩点击或 Esc 关闭，打开时焦点进入面板，标题作为可访问名称。 */
export default function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  useEffect(() => {
    modalStack.push(titleId);
    return () => {
      const i = modalStack.indexOf(titleId);
      if (i >= 0) modalStack.splice(i, 1);
    };
  }, [titleId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && modalStack[modalStack.length - 1] === titleId) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [titleId, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-zinc-700 bg-zinc-900 p-5 outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 id={titleId} className="text-sm font-medium text-zinc-100">
            {title}
          </h3>
          <button
            type="button"
            aria-label="关闭"
            onClick={onClose}
            className="rounded p-1 text-zinc-500 transition hover:text-zinc-200"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
