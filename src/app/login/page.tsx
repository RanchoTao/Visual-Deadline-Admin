import {
  currentActor,
  currentOwnerSession,
  authConfigured,
} from "@/server/auth";
import { redirect } from "next/navigation";
import Login from "@/components/Login";
export const dynamic = "force-dynamic";
export default async function LoginPage() {
  if (await currentActor()) redirect("/dashboard");
  if (await currentOwnerSession()) redirect("/mfa");
  return <Login configured={authConfigured()} />;
}
