import { resolveVar } from "@/lib/config";
import { loginOAuthProfile, oauthFail, verifyOAuthState } from "@/lib/oauth";
import { siteUrl } from "@/lib/site";
import type { OAuthProfile } from "@/lib/oauth";

export const dynamic = "force-dynamic";

type GithubUser = { id: number; login: string; name: string | null; avatar_url: string | null };
type GithubEmail = { email: string; primary: boolean; verified: boolean };

async function exchangeCode(code: string, redirectUri: string, clientId: string, clientSecret: string) {
  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri }),
  });
  if (!res.ok) return null;
  const data: unknown = await res.json().catch(() => null);
  if (data !== null && typeof data === "object" && "access_token" in data) {
    const token = data.access_token;
    if (typeof token === "string" && token.length > 0) return token;
  }
  return null;
}

async function githubApi<T>(token: string, path: string): Promise<T | null> {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "cms-oliyo" },
  });
  if (!res.ok) return null;
  return (await res.json().catch(() => null)) as T | null;
}

/** GitHub 回调：state → 换 token → 取已验证邮箱 → 归属登录。 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get("error")) return oauthFail("github", "denied");
  const verified = await verifyOAuthState(req, url.searchParams.get("state"), "github");
  if (!verified.ok) return oauthFail("github", "invalid_state");
  const clientId = await resolveVar("GITHUB_CLIENT_ID");
  const clientSecret = await resolveVar("GITHUB_CLIENT_SECRET");
  if (!clientId || !clientSecret) return oauthFail("github", "misconfigured");

  const code = url.searchParams.get("code");
  if (!code) return oauthFail("github", "token_failed");
  const callback = `${siteUrl(req, await resolveVar("SITE_URL"))}/api/auth/github/callback`;
  const token = await exchangeCode(code, callback, clientId, clientSecret);
  if (!token) return oauthFail("github", "token_failed");

  const ghUser = await githubApi<GithubUser>(token, "/user");
  if (!ghUser) return oauthFail("github", "token_failed");
  const emails = await githubApi<GithubEmail[]>(token, "/user/emails");
  const primary = emails?.find((e) => e.primary && e.verified) ?? emails?.find((e) => e.verified);
  const email = primary?.email.trim().toLowerCase();
  if (!email) return oauthFail("github", "email_unavailable");

  const profile: OAuthProfile = {
    subject: String(ghUser.id),
    email,
    name: ghUser.name?.trim() || ghUser.login,
    avatarUrl: ghUser.avatar_url,
  };
  return loginOAuthProfile(req, "github", profile, verified.next);
}
