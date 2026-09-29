import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  currentOwnerSession,
  authRequest,
  verifySession,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/server/auth";
import { sameOrigin, safeId } from "@/lib/security";
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json({ message: "请求来源无效。" }, { status: 403 });
  const session = await currentOwnerSession();
  if (!session)
    return NextResponse.json(
      { message: "会话已失效，请重新登录。" },
      { status: 401 },
    );
  try {
    const raw = await request.text();
    if (raw.length > 2000)
      return NextResponse.json({ message: "请求过大。" }, { status: 413 });
    const input = JSON.parse(raw);
    const token = (await cookies()).get(SESSION_COOKIE)!.value;
    if (input.action === "enroll") {
      // Existing owners must challenge their verified factor, never replace it at AAL1.
      if (session.factors.some((f) => f.status === "verified"))
        return NextResponse.json(
          { message: "请使用已绑定的验证器。" },
          { status: 409 },
        );
      const result = await authRequest("factors", token, {
        factor_type: "totp",
        friendly_name: `Admin ${crypto.randomUUID()}`,
        issuer: "Visual Deadline Admin",
      });
      if (
        typeof result.id !== "string" ||
        typeof result.totp?.secret !== "string" ||
        typeof result.totp?.qr_code !== "string"
      )
        throw new Error();
      return NextResponse.json(
        {
          factorId: result.id,
          secret: result.totp.secret,
          qr: result.totp.qr_code,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    if (
      input.action !== "verify" ||
      typeof input.factorId !== "string" ||
      !safeId(input.factorId) ||
      typeof input.code !== "string" ||
      !/^\d{6}$/.test(input.code) ||
      !session.factors.some((f) => f.id === input.factorId)
    )
      return NextResponse.json({ message: "验证参数无效。" }, { status: 400 });
    const challenge = await authRequest(
      `factors/${input.factorId}/challenge`,
      token,
      {},
    );
    if (typeof challenge.id !== "string") throw new Error();
    const result = await authRequest(
      `factors/${input.factorId}/verify`,
      token,
      { challenge_id: challenge.id, code: input.code },
    );
    const verified =
      typeof result.access_token === "string"
        ? await verifySession(result.access_token)
        : null;
    if (
      !verified ||
      verified.actor.id !== session.actor.id ||
      verified.aal !== "aal2"
    )
      throw new Error();
    const response = NextResponse.json({ ok: true, destination: "/dashboard" });
    response.cookies.set(
      SESSION_COOKIE,
      result.access_token,
      sessionCookieOptions(Number(result.expires_in) || 3600),
    );
    return response;
  } catch {
    return NextResponse.json(
      { message: "验证未完成，请检查验证码或重新登录后重试。" },
      { status: 400 },
    );
  }
}
