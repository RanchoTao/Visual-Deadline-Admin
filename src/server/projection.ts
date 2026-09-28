import { columns, metrics } from "@/lib/catalog";
import type { PageResult, Resource } from "@/lib/contracts";
import { GatewayError } from "./gateway-core";

const detailFields = [
  "id",
  "email",
  "name",
  "createdAt",
  "lastActiveAt",
  "cohort",
  "inviteCode",
  "inviteSource",
  "membershipStatus",
  "effectivePlus",
  "validUntil",
  "entitlementSources",
  "subscriptionId",
  "adminGrants",
  "policy",
  "limit",
  "used",
  "remaining",
  "resetAt",
  "inputTokens",
  "outputTokens",
  "estimatedCost",
  "accountStatus",
  "tasksCount",
  "goalsCount",
  "reviewsCount",
  "featureUsage",
  "reviewNote",
  "history",
];
const snapshotFields = [
  "status",
  "validUntil",
  "expiresAt",
  "limit",
  "used",
  "remaining",
  "accountStatus",
  "cohort",
  "source",
  "reason",
  "effectivePlus",
  "code",
  "kind",
];
function scalar(value: unknown): unknown {
  return typeof value === "string"
    ? value.slice(0, 2000)
    : typeof value === "number" || typeof value === "boolean" || value === null
      ? value
      : undefined;
}
function safeStructured(value: unknown, keys: string[]): unknown {
  if (Array.isArray(value))
    return value.slice(0, 50).map((row) => safeStructured(row, keys));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => keys.includes(key))
        .map(([key, v]) => [key, scalar(v)]),
    );
  return scalar(value);
}
export function projectRead(
  resource: Resource,
  result: PageResult,
): PageResult {
  const keys = new Set([
    "id",
    "userId",
    ...(columns[resource] ?? []).map(([key]) => key),
    ...(resource === "users" ? detailFields : []),
    ...(resource === "beta-applications"
      ? ["reviewNote", "history", "submittedFields"]
      : []),
  ]);
  const items = result.items.map((row) =>
    Object.fromEntries(
      Object.entries(row)
        .filter(([key]) => keys.has(key))
        .map(([key, value]) => [
          key,
          ["before", "after"].includes(key)
            ? safeStructured(value, snapshotFields)
            : [
                  "entitlementSources",
                  "adminGrants",
                  "history",
                  "submittedFields",
                  "featureUsage",
                ].includes(key)
              ? safeStructured(value, [
                  "id",
                  "source",
                  "status",
                  "validUntil",
                  "reason",
                  "actor",
                  "action",
                  "timestamp",
                  "name",
                  "count",
                  "label",
                  "value",
                ])
              : scalar(value),
        ]),
    ),
  );
  const summaryKeys = new Set([
    ...metrics.flatMap((group) => group.fields.map(([key]) => key)),
    ...[
      "currentCommit",
      "latestDeployment",
      "deploymentHealth",
      "databaseEnvironment",
      "source",
      "observedAt",
      "windowStart",
      "windowEnd",
    ],
    ...funnelKeys,
  ]);
  return {
    items,
    nextCursor:
      typeof result.nextCursor === "string"
        ? result.nextCursor.slice(0, 256)
        : undefined,
    summary: result.summary
      ? Object.fromEntries(
          Object.entries(result.summary)
            .filter(([key]) => summaryKeys.has(key))
            .map(([key, value]) => [key, scalar(value)]),
        )
      : undefined,
  };
}
const funnelKeys = Array.from({ length: 14 }, (_, index) => `funnel${index}`);
export function projectMutationResult(
  result: Record<string, unknown>,
): Record<string, unknown> {
  const keys = [
    "inviteId",
    "inviteCode",
    "expiresAt",
    "status",
    "queuedEmailId",
    "grantId",
    "effectivePlus",
    "validUntil",
    "policy",
    "limit",
    "used",
    "remaining",
  ];
  return Object.fromEntries(
    Object.entries(result)
      .filter(([key]) => keys.includes(key))
      .map(([key, value]) => [key, scalar(value)]),
  );
}
export function projectRestrictedResult(
  result: Record<string, unknown>,
  expectedScope: unknown,
): Record<string, unknown> {
  if (
    result.scope !== expectedScope ||
    !Array.isArray(result.items) ||
    result.items.length > 50 ||
    result.items.some(
      (row) => !row || typeof row !== "object" || typeof row.id !== "string",
    )
  )
    throw new GatewayError(
      502,
      "CONTENT_CONTRACT_INVALID",
      "返回内容不符合获准范围；请凭请求 ID 核查访问记录。",
    );
  const keys = ["id", "title", "content", "createdAt", "updatedAt"];
  return {
    scope: result.scope,
    items: result.items.map((row) =>
      Object.fromEntries(
        Object.entries(row)
          .filter(([key]) => keys.includes(key))
          .map(([key, value]) => [
            key,
            typeof value === "string" ? value.slice(0, 20000) : undefined,
          ]),
      ),
    ),
  };
}
