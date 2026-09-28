"use client";
import { useState } from "react";
import { ShieldCheck, ArrowRight, LockKeyhole } from "lucide-react";
export default function Login({ configured }: { configured: boolean }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.get("email"),
          password: form.get("password"),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      window.location.assign(
        data.destination === "/mfa" ? "/mfa" : "/dashboard",
      );
    } catch (error) {
      setError(error instanceof Error ? error.message : "登录暂时不可用。");
      setBusy(false);
    }
  }
  return (
    <main className="login-page">
      <section className="login-story">
        <div className="brand">
          <span className="brand-mark">
            V<span>·</span>
          </span>
          <div>
            Visual Deadline<small>内部运营控制台</small>
          </div>
        </div>
        <div className="login-copy">
          <span className="eyebrow">运营工作台</span>
          <h1>
            让每一次运营决策，
            <br />
            都有据可循。
          </h1>
          <p>
            从内测邀请到用户支持，
            <br />
            在一个工作台中管理 Visual Deadline。
          </p>
          <div className="login-principles">
            <span>
              <ShieldCheck size={18} />
              独立权限验证
            </span>
            <span>
              <LockKeyhole size={18} />
              全程审计追踪
            </span>
          </div>
        </div>
        <footer>仅限授权运营人员访问</footer>
      </section>
      <section className="login-form-wrap">
        <div className="login-form">
          <div className="login-icon">
            <ShieldCheck size={25} />
          </div>
          <h2>登录运营控制台</h2>
          <p className="muted">生产访问需要双重验证。</p>
          {process.env.NODE_ENV === "development" && (
            <p className="notice">
              仅本地开发：所有者可使用较弱的密码认证（AAL1）。
            </p>
          )}
          {!configured && (
            <div className="notice">
              <strong>管理员认证尚未配置</strong>
              <p>
                请按项目设置文档接入 Supabase Auth
                并设置所有者账号。配置完成前无法访问运营数据。
              </p>
            </div>
          )}
          <form onSubmit={login}>
            <label>
              邮箱
              <input
                name="email"
                type="email"
                autoComplete="username"
                required
                placeholder="你的管理员邮箱"
                disabled={!configured}
              />
            </label>
            <label>
              密码
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                minLength={8}
                disabled={!configured}
              />
            </label>
            {error && (
              <p role="alert" className="error-text">
                {error}
              </p>
            )}
            <button className="primary full" disabled={!configured || busy}>
              {busy ? "正在验证…" : "安全登录"}
              <ArrowRight size={16} />
            </button>
          </form>
          <p className="login-note">
            会话最长 1 小时。每次请求均会重新验证身份与权限。
          </p>
        </div>
      </section>
    </main>
  );
}
