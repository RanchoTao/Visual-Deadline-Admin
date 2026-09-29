import { NextResponse } from "next/server";
import { requireApiActor } from "@/server/auth";
import { gateway } from "@/server/gateway";
import { GatewayError } from "@/server/gateway-core";
import { readOperation, writeOperation } from "@/server/operations";
import { isResource } from "@/lib/rbac";
import { sameOrigin } from "@/lib/security";
import {
  projectRead,
  projectMutationResult,
  projectRestrictedResult,
} from "@/server/projection";

type Context = { params: Promise<{ resource: string }> };
function failure(error: unknown, requestId: string) {
  const fault =
    error instanceof GatewayError
      ? error
      : new GatewayError(500, "INTERNAL_ERROR", "请求暂时无法完成。");
  return NextResponse.json(
    { code: fault.code, message: fault.message, requestId },
    { status: fault.status },
  );
}
export async function GET(request: Request, context: Context) {
  const requestId = crypto.randomUUID();
  try {
    const { resource } = await context.params;
    if (!isResource(resource))
      return NextResponse.json({ message: "页面不存在。" }, { status: 404 });
    const query = new URLSearchParams();
    const supplied = new URL(request.url).searchParams;
    for (const key of ["q", "cursor", "id", "status", "cohort"]) {
      const value = supplied.get(key);
      if (value) query.set(key, value.slice(0, 256));
    }
    query.set("limit", "50");
    return NextResponse.json(
      projectRead(
        resource,
        await readOperation(
          gateway(),
          await requireApiActor(),
          resource,
          query,
        ),
      ),
    );
  } catch (error) {
    return failure(error, requestId);
  }
}
export async function POST(request: Request, context: Context) {
  const requestId =
    request.headers.get("Idempotency-Key") ?? crypto.randomUUID();
  if (!/^[0-9a-f-]{36}$/i.test(requestId))
    return NextResponse.json({ message: "请求 ID 无效。" }, { status: 400 });
  if (!sameOrigin(request))
    return NextResponse.json({ message: "请求来源无效。" }, { status: 403 });
  try {
    const { resource } = await context.params;
    if (!isResource(resource))
      return NextResponse.json({ message: "页面不存在。" }, { status: 404 });
    const raw = await request.text();
    if (raw.length > 12000)
      throw new GatewayError(413, "INPUT_TOO_LARGE", "请求过大。");
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      throw new GatewayError(400, "INVALID_INPUT", "请求格式无效。");
    }
    const receipt = await writeOperation(
      gateway(),
      await requireApiActor(),
      resource,
      body,
      requestId,
    );
    // Restricted content is the only response allowed to carry private content.
    return NextResponse.json({
      result:
        resource === "restricted-content"
          ? projectRestrictedResult(receipt.result, body.input.scope)
          : projectMutationResult(receipt.result),
      auditEvent: projectRead("audit", {
        items: [receipt.auditEvent as unknown as Record<string, unknown>],
      }).items[0],
    });
  } catch (error) {
    return failure(error, requestId);
  }
}
