import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookieHeader, newToken, SESSION_TTL_MS, sha256Hex } from "./auth";
import { getVar, isVarTruthy, resolveVar } from "./config";
import {
  UNUSABLE_PASSWORD,
  createSession,
  createUser,
  deleteOAuthAccount,
  getByEmail,
  getById,
  getOAuthAccount,
  linkOAuthAccount,
} from "./repos/users";

export type OAuthProvider = "github" | "google";

const STATE_TTL_MS = 10 * 60 * 1000;

const PROVIDER_LABEL: Record<OAuthProvider, string> = { github: "GitHub", google: "Google" };

/** 第三方返回的身份信息；email 必须已由 provider 验证。 */
export type OAuthProfile = {
  subject: string;
  email: string;
  name: string;
  avatarUrl: string | null;
};

/** 登录后跳转：仅允许站内相对路径，防 open redirect。 */
export function safeNext(raw: string | null): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//") && !raw.includes("\\")) return raw;
  return "/manage";
}

async function stateSecret(): Promise<string | null> {
  return (await resolveVar("OAUTH_STATE_SECRET")) ?? null;
}

export function signState(state: string, secret: string): string {
  return createHmac("sha256", secret).update(state).digest("hex");
}

/** PKCE（Google 推荐；GitHub OAuth App 不支持，故仅 Google 使用）。 */
export function newCodeVerifier(): string {
  return randomBytes(32).toString("base64url");
}

export async function codeChallengeS256(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return Buffer.from(new Uint8Array(digest)).toString("base64url");
}

/**
 * 生成一次性 state：32 字节随机 + HMAC 签名，payload 里绑定 provider / next / PKCE verifier。
 * 回调时用 cookie + 签名双重校验（无状态、防 CSRF、防跨 provider 复用 state）。
 */
export async function issueOAuthState(
  req: Request,
  provider: OAuthProvider,
  next: string,
  verifier?: string,
): Promise<{ state: string; header: string }> {
  const state = newToken();
  const secret = await stateSecret();
  const value = JSON.stringify({
    state,
    provider,
    next,
    exp: Date.now() + STATE_TTL_MS,
    ...(verifier ? { verifier } : {}),
  });
  const signed = secret ? `${signState(state, secret)}.${Buffer.from(value).toString("base64url")}` : state;
  const host = new URL(req.url).hostname;
  const flags = [
    `oauth_state=${encodeURIComponent(signed)}`,
    `Path=/api/auth`,
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${STATE_TTL_MS / 1000}`,
    ...(host !== "localhost" && host !== "127.0.0.1" ? ["Secure"] : []),
  ];
  return { state, header: flags.join("; ") };
}

type StatePayload = { state?: string; provider?: string; next?: string; exp?: number; verifier?: string };

/** 校验：cookie 存在、未过期、签名一致、state 与回传一致、provider 匹配。 */
export async function verifyOAuthState(
  req: Request,
  returned: string | null,
  provider: OAuthProvider,
): Promise<{ ok: true; next: string; verifier: string | null } | { ok: false }> {
  const raw = req.headers.get("cookie")?.match(/(?:^|;\s*)oauth_state=([^;]+)/)?.[1];
  if (!raw || !returned) return { ok: false };
  const secret = await stateSecret();
  const decoded = decodeURIComponent(raw);
  let payload: StatePayload | null = null;
  if (secret) {
    const dot = decoded.indexOf(".");
    if (dot === -1) return { ok: false };
    const sig = decoded.slice(0, dot);
    try {
      payload = JSON.parse(Buffer.from(decoded.slice(dot + 1), "base64url").toString("utf8")) as StatePayload;
    } catch {
      return { ok: false };
    }
    if (typeof payload?.state !== "string") return { ok: false };
    const expected = Buffer.from(signState(payload.state, secret), "hex");
    const actual = Buffer.from(sig, "hex");
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return { ok: false };
  } else {
    // 未配置 OAUTH_STATE_SECRET：退化为「cookie 值必须等于回传 state」，无法绑定 provider/next。
    // 注意：不匹配必须拒绝——这里曾是反向判断，既放行了伪造 state，又拒绝了正常登录。
    if (decoded !== returned) return { ok: false };
    return { ok: true, next: "/manage", verifier: null };
  }
  if (!payload) return { ok: false };
  if (payload.state !== returned || typeof payload.exp !== "number" || payload.exp < Date.now()) {
    return { ok: false };
  }
  if (payload.provider !== provider) return { ok: false };
  return {
    ok: true,
    next: safeNext(typeof payload.next === "string" ? payload.next : null),
    verifier: typeof payload.verifier === "string" ? payload.verifier : null,
  };
}

/** state cookie 作废。 */
export function clearOAuthState(): string {
  return "oauth_state=; Path=/api/auth; HttpOnly; SameSite=Lax; Max-Age=0";
}

/** 对外错误码 → 登录页可读文案。由 /login 的 searchParams 消费。 */
export function oauthErrorText(provider: OAuthProvider, code: string): string {
  const label = PROVIDER_LABEL[provider];
  const texts: Record<string, string> = {
    misconfigured: `${label} 登录尚未配置，请联系管理员`,
    denied: `已取消 ${label} 授权`,
    invalid_state: `登录请求已过期，请重新点击 ${label} 登录`,
    token_failed: `${label} 授权失败，请重试`,
    email_unavailable: `未能从 ${label} 获取已验证邮箱，请先在 ${label} 完成邮箱验证`,
    registration_closed: "暂未开放注册，请联系管理员开通账号",
  };
  return texts[code] ?? "第三方登录失败，请重试";
}

export function oauthFail(provider: OAuthProvider, code: string): Response {
  return new Response(null, {
    status: 302,
    headers: {
      Location: `/login?oauth_error=${encodeURIComponent(code)}&provider=${provider}`,
      "Set-Cookie": clearOAuthState(),
    },
  });
}

/** 登录成功：建会话、写 cookie、302 到站内 next。 */
export async function issueOAuthSession(req: Request, userId: string, next: string): Promise<Response> {
  const token = newToken();
  await createSession(userId, await sha256Hex(token), Date.now() + SESSION_TTL_MS);
  const headers = new Headers({ Location: next });
  headers.append("Set-Cookie", cookieHeader(token, req.url.startsWith("https://")));
  headers.append("Set-Cookie", clearOAuthState());
  return new Response(null, { status: 302, headers });
}

/**
 * 第三方身份 → 本站账号归属（GitHub / Google 共用）：
 * 1. (provider, subject) 已绑定 → 直接登录；绑定指向已删除用户则清理后继续。
 * 2. 未绑定但同邮箱有账号 → 自动绑定（provider 已验证邮箱，故安全）并登录。
 * 3. 全新邮箱 → 受 REGISTRATION_OPEN 控制；开启才建 role=user 账号，永不自动提权。
 */
export async function loginOAuthProfile(
  req: Request,
  provider: OAuthProvider,
  profile: OAuthProfile,
  next: string,
): Promise<Response> {
  const { subject, email, name, avatarUrl } = profile;
  try {
    const linked = await getOAuthAccount(provider, subject);
    if (linked) {
      const user = await getById(linked.userId);
      if (user) return issueOAuthSession(req, user.id, next);
      // 绑定指向已删除的用户：清理后按新登录继续。
      await deleteOAuthAccount(provider, subject);
    }
    // 注册开关先查，避免关闭注册时通过错误码泄露「该邮箱是否已注册」。
    const registrationOpen = isVarTruthy(getVar("REGISTRATION_OPEN"));
    const existing = await getByEmail(email);
    if (existing) {
      await linkOAuthAccount({ userId: existing.id, provider, subject, email, avatarUrl });
      return issueOAuthSession(req, existing.id, next);
    }
    if (!registrationOpen) return oauthFail(provider, "registration_closed");
    const user = await createUser({
      id: crypto.randomUUID(),
      email,
      name,
      passHash: UNUSABLE_PASSWORD,
      role: "user",
      quotaTextChars: Number(getVar("NEW_USER_TEXT_QUOTA") ?? 100000),
      quotaImages: Number(getVar("NEW_USER_IMAGE_QUOTA") ?? 30),
      quotaVideos: Number(getVar("NEW_USER_VIDEO_QUOTA") ?? 10),
      quotaRewriteChars: Number(getVar("NEW_USER_REWRITE_QUOTA") ?? 200000),
    });
    await linkOAuthAccount({ userId: user.id, provider, subject, email, avatarUrl });
    return issueOAuthSession(req, user.id, next);
  } catch {
    // 并发竞态（两个回调同时首次绑定同一 subject）：以已落库的绑定为准继续登录。
    const raced = await getOAuthAccount(provider, subject);
    if (raced) {
      const user = await getById(raced.userId);
      if (user) return issueOAuthSession(req, user.id, next);
    }
    return oauthFail(provider, "token_failed");
  }
}
