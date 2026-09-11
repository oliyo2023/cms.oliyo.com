"use client";

import { motion } from "motion/react";
import { FileText, ImageIcon, PenTool, Wand2 } from "lucide-react";
import { riseIn, staggerContainer } from "@/lib/motion";

const FEATURES = [
  { icon: ImageIcon, title: "AI 生成图文", desc: "一句话产出配图与正文" },
  { icon: Wand2, title: "智能洗稿", desc: "保留信息量，重写表达" },
  { icon: FileText, title: "公众号排版", desc: "一键排版并发布" },
];

export default function BrandPanel() {
  return (
    <section className="relative flex flex-col justify-center px-6 pb-4 pt-12 sm:px-10 lg:px-14 lg:py-16">
      <motion.div
        variants={staggerContainer(0.07, 0.05)}
        initial="hidden"
        animate="show"
        className="relative mx-auto w-full max-w-md"
      >
        <motion.div variants={riseIn} className="flex items-center gap-3">
          <span className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/30">
            <span aria-hidden className="anim-halo absolute inset-0 rounded-2xl bg-indigo-500/50" />
            <PenTool className="relative h-5 w-5" />
          </span>
          <span className="text-lg font-semibold tracking-tight text-zinc-100">创作台</span>
        </motion.div>

        <motion.h1
          variants={riseIn}
          className="mt-7 text-2xl font-bold leading-tight tracking-tight text-zinc-50 sm:text-3xl lg:text-4xl"
        >
          让 AI 替你写完整篇公众号
        </motion.h1>

        <motion.p variants={riseIn} className="mt-4 hidden max-w-sm text-sm leading-6 text-zinc-400 sm:block">
          从选题、配图到排版发布，一条流水线走完。登录后即可创作、洗稿与发布你的内容。
        </motion.p>

        <motion.ul variants={riseIn} className="mt-10 hidden flex-col gap-4 lg:flex">
          {FEATURES.map((f) => (
            <li key={f.title} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/70 text-indigo-400">
                <f.icon className="h-4 w-4" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-zinc-200">{f.title}</span>
                <span className="block text-xs text-zinc-400">{f.desc}</span>
              </span>
            </li>
          ))}
        </motion.ul>
      </motion.div>
    </section>
  );
}
