import { NextRequest } from "next/server";
import { storeGet } from "@/lib/store";

export const dynamic = "force-dynamic";

/** Streams R2 objects through /media/<key> so the app needs no public R2 domain. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ key: string[] }> }) {
  const { key } = await ctx.params;
  const objectKey = key.join("/");
  const obj = await storeGet(objectKey);
  if (!obj) return new Response("not found", { status: 404 });
  const headers: Record<string, string> = {
    "Content-Type": obj.mime,
    "Cache-Control": "public, max-age=31536000, immutable",
    "Access-Control-Allow-Origin": "*",
  };
  return new Response(obj.body as BodyInit, { headers });
}
