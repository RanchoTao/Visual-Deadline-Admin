import { currentActor } from "@/server/auth";
import { redirect } from "next/navigation";
import Shell from "@/components/Shell";
export const dynamic = "force-dynamic";
export default async function ConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const actor = await currentActor();
  if (!actor) redirect("/login");
  return <Shell actor={actor}>{children}</Shell>;
}
