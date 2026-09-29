import { NextResponse } from "next/server";
import { passwordLogin, SESSION_COOKIE, authConfigured } from "@/server/auth";
import { sameOrigin } from "@/lib/security";
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json({ message: "请求来源无效。" }, { status: 403 });
  if (!authConfigured())
    return NextResponse.json(
      { message: "管理员认证尚未配置。" },
      { status: 503 },
    );
  if (Number(request.headers.get("content-length")) > 8000)
    return NextResponse.json({ message: "请求过大。" }, { status: 413 });
  let body;
  try {
    const raw = await request.text();
    if (raw.length > 8000)
      return NextResponse.json({ message: "请求过大。" }, { status: 413 });
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ message: "请求格式无效。" }, { status: 400 });
  }
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    typeof body.email !== "string" ||
    body.email.length > 254 ||
    typeof body.password !== "string" ||
    body.password.length > 1000
  )
    return NextResponse.json(
      { message: "请输入有效的邮箱和密码。" },
      { status: 400 },
    );
  const session = await passwordLogin(body.email, body.password);
  if (!session)
    return NextResponse.json(
      { message: "登录失败，或账号没有管理员权限。" },
      { status: 401 },
    );
  const response = NextResponse.json({
    ok: true,
    destination: session.destination,
  });
  response.cookies.set(SESSION_COOKIE, session.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: session.expiresIn,
  });
  return response;
}
