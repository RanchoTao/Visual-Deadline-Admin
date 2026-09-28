import type { Actor, Action, Resource } from "@/lib/contracts";
import { canMutate, canRead } from "@/lib/rbac";
import { safeId, safeReason } from "@/lib/security";
import { GatewayError, type VDAdminGateway } from "./gateway-core";

export async function readOperation(
  service: VDAdminGateway,
  actor: Actor | null,
  resource: Resource,
  query: URLSearchParams,
) {
  if (!actor)
    throw new GatewayError(401, "UNAUTHENTICATED", "请先登录管理员账号。");
  if (!canRead(actor.role, resource) || resource === "restricted-content")
    throw new GatewayError(403, "FORBIDDEN", "当前角色没有此权限。");
  return service.read(resource, actor, query);
}
export async function writeOperation(
  service: VDAdminGateway,
  actor: Actor | null,
  resource: Resource,
  body: unknown,
  requestId: string,
) {
  if (!actor)
    throw new GatewayError(401, "UNAUTHENTICATED", "请先登录管理员账号。");
  if (!body || typeof body !== "object")
    throw new GatewayError(400, "INVALID_INPUT", "请求格式无效。");
  const data = body as Record<string, unknown>;
  const action = data.action as Action;
  if (!canMutate(actor.role, resource, action))
    throw new GatewayError(403, "FORBIDDEN", "当前角色没有此操作权限。");
  const reason = safeReason(data.reason);
  if (!reason || typeof data.target !== "string" || !safeId(data.target))
    throw new GatewayError(
      400,
      "INVALID_INPUT",
      "目标 ID 或操作原因无效；原因至少 8 个字符。",
    );
  if (
    !data.input ||
    typeof data.input !== "object" ||
    Array.isArray(data.input)
  )
    throw new GatewayError(400, "INVALID_INPUT", "操作参数无效。");
  const input = data.input as Record<string, unknown>;
  if (
    resource === "restricted-content" &&
    (typeof input.caseReference !== "string" ||
      !input.caseReference.trim() ||
      !["tasks", "goals", "reviews"].includes(String(input.scope)) ||
      !["support", "report", "security", "legal", "other"].includes(
        String(input.category),
      ) ||
      !Number.isFinite(Date.parse(String(input.from))) ||
      !Number.isFinite(Date.parse(String(input.until))) ||
      Date.parse(String(input.from)) >= Date.parse(String(input.until)))
  )
    throw new GatewayError(
      400,
      "CASE_REQUIRED",
      "受限内容访问需要有效的工单、原因类型、范围和时间窗口。",
    );
  // VD validates business semantics, serializes concurrent writes and persists the audit atomically.
  return service.mutate(
    resource,
    action,
    actor,
    data.target,
    reason,
    input,
    requestId,
  );
}
