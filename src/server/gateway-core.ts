import type {
  Actor,
  AuditEvent,
  MutationResult,
  PageResult,
  Resource,
  Action,
} from "@/lib/contracts";

export class GatewayError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export interface VDAdminGateway {
  read(
    resource: Resource,
    actor: Actor,
    query: URLSearchParams,
  ): Promise<PageResult>;
  mutate(
    resource: Resource,
    action: Action,
    actor: Actor,
    target: string,
    reason: string,
    input: Record<string, unknown>,
    requestId: string,
  ): Promise<MutationResult>;
}
export function validateAudit(
  value: unknown,
  actor: Actor,
  action: Action,
  target: string,
  reason: string,
  requestId: string,
): value is AuditEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as AuditEvent;
  return (
    typeof event.id === "string" &&
    event.id.length > 0 &&
    event.actor === actor.id &&
    event.action === action &&
    event.target === target &&
    event.reason === reason &&
    event.requestId === requestId &&
    Number.isFinite(Date.parse(event.timestamp)) &&
    Object.hasOwn(event, "before") &&
    Object.hasOwn(event, "after")
  );
}
export function createGateway(
  baseUrl?: string,
  token?: string,
  fetcher: typeof fetch = fetch,
): VDAdminGateway {
  async function call(path: string, actor: Actor, init: RequestInit = {}) {
    if (!baseUrl || !token)
      throw new GatewayError(
        503,
        "CONTRACT_PENDING",
        "VD 管理契约尚未接入，操作未执行。",
      );
    const base = new URL(baseUrl);
    if (
      base.protocol !== "https:" &&
      !(
        process.env.NODE_ENV !== "production" &&
        ["localhost", "127.0.0.1"].includes(base.hostname)
      )
    )
      throw new GatewayError(503, "CONFIG_INVALID", "VD 管理服务配置无效。");
    try {
      const response = await fetcher(
        new URL(path, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`),
        {
          ...init,
          cache: "no-store",
          redirect: "error",
          signal: AbortSignal.timeout(10000),
          headers: {
            ...init.headers,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            "X-Admin-Actor": actor.id,
            "X-Admin-Role": actor.role,
            "X-Admin-Contract": "vd-admin-v1",
          },
        },
      );
      if (!response.ok)
        throw new GatewayError(
          response.status >= 500 ? 502 : response.status,
          "UPSTREAM_REJECTED",
          "VD 管理服务拒绝请求，请核对权限或记录状态。",
        );
      return await response.json();
    } catch (error) {
      if (error instanceof GatewayError) throw error;
      throw new GatewayError(
        502,
        "UPSTREAM_UNAVAILABLE",
        "VD 管理服务暂时不可用。",
      );
    }
  }
  return {
    async read(resource, actor, query) {
      const result = await call(`v1/admin/${resource}?${query}`, actor);
      if (
        !result ||
        !Array.isArray(result.items) ||
        result.items.length > 100 ||
        result.items.some(
          (row: unknown) =>
            !row ||
            typeof row !== "object" ||
            Array.isArray(row) ||
            typeof (row as Record<string, unknown>).id !== "string",
        )
      )
        throw new GatewayError(
          502,
          "CONTRACT_INVALID",
          "VD 返回的数据不符合管理契约。",
        );
      return result as PageResult;
    },
    async mutate(resource, action, actor, target, reason, input, requestId) {
      const result = await call(`v1/admin/${resource}/actions`, actor, {
        method: "POST",
        headers: { "Idempotency-Key": requestId },
        body: JSON.stringify({ action, target, reason, input, requestId }),
      });
      if (
        !validateAudit(
          result?.auditEvent,
          actor,
          action,
          target,
          reason,
          requestId,
        ) ||
        !result.result ||
        typeof result.result !== "object"
      )
        throw new GatewayError(
          502,
          "AUDIT_RECEIPT_MISSING",
          "未收到有效审计回执。请用请求 ID 核查结果，勿重复提交。",
        );
      return result as MutationResult;
    },
  };
}
