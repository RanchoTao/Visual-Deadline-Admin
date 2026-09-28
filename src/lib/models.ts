// Proposed normalized DTOs. VD must approve and map these from its authoritative schema.
export type AccountStatus = "normal" | "restricted" | "suspended" | "banned";
export type ApplicationStatus =
  | "pending"
  | "shortlisted"
  | "approved"
  | "rejected"
  | "invited"
  | "registered"
  | "expired";
export interface EntitlementSource {
  id: string;
  source: string;
  status: string;
  validUntil: string | null;
  reason: string | null;
}
export interface UserMetadata {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
  lastActiveAt: string | null;
  cohort: string | null;
  inviteCode: string | null;
  inviteSource: string | null;
  membershipStatus: string;
  effectivePlus: boolean;
  validUntil: string | null;
  entitlementSources: EntitlementSource[];
  subscriptionId: string | null;
  adminGrants: EntitlementSource[];
  policy: string;
  limit: number | null;
  used: number | null;
  remaining: number | null;
  resetAt: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  estimatedCost: number | null;
  accountStatus: AccountStatus;
  tasksCount: number | null;
  goalsCount: number | null;
  reviewsCount: number | null;
}
export interface BetaApplication {
  id: string;
  name: string;
  email: string;
  organization: string | null;
  role: string | null;
  useCase: string | null;
  source: string | null;
  createdAt: string;
  status: ApplicationStatus;
  reviewNote: string | null;
  submittedFields: { label: string; value: string }[];
  history: {
    actor: string;
    action: string;
    timestamp: string;
    reason: string;
  }[];
}
export interface Invitation {
  id: string;
  code: string;
  cohort: string;
  kind: "personal" | "group" | "operations";
  status: string;
  used: number;
  limit: number;
  expiresAt: string | null;
  createdAt: string;
  source: string;
  note: string | null;
}
export interface QuotaRecord {
  id: string;
  userId: string;
  email: string;
  policy: string;
  limit: number | null;
  used: number | null;
  remaining: number | null;
  resetAt: string | null;
}
export interface BanRecord {
  id: string;
  userId: string;
  email: string;
  accountStatus: AccountStatus;
  reason: string;
  actor: string;
  createdAt: string;
  expiresAt: string | null;
  note: string | null;
}
export interface EmailAttempt {
  id: string;
  template: string;
  recipient: string;
  status: string;
  providerMessageId: string | null;
  createdAt: string;
  deliveredAt: string | null;
  bounce: string | null;
  complaint: string | null;
}
