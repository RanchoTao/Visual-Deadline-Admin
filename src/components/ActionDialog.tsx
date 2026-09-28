"use client";
import { useRef, useState, useEffect } from "react";
import { X, ShieldCheck, AlertTriangle } from "lucide-react";
import type { Action, Resource } from "@/lib/contracts";
import { displayValue } from "@/lib/display";
export interface ActionSpec {
  resource: Resource;
  action: Action;
  label: string;
  target?: string;
  input?: Record<string, unknown>;
}
export default function ActionDialog({
  spec,
  close,
  done,
}: {
  spec: ActionSpec;
  close: () => void;
  done: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState("");
  const [target, setTarget] = useState(spec.target ?? "");
  const [input, setInput] = useState<Record<string, unknown>>({
    ...(spec.resource === "bans" ? { reasonCode: "manual" } : {}),
    ...spec.input,
  });
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState("");
  const [content, setContent] = useState("");
  const [resultText, setResultText] = useState("");
  const [requestId] = useState(() => crypto.randomUUID());
  useEffect(() => {
    dialog.current?.showModal();
    return () => dialog.current?.close();
  }, []);
  function field(key: string, label: string, type = "text", required = false) {
    return (
      <label>
        {label}
        <input
          type={type}
          value={String(input[key] ?? "")}
          required={required}
          onChange={(event) =>
            setInput({
              ...input,
              [key]:
                type === "number"
                  ? Number(event.target.value)
                  : event.target.value,
            })
          }
        />
      </label>
    );
  }
  async function submit() {
    setBusy(true);
    setError("");
    try {
      const wireInput = { ...input };
      for (const key of ["validUntil", "expiresAt", "from", "until"])
        if (typeof wireInput[key] === "string" && wireInput[key])
          wireInput[key] = new Date(wireInput[key] as string).toISOString();
      const response = await fetch(`/api/admin/${spec.resource}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": requestId,
        },
        body: JSON.stringify({
          action: spec.action,
          target,
          reason,
          input: wireInput,
        }),
      });
      const result = await response.json();
      if (response.status === 401) {
        window.location.assign("/login");
        return;
      }
      if (!response.ok)
        throw new Error(
          `${result.message} 请求 ID：${result.requestId || requestId}`,
        );
      setReceipt(result.auditEvent.requestId);
      if (
        spec.resource !== "restricted-content" &&
        Object.keys(result.result).length
      )
        setResultText(displayValue(result.result));
      if (spec.resource === "restricted-content")
        setContent(JSON.stringify(result.result, null, 2));
      done();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "请求失败，请核查审计记录。",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="action-dialog"
      aria-labelledby="action-title"
      onCancel={(event) => {
        if (busy) event.preventDefault();
        else close();
      }}
    >
      <div className="dialog-head">
        <div>
          <span className="eyebrow">受控操作</span>
          <h2 id="action-title">{spec.label}</h2>
        </div>
        <button
          className="icon-button"
          disabled={busy}
          onClick={close}
          aria-label="关闭"
        >
          <X size={20} />
        </button>
      </div>
      {receipt ? (
        <div className="dialog-body">
          <div className="success-notice">
            <ShieldCheck size={20} />
            <div>
              <strong>操作已完成，审计已记录</strong>
              <p>请求 ID：{receipt}</p>
            </div>
          </div>
          {content && <pre className="restricted-content">{content}</pre>}
          {resultText && <pre className="operation-result">{resultText}</pre>}
          <button className="primary full" onClick={close}>
            完成
          </button>
        </div>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setStep(1);
          }}
        >
          <div className="dialog-body">
            {step === 0 ? (
              <>
                <label>
                  目标记录 ID
                  <input
                    value={target}
                    onChange={(event) => setTarget(event.target.value)}
                    required
                    pattern="[a-zA-Z0-9_-]{1,100}"
                    readOnly={Boolean(spec.target)}
                    placeholder="输入用户或记录 ID"
                  />
                </label>
                {spec.resource === "bans" && spec.action !== "unban" && (
                  <label>
                    风控原因类型
                    <select
                      value={String(input.reasonCode || "manual")}
                      onChange={(event) =>
                        setInput({ ...input, reasonCode: event.target.value })
                      }
                    >
                      <option value="manual">人工处理</option>
                      <option value="spam">垃圾信息</option>
                      <option value="bot">自动化滥用</option>
                      <option value="payment_abuse">支付滥用</option>
                      <option value="harassment">骚扰</option>
                      <option value="illegal_content">违法内容</option>
                      <option value="security">安全问题</option>
                      <option value="terms_violation">违反服务条款</option>
                    </select>
                  </label>
                )}
                {spec.resource === "invitations" &&
                  spec.action === "create" && (
                    <>
                      <label>
                        邀请码类型
                        <select
                          value={String(input.kind || "personal")}
                          onChange={(event) =>
                            setInput({ ...input, kind: event.target.value })
                          }
                        >
                          <option value="personal">个人码</option>
                          <option value="group">小组码</option>
                          <option value="operations">运营码</option>
                        </select>
                      </label>
                      {field("cohort", "内测批次", "text", true)}
                      {field("limit", "使用上限", "number", true)}
                      {field("expiresAt", "失效时间", "datetime-local", true)}
                      {field("note", "备注")}
                    </>
                  )}
                {spec.action === "expire" &&
                  field("expiresAt", "新的失效时间", "datetime-local", true)}
                {spec.resource === "entitlements" &&
                  spec.action === "grant" && (
                    <>
                      <div className="notice compact">
                        授权来源：管理员授权。有效状态与截止时间由 VD 计算。
                      </div>
                      {!input.days &&
                        !input.permanent &&
                        field(
                          "validUntil",
                          "自定义截止时间",
                          "datetime-local",
                          true,
                        )}
                    </>
                  )}
                {spec.resource === "quotas" &&
                  spec.action === "adjust" &&
                  !input.delta &&
                  !input.unlimited &&
                  field("limit", "自定义额度", "number", true)}
                {spec.resource === "bans" &&
                  spec.action === "suspend" &&
                  !input.days &&
                  field("days", "暂停天数", "number", true)}
                {spec.resource === "restricted-content" && (
                  <>
                    <div className="notice compact">
                      仅返回指定范围内容。本次访问本身会生成审计事件。
                    </div>
                    <label>
                      访问原因类型
                      <select
                        required
                        value={String(input.category || "")}
                        onChange={(event) =>
                          setInput({ ...input, category: event.target.value })
                        }
                      >
                        <option value="">请选择</option>
                        <option value="support">用户主动请求客服支持</option>
                        <option value="report">违规举报调查</option>
                        <option value="security">安全调查</option>
                        <option value="legal">法律/合规</option>
                        <option value="other">其他</option>
                      </select>
                    </label>
                    {field("caseReference", "工单 / 案件编号", "text", true)}
                    <label>
                      内容范围
                      <select
                        required
                        value={String(input.scope || "")}
                        onChange={(event) =>
                          setInput({ ...input, scope: event.target.value })
                        }
                      >
                        <option value="">请选择</option>
                        <option value="tasks">任务</option>
                        <option value="goals">目标</option>
                        <option value="reviews">回顾</option>
                      </select>
                    </label>
                    {field("from", "起始时间", "datetime-local", true)}
                    {field("until", "截止时间", "datetime-local", true)}
                  </>
                )}
                <label>
                  操作原因
                  <textarea
                    required
                    minLength={8}
                    maxLength={1000}
                    rows={3}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="说明操作原因，至少 8 个字符"
                  />
                </label>
              </>
            ) : (
              <>
                <div className="notice warning">
                  <AlertTriangle size={18} />
                  <div>
                    <strong>请确认本次操作</strong>
                    <p>
                      {spec.label} · {target}
                    </p>
                  </div>
                </div>
                <dl className="detail-grid">
                  <dt>原因</dt>
                  <dd>{reason}</dd>
                  <dt>操作参数</dt>
                  <dd>
                    <pre>{displayValue(input)}</pre>
                  </dd>
                  <dt>请求 ID</dt>
                  <dd className="mono">{requestId}</dd>
                </dl>
                <p className="muted">
                  确认后提交操作并记录审计。若请求失败，请凭请求 ID 核查结果。
                </p>
              </>
            )}
            {error && (
              <p role="alert" className="error-text">
                {error}
              </p>
            )}
          </div>
          <div className="dialog-foot">
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => (step === 1 ? setStep(0) : close())}
            >
              {step === 1 ? "返回修改" : "取消"}
            </button>
            {step === 0 ? (
              <button className="primary">下一步：确认操作</button>
            ) : (
              <button
                type="button"
                className={spec.resource === "bans" ? "danger" : "primary"}
                disabled={busy}
                onClick={() => void submit()}
              >
                {busy ? "正在提交…" : "确认并记录审计"}
              </button>
            )}
          </div>
        </form>
      )}
    </dialog>
  );
}
