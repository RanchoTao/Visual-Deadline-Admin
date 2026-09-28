"use client";
import { useEffect, useState } from "react";
export default function Mfa({ factors }: { factors: string[] }) {
  const [factorId, setFactorId] = useState(factors[0] ?? "");
  const [enrollment, setEnrollment] = useState<{
    qr: string;
    secret: string;
  } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const clear = () => {
      setEnrollment(null);
      setCode("");
    };
    window.addEventListener("pagehide", clear);
    return () => window.removeEventListener("pagehide", clear);
  }, []);
  async function submit(action: "enroll" | "verify") {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, factorId, code }),
        cache: "no-store",
      });
      const result = await response.json();
      if (response.status === 401) {
        setEnrollment(null);
        window.location.assign("/login");
        return;
      }
      if (!response.ok) throw new Error(result.message);
      if (action === "enroll") {
        setFactorId(result.factorId);
        setEnrollment({ qr: result.qr, secret: result.secret });
      } else {
        setEnrollment(null);
        setCode("");
        window.location.assign("/dashboard");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "验证暂时不可用。");
    } finally {
      setCode("");
      setBusy(false);
    }
  }
  async function logout() {
    setEnrollment(null);
    setCode("");
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/login");
  }
  return (
    <main className="login-form-wrap" style={{ minHeight: "100vh" }}>
      <section className="login-form">
        <h1>{factors.length ? "双重验证" : "绑定身份验证器"}</h1>
        <p>只有完成 TOTP 双重验证，才能进入生产运营控制台。</p>
        {!factorId && (
          <button
            className="primary"
            disabled={busy}
            onClick={() => submit("enroll")}
          >
            开始绑定 TOTP
          </button>
        )}
        {enrollment && (
          <div>
            <p>使用身份验证器扫描二维码。请勿截图、分享或保存此页面。</p>
            <img
              width={220}
              height={220}
              alt="身份验证器绑定二维码"
              src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(enrollment.qr)}`}
            />
            <details>
              <summary>无法扫码？查看手动输入密钥</summary>
              <code>{enrollment.secret}</code>
            </details>
          </div>
        )}
        {factorId && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit("verify");
            }}
          >
            {factors.length > 1 && (
              <label>
                验证器
                <select
                  value={factorId}
                  onChange={(e) => setFactorId(e.target.value)}
                >
                  {factors.map((id, i) => (
                    <option key={id} value={id}>
                      验证器 {i + 1}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              六位验证码
              <input
                autoComplete="one-time-code"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </label>
            <button className="primary" disabled={busy}>
              {busy ? "正在验证…" : "验证并进入控制台"}
            </button>
          </form>
        )}
        {error && <p role="alert">{error}</p>}
        <button className="secondary" disabled={busy} onClick={logout}>
          退出登录
        </button>
        <p className="muted">设备丢失时，请联系所有者执行人工恢复流程。</p>
      </section>
    </main>
  );
}
