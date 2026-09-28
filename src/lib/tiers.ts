import type { MembershipTier, PremiumCapability } from "./contracts";
export const tierOrder: Record<MembershipTier, number> = {
  free: 0,
  plus: 1,
  pro: 2,
};
export function effectiveTier(row: Record<string, unknown>): MembershipTier {
  if (
    row.effectiveTier === "free" ||
    row.effectiveTier === "plus" ||
    row.effectiveTier === "pro"
  )
    return row.effectiveTier;
  return row.effectivePlus === true ||
    (Array.isArray(row.capabilities) && row.capabilities.includes("vd.plus"))
    ? "plus"
    : "free";
}
export function tierCapabilities(tier: MembershipTier): PremiumCapability[] {
  return tier === "pro"
    ? ["vd.plus", "vd.pro"]
    : tier === "plus"
      ? ["vd.plus"]
      : [];
}
export function supportsProGrant(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const support = value as Record<string, unknown>;
  return (
    support.contract === "vd-admin-tiers-v1" &&
    Array.isArray(support.grantableTiers) &&
    support.grantableTiers.includes("pro")
  );
}
