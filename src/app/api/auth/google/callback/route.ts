import { resolveVar } from "@/lib/config";
import { loginOAuthProfile, oauthFail, siteUrl, verifyOAuthState } from "@/lib/oauth";
import type { OAuthProfile } from "@/lib/oauth";

export const dynamic = "force-dynamic";

const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

/** 取出 id_token 的 payload；只返回未校验的 unknown，由调用方逐字段收窄。 */
function idTokenPayload(idToken: string): unknown {
  const parts = idToken.split(".");
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as unknown;
  } catch {
    return null;
  }
}

async function exchangeCode(
  code: string,
  redirectUri: string,
  clientId: string,
  clientSecret: string,
  verifier: string,
) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
  });
  if (!res.ok) return null;
  const data: unknown = await res.json().catch(() => null);
  if (data === null || typeof data !== "object" || !("id_token" in data)) return null;
  const idToken = data.id_token;
  return typeof idToken === "string" && idToken.length > 0 ? idToken : null;
}

/**
 * Google 回调：state + PKCE → 换 token → 校验 id_token 声明 → 归属登录。
 * id_token 是用我方 client_secret + PKCE 直接向 Google token 端点（TLS）换取的，
 * 校验 iss/aud/exp 即可确认来源与受众，无需再拉 JWKS 验签。
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get("error")) return oauthFail("google", "denied");
  const verified = await verifyOAuthState(req, url.searchParams.get("state"), "google");
  if (!verified.ok) return oauthFail("google", "invalid_state");
  const clientId = await resolveVar("GOOGLE_CLIENT_ID");
  const clientSecret = await resolveVar("GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret) return oauthFail("google", "misconfigured");

  const code = url.searchParams.get("code");
  if (!code || !verified.verifier) return oauthFail("google", "token_failed");
  const callback = `${siteUrl(req, await resolveVar("SITE_URL"))}/api/auth/google/callback`;
  const idToken = await exchangeCode(code, callback, clientId, clientSecret, verified.verifier);
  if (!idToken) return oauthFail("google", "token_failed");

  const raw: unknown = idTokenPayload(idToken);
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return oauthFail("google", "token_failed");
  // 收窄到索引签名：每个字段读出来都是 unknown，必须再经 typeof 校验才能用。
  const claims: Record<string, unknown> = { ...raw };
  const str = (key: string): string | undefined => {
    const v = claims[key];
    return typeof v === "string" && v.length > 0 ? v : undefined;
  };
  const num = (key: string): number | undefined => (typeof claims[key] === "number" ? (claims[key] as number) : undefined);
  const bool = (key: string): boolean | undefined => (typeof claims[key] === "boolean" ? (claims[key] as boolean) : undefined);

  const sub = str("sub");
  const email = str("email");
  const exp = num("exp");
  if (!GOOGLE_ISSUERS.includes(str("iss") ?? "") || str("aud") !== clientId) return oauthFail("google", "token_failed");
  if (exp === undefined || exp * 1000 < Date.now()) return oauthFail("google", "token_failed");
  if (!sub) return oauthFail("google", "token_failed");
  // 只接受 Google 已验证邮箱：否则「同邮箱自动绑定」会变成账号接管入口。
  if (bool("email_verified") !== true || !email) return oauthFail("google", "email_unavailable");

  const profile: OAuthProfile = {
    subject: sub,
    email: email.trim().toLowerCase(),
    name: str("name")?.trim() || email.split("@")[0] || sub,
    avatarUrl: str("picture") ?? null,
  };
  return loginOAuthProfile(req, "google", profile, verified.next);
}
