import type { Action, AdminRole, Permission, Resource } from "./contracts";

const permissions: Record<AdminRole, readonly Permission[]> = {
  owner: [
    "dashboard.read",
    "users.read",
    "beta_applications.read",
    "beta_applications.review",
    "invitations.read",
    "invitations.write",
    "entitlements.read",
    "entitlements.write",
    "quotas.read",
    "quotas.write",
    "bans.read",
    "bans.write",
    "audit.read",
    "feedback.read",
    "moderation.read",
    "analytics.read",
    "billing.read",
    "ai_usage.read",
    "email.read",
    "email.write",
    "infrastructure.read",
    "deployments.read",
    "settings.read",
    "restricted_content.read",
  ],
  admin: [
    "users.read",
    "invitations.read",
    "invitations.write",
    "entitlements.read",
    "entitlements.write",
    "quotas.read",
    "quotas.write",
    "bans.read",
    "bans.write",
  ],
  support: ["users.read", "feedback.read", "moderation.read"],
  analyst: ["analytics.read", "billing.read", "ai_usage.read"],
  reviewer: ["beta_applications.read", "beta_applications.review"],
};

const readPermission: Record<Resource, Permission> = {
  dashboard: "dashboard.read",
  users: "users.read",
  "beta-applications": "beta_applications.read",
  invitations: "invitations.read",
  entitlements: "entitlements.read",
  quotas: "quotas.read",
  bans: "bans.read",
  audit: "audit.read",
  feedback: "feedback.read",
  "ai-usage": "ai_usage.read",
  email: "email.read",
  analytics: "analytics.read",
  infrastructure: "infrastructure.read",
  deployments: "deployments.read",
  settings: "settings.read",
  "restricted-content": "restricted_content.read",
};
const writePermission: Partial<Record<Resource, Permission>> = {
  "beta-applications": "beta_applications.review",
  invitations: "invitations.write",
  entitlements: "entitlements.write",
  quotas: "quotas.write",
  bans: "bans.write",
  email: "email.write",
  "restricted-content": "restricted_content.read",
};
const actions: Partial<Record<Resource, readonly Action[]>> = {
  "beta-applications": [
    "approve",
    "approve-and-email",
    "reject",
    "shortlist",
    "resend",
  ],
  invitations: ["create", "disable", "enable", "revoke", "expire"],
  entitlements: ["grant", "revoke"],
  quotas: ["adjust", "reset"],
  bans: ["restrict", "suspend", "ban", "unban"],
  email: ["resend"],
  "restricted-content": ["inspect"],
};
export function can(role: AdminRole, permission: Permission): boolean {
  return permissions[role].includes(permission);
}
export function canRead(role: AdminRole, resource: Resource): boolean {
  return can(role, readPermission[resource]);
}
export function canMutate(
  role: AdminRole,
  resource: Resource,
  action: Action,
): boolean {
  return Boolean(
    writePermission[resource] &&
      actions[resource]?.includes(action) &&
      can(role, writePermission[resource]),
  );
}
export function isResource(value: string): value is Resource {
  return Object.hasOwn(readPermission, value);
}
