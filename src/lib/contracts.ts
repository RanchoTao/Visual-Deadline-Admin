export type MembershipTier = "free" | "plus" | "pro";
export type PremiumCapability = "vd.plus" | "vd.pro";
export type EntitlementSourceCategory =
  | "subscription"
  | "beta_gift"
  | "admin_grant"
  | "admin_compensation"
  | "promotion"
  | "testing";
export interface AdminGrantSupport {
  contract: "vd-admin-tiers-v1";
  grantableTiers: Exclude<MembershipTier, "free">[];
}
export type AdminRole = "owner" | "admin" | "support" | "analyst" | "reviewer";
export type Permission =
  | "dashboard.read"
  | "users.read"
  | "beta_applications.read"
  | "beta_applications.review"
  | "invitations.read"
  | "invitations.write"
  | "entitlements.read"
  | "entitlements.write"
  | "quotas.read"
  | "quotas.write"
  | "bans.read"
  | "bans.write"
  | "audit.read"
  | "feedback.read"
  | "moderation.read"
  | "analytics.read"
  | "billing.read"
  | "ai_usage.read"
  | "email.read"
  | "email.write"
  | "infrastructure.read"
  | "deployments.read"
  | "settings.read"
  | "restricted_content.read";

export interface Actor {
  id: string;
  email: string;
  role: AdminRole;
}
export interface AuditEvent {
  id: string;
  actor: string;
  action: string;
  target: string;
  reason: string;
  before: unknown;
  after: unknown;
  timestamp: string;
  requestId: string;
}
export interface PageResult {
  items: Record<string, unknown>[];
  nextCursor?: string;
  summary?: Record<string, unknown>;
}
export interface MutationResult {
  result: Record<string, unknown>;
  auditEvent: AuditEvent;
}
export type Resource =
  | "dashboard"
  | "users"
  | "beta-applications"
  | "invitations"
  | "entitlements"
  | "quotas"
  | "bans"
  | "audit"
  | "feedback"
  | "ai-usage"
  | "email"
  | "analytics"
  | "infrastructure"
  | "deployments"
  | "settings"
  | "restricted-content";
export type Action =
  | "approve"
  | "approve-and-email"
  | "reject"
  | "shortlist"
  | "resend"
  | "create"
  | "disable"
  | "enable"
  | "revoke"
  | "expire"
  | "grant"
  | "adjust"
  | "reset"
  | "restrict"
  | "suspend"
  | "ban"
  | "unban"
  | "inspect";
