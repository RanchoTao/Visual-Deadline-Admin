import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import type { Actor } from "@/lib/contracts";
import {
  verifyOwnerSession,
  adminSessionAllowed,
  sessionDestination,
} from "./auth-policy";
import { GatewayError } from "./gateway-core";

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
export async function verifySession(token: string) {
  if (!authConfigured()) return null;
  try {
    return await verifyOwnerSession(token, {
      url: authUrl("user").origin,
      key: process.env.SUPABASE_PUBLISHABLE_KEY!,
      owners: process.env.ADMIN_OWNER_USER_IDS!,
    });
  } catch {
    return null;
  }
}
export const currentOwnerSession = cache(async () =>
  verifySession((await cookies()).get(SESSION_COOKIE)?.value ?? ""),
);
export const currentActor = cache(async (): Promise<Actor | null> => {
  const session = await currentOwnerSession();
  return adminSessionAllowed(session, process.env.NODE_ENV)
    ? session!.actor
    : null;
});
export async function requireApiActor() {
  const session = await currentOwnerSession();
  if (session && !adminSessionAllowed(session, process.env.NODE_ENV))
    throw new GatewayError(403, "MFA_REQUIRED", "请先完成双重验证。");
  return session?.actor ?? null;
}
export const sessionCookieOptions = (maxAge: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
  maxAge: Math.max(0, Math.min(maxAge, 3600)),
});
export async function authRequest(path: string, token: string, body: unknown) {
  const response = await fetch(authUrl(path), {
    method: "POST",
    headers: {
      apikey: process.env.SUPABASE_PUBLISHABLE_KEY!,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error("MFA request rejected");
  return response.json();
}
export async function passwordLogin(
  email: string,
  password: string,
): Promise<{
  actor: Actor;
  token: string;
  expiresIn: number;
  destination: string;
} | null> {
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
    const verified = await verifySession(session.access_token);
    const actor = verified?.actor;
    return actor
      ? {
          actor,
          destination: sessionDestination(verified!, process.env.NODE_ENV),
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
