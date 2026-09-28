import type { Actor } from "@/lib/contracts";
export function ownerFromVerifiedUser(
  user: unknown,
  ownerIds: string,
): Actor | null {
  if (!user || typeof user !== "object") return null;
  const value = user as Record<string, unknown>;
  if (
    typeof value.id !== "string" ||
    !ownerIds
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
      .includes(value.id) ||
    !value.email_confirmed_at ||
    typeof value.email !== "string"
  )
    return null;
  return { id: value.id, email: value.email, role: "owner" };
}
export async function verifyAuthToken(
  token: string,
  config: { url: string; key: string; owners: string },
  fetcher: typeof fetch = fetch,
): Promise<Actor | null> {
  if (!token || token.length > 16000) return null;
  try {
    const response = await fetcher(new URL("/auth/v1/user", config.url), {
      headers: { apikey: config.key, Authorization: `Bearer ${token}` },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(8000),
    });
    return response.ok
      ? ownerFromVerifiedUser(await response.json(), config.owners)
      : null;
  } catch {
    return null;
  }
}

export interface OwnerSession {
  actor: Actor;
  aal: "aal1" | "aal2";
  factors: { id: string; status: string }[];
}
// Only read claims AFTER Supabase has authenticated this exact bearer token.
// /user verifies its signature and expiry; decoding alone is never authentication.
export async function verifyOwnerSession(
  token: string,
  config: { url: string; key: string; owners: string },
  fetcher: typeof fetch = fetch,
): Promise<OwnerSession | null> {
  let user: Record<string, unknown> = {};
  const actor = await verifyAuthToken(token, config, async (url, init) => {
    const response = await fetcher(url, init);
    if (response.ok) user = await response.clone().json();
    return response;
  });
  if (!actor) return null;
  let aal: "aal1" | "aal2" = "aal1";
  try {
    const claims = JSON.parse(
      Buffer.from(token.split(".")[1], "base64url").toString(),
    );
    if (
      claims.sub !== actor.id ||
      !Number.isFinite(claims.exp) ||
      claims.exp <= Date.now() / 1000
    )
      return null;
    if (claims.aal === "aal2") aal = "aal2";
  } catch {
    return null;
  }
  const factors = Array.isArray(user.factors)
    ? user.factors
        .filter(
          (f): f is { id: string; status: string; factor_type: string } =>
            !!f &&
            typeof f === "object" &&
            f.factor_type === "totp" &&
            typeof f.id === "string" &&
            typeof f.status === "string",
        )
        .map(({ id, status }) => ({ id, status }))
    : [];
  return { actor, aal, factors };
}
export function adminSessionAllowed(
  session: OwnerSession | null,
  environment: string,
): boolean {
  return !!session && (environment === "development" || session.aal === "aal2");
}
export function sessionDestination(
  session: OwnerSession,
  environment: string,
): string {
  return adminSessionAllowed(session, environment) &&
    !session.factors.some(
      (f) => f.status === "verified" && session.aal !== "aal2",
    )
    ? "/dashboard"
    : "/mfa";
}
