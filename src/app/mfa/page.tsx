import { redirect } from "next/navigation";
import { currentOwnerSession } from "@/server/auth";
import Mfa from "@/components/Mfa";
export const dynamic = "force-dynamic";
export default async function MfaPage() {
  const session = await currentOwnerSession();
  if (!session) redirect("/login");
  if (session.aal === "aal2") redirect("/dashboard");
  return (
    <Mfa
      factors={session.factors
        .filter((f) => f.status === "verified")
        .map((f) => f.id)}
    />
  );
}
