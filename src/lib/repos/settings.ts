import { eq, inArray } from "drizzle-orm";
import type { User } from "@/lib/schema";
import { db } from "@/lib/drizzle";
import { settings as settingsTable } from "@/lib/schema";

/** Serialize a user for API/UI responses (no secrets). */
export function publicUser(u: User): {
  id: string;
  email: string;
  name: string;
  role: "admin" | "user";
  quotas: {
    textChars: number;
    images: number;
    videos: number;
    rewriteChars: number;
  };
  createdAt: number;
} {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    quotas: {
      textChars: u.quotaTextChars,
      images: u.quotaImages,
      videos: u.quotaVideos,
      rewriteChars: u.quotaRewriteChars,
    },
    createdAt: u.createdAt,
  };
}

// ---------- settings key-value ----------

export async function getSetting(key: string): Promise<string | null> {
  const rows = await db().select().from(settingsTable).where(eq(settingsTable.key, key)).limit(1);
  return rows[0]?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const existing = await getSetting(key);
  if (existing === null) {
    await db().insert(settingsTable).values({ key, value });
  } else {
    await db().update(settingsTable).set({ value }).where(eq(settingsTable.key, key));
  }
}

export async function setSettingsMany(entries: Record<string, string>): Promise<void> {
  for (const [key, value] of Object.entries(entries)) {
    await setSetting(key, value);
  }
}

export async function getSettingsIn(keys: string[]): Promise<Record<string, string>> {
  if (keys.length === 0) return {};
  const rows = await db()
    .select()
    .from(settingsTable)
    .where(inArray(settingsTable.key, keys));
  const out: Record<string, string> = {};
  for (const r of rows) out[r.key] = r.value;
  return out;
}

export async function deleteSetting(key: string): Promise<void> {
  await db().delete(settingsTable).where(eq(settingsTable.key, key));
}
