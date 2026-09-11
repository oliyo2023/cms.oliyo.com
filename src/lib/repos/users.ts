import { and, asc, count, eq, sql } from "drizzle-orm";
import { db } from "@/lib/drizzle";
import { oauthAccounts, sessions, users, type OAuthAccount, type User } from "@/lib/schema";
import { newId, sha256Hex } from "@/lib/auth";

/** 不可用的密码哨兵：纯 OAuth 用户没有本地密码，verifyPassword() 会天然返回 false。 */
export const UNUSABLE_PASSWORD = "oauth$unusable";

export async function createUser(data: {
  id: string;
  email: string;
  name: string;
  passHash: string;
  role: "admin" | "user";
  quotaTextChars: number;
  quotaImages: number;
  quotaVideos: number;
  quotaRewriteChars: number;
}): Promise<User> {
  const now = Date.now();
  await db().insert(users).values({ ...data, createdAt: now, updatedAt: now });
  const row = await getById(data.id);
  if (!row) throw new Error("user insert failed");
  return row;
}

export async function getById(id: string): Promise<User | null> {
  const rows = await db().select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getByEmail(email: string): Promise<User | null> {
  const rows = await db().select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
  return rows[0] ?? null;
}

export async function listUsers(): Promise<User[]> {
  return db().select().from(users).orderBy(asc(users.createdAt));
}

export async function userCount(): Promise<number> {
  const rows = await db().select({ n: count() }).from(users);
  return rows[0]?.n ?? 0;
}

export async function updateUser(
  id: string,
  patch: Partial<
    Pick<
      User,
      | "name"
      | "role"
      | "quotaTextChars"
      | "quotaImages"
      | "quotaVideos"
      | "quotaRewriteChars"
      | "passHash"
    >
  >,
): Promise<void> {
  await db().update(users).set({ ...patch, updatedAt: Date.now() }).where(eq(users.id, id));
}

export async function deleteUser(id: string): Promise<void> {
  await db().delete(oauthAccounts).where(eq(oauthAccounts.userId, id));
  await db().delete(users).where(eq(users.id, id));
}

export async function getOAuthAccount(provider: "github" | "google", subject: string): Promise<OAuthAccount | null> {
  const rows = await db()
    .select()
    .from(oauthAccounts)
    .where(and(eq(oauthAccounts.provider, provider), eq(oauthAccounts.subject, subject)))
    .limit(1);
  return rows[0] ?? null;
}

export async function linkOAuthAccount(data: {
  userId: string;
  provider: "github" | "google";
  subject: string;
  email: string;
  avatarUrl?: string | null;
}): Promise<OAuthAccount> {
  const now = Date.now();
  await db().insert(oauthAccounts).values({
    id: newId(),
    userId: data.userId,
    provider: data.provider,
    subject: data.subject,
    email: data.email,
    avatarUrl: data.avatarUrl ?? null,
    createdAt: now,
  });
  const row = await getOAuthAccount(data.provider, data.subject);
  if (!row) throw new Error("oauth link failed");
  return row;
}
export async function deleteOAuthAccount(provider: "github" | "google", subject: string): Promise<void> {
  await db()
    .delete(oauthAccounts)
    .where(and(eq(oauthAccounts.provider, provider), eq(oauthAccounts.subject, subject)));
}

 // ---------- sessions ----------
export async function createSession(userId: string, tokenHash: string, expiresAt: number): Promise<void> {
  await db().insert(sessions).values({ tokenHash, userId, createdAt: Date.now(), expiresAt });
}

export async function getSessionUser(tokenHash: string): Promise<User | null> {
  const rows = await db()
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(sql`${sessions.tokenHash} = ${tokenHash} AND ${sessions.expiresAt} > ${Date.now()}`)
    .limit(1);
  return rows[0]?.user ?? null;
}

export async function userByToken(token: string): Promise<User | null> {
  return getSessionUser(await sha256Hex(token));
}

export async function deleteSession(tokenHash: string): Promise<void> {
  await db().delete(sessions).where(eq(sessions.tokenHash, tokenHash));
}

export async function deleteExpiredSessions(): Promise<void> {
  await db().delete(sessions).where(sql`${sessions.expiresAt} < ${Date.now()}`);
}
