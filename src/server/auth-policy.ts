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
