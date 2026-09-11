import { json } from "@/lib/api";
import { parseCookies, SESSION_COOKIE, sha256Hex } from "@/lib/auth";
import { deleteSession } from "@/lib/repos/users";

export async function POST(req: Request) {
  const token = parseCookies(req.headers.get("cookie"))[SESSION_COOKIE];
  if (token) await deleteSession(await sha256Hex(token));
  return json(
    { ok: true },
    { headers: { "Set-Cookie": `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0` } },
  );
}
