export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}
export function safeReason(value: unknown): string | null {
  return typeof value === "string" &&
    value.trim().length >= 8 &&
    value.trim().length <= 1000
    ? value.trim()
    : null;
}
export function safeId(value: string): boolean {
  return /^[a-zA-Z0-9_-]{1,100}$/.test(value);
}
