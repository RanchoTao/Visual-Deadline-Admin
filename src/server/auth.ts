import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import type { Actor } from "@/lib/contracts";
import { verifyAuthToken } from "./auth-policy";

export const SESSION_COOKIE = "vd_admin_session";
export function authConfigured(): boolean {
  return Boolean(
    process.env.SUPABASE_URL &&
      process.env.SUPABASE_PUBLISHABLE_KEY &&
      process.env.ADMIN_OWNER_USER_IDS,
  );
}
function authUrl(path: string) {
  const url = new URL(process.env.SUPABASE_URL!);
  if (
    url.protocol !== "https:" &&
    !(
      process.env.NODE_ENV !== "production" &&
      ["localhost", "127.0.0.1"].includes(url.hostname)
    )
  )
    throw new Error("Invalid auth URL");
  return new URL(`/auth/v1/${path}`, url);
}
export async function verifyIdentity(token: string): Promise<Actor | null> {
  if (!authConfigured() || !token || token.length > 16000) return null;
  try {
    return await verifyAuthToken(token, {
      url: authUrl("user").origin,
      key: process.env.SUPABASE_PUBLISHABLE_KEY!,
      owners: process.env.ADMIN_OWNER_USER_IDS!,
    });
  } catch {
    return null;
  }
}
export const currentActor = cache(async (): Promise<Actor | null> => {
  return verifyIdentity((await cookies()).get(SESSION_COOKIE)?.value ?? "");
});
export async function passwordLogin(
  email: string,
  password: string,
): Promise<{ actor: Actor; token: string; expiresIn: number } | null> {
  if (!authConfigured()) return null;
  try {
    const response = await fetch(authUrl("token?grant_type=password"), {
      method: "POST",
      headers: {
        apikey: process.env.SUPABASE_PUBLISHABLE_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;
    const session = await response.json();
    if (typeof session.access_token !== "string") return null;
    const actor = await verifyIdentity(session.access_token);
    return actor
      ? {
          actor,
          token: session.access_token,
          expiresIn: Math.min(Number(session.expires_in) || 3600, 3600),
        }
      : null;
  } catch {
    return null;
  }
}
export async function revokeSession(token: string): Promise<boolean> {
  try {
    const response = await fetch(authUrl("logout?scope=local"), {
      method: "POST",
      redirect: "error",
      headers: {
        apikey: process.env.SUPABASE_PUBLISHABLE_KEY!,
        Authorization: `Bearer ${token}`,
      },
      signal: AbortSignal.timeout(8000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
