import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import BrandPanel from "./brand-panel";
import LoginForm from "./login-form";
import MotionRoot from "@/components/motion-root";
import { getVar } from "@/lib/config";
import { oauthErrorText } from "@/lib/oauth";

export const metadata: Metadata = {
  title: "登录 — 创作台",
  description: "登录创作台，管理你的 AI 图文、洗稿与公众号排版内容。",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ register?: string; oauth_error?: string; provider?: string }>;
}) {
  const { register, oauth_error, provider } = await searchParams;
  const providers = (["github", "google"] as const).filter((p) => Boolean(getVar(`${p.toUpperCase()}_CLIENT_ID`)));
  const oauthError =
    oauth_error !== undefined
      ? oauthErrorText(provider === "google" ? "google" : "github", oauth_error)
      : null;

  return (
    <MotionRoot>
      <main className="relative min-h-dvh overflow-hidden bg-zinc-950 lg:grid lg:grid-cols-[1.05fr_minmax(0,1fr)]">
        {/* 环境光层：纯 CSS、服务端渲染，不占客户端 JS */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <span className="aurora aurora-1 anim-aurora-a -left-40 -top-48 h-[42rem] w-[42rem]" />
          <span className="aurora aurora-2 anim-aurora-b -bottom-56 left-1/4 h-[36rem] w-[36rem]" />
          <span className="aurora aurora-3 anim-aurora-a -right-40 top-1/4 h-[32rem] w-[32rem]" />
          <div className="bg-grid-faint absolute inset-0" />
          <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/30 via-transparent to-zinc-950/80" />
        </div>

        <BrandPanel />

        <section className="relative flex items-center justify-center px-4 py-10 sm:px-8 lg:py-16">
          <div className="w-full max-w-md">
            <LoginForm
              initialMode={register ? "register" : "login"}
              providers={providers}
              oauthError={oauthError}
            />
            <p className="mt-6 text-center text-xs text-zinc-400">
              <Link
                href="/"
                className="inline-flex items-center gap-1 rounded transition-colors duration-200 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60"
              >
                <ArrowLeft className="h-3 w-3" aria-hidden />
                返回作品展示
              </Link>
            </p>
          </div>
        </section>
      </main>
    </MotionRoot>
  );
}
