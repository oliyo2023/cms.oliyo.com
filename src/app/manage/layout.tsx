import { redirect } from "next/navigation";
import { currentUser } from "@/lib/api";
import Nav from "./nav";
import type { User } from "@/lib/schema";

export const dynamic = "force-dynamic";

export default async function ManageLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  return (
    <div className="flex min-h-screen bg-zinc-950">
      <Nav user={user} />
      <main className="min-w-0 flex-1 overflow-x-hidden px-6 py-6 lg:px-10">{children}</main>
    </div>
  );
}

export type ManageUser = User;
