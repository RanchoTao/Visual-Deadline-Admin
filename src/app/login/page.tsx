import { currentActor, authConfigured } from "@/server/auth";
import { redirect } from "next/navigation";
import Login from "@/components/Login";
export const dynamic = "force-dynamic";
export default async function LoginPage() {
  if (await currentActor()) redirect("/dashboard");
  return <Login configured={authConfigured()} />;
}
