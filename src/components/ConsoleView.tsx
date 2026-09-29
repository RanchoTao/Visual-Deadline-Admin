"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  ArrowLeft,
  RefreshCw,
  Search,
  Plus,
  ShieldCheck,
  Database,
  Link2,
  ChevronRight,
  Inbox,
  Activity,
  ArrowRight,
  Mail,
  LockKeyhole,
} from "lucide-react";
import { columns, navigation, metrics, funnel } from "@/lib/catalog";
import { canMutate } from "@/lib/rbac";
import { displayValue } from "@/lib/display";
import {
  emailTemplates,
  renderEmail,
  type EmailTemplate,
} from "@/lib/email-templates";
import type { Actor, PageResult, Resource } from "@/lib/contracts";
import type { ProviderStatus } from "@/server/providers";
import ActionDialog, { type ActionSpec } from "./ActionDialog";

const descriptions: Partial<Record<Resource, string>> = {
  dashboard: "掌握产品状态，处理今天的运营工作。",
  users: "查询账号、查看授权来源与使用情况。",
  "beta-applications": "审核内测申请，让合适的用户进入下一步。",
  invitations: "管理个人、小组与运营邀请码的完整生命周期。",
  entitlements: "查看 VD 权威授权与独立 AI 额度策略。",
  "ai-usage": "基于 VD 用量账本，追踪调用、tokens 与预估费用。",
  email: "查看投递记录，预览中文运营邮件。",
  feedback: "通过工单处理反馈与举报，默认仅展示元数据。",
  bans: "按明确原因执行限制、暂停或封禁。",
  analytics: "追踪从申请到激活、留存与付费的转化。",
  infrastructure: "查看服务接入与数据库健康状态。",
  deployments: "追踪生产版本与部署健康。",
  audit: "只读审计记录，追溯每一次运营操作。",
  settings: "查看环境与接入边界。",
};
const statusLabels: Record<string, string> = {
  pending: "待审核",
  shortlisted: "候选",
  approved: "已批准",
  rejected: "已拒绝",
  invited: "已邀请",
  registered: "已注册",
  expired: "已过期",
  active: "有效",
  disabled: "已禁用",
  revoked: "已撤销",
  normal: "正常",
  restricted: "受限",
  suspended: "暂停",
  banned: "封禁",
  free: "免费",
  plus: "Plus",
  personal: "个人码",
  group: "小组码",
  operations: "运营码",
  subscription: "Paddle 订阅",
  legacy_membership: "历史会员",
  legacy_membership_grant: "历史授权",
  admin_grant: "管理员授权",
  beta_gift: "内测赠送",
  admin_compensation: "管理员补偿",
  promotion: "推广活动",
  testing: "测试",
  sent: "已发送",
  delivered: "已送达",
  bounced: "已退信",
  complained: "已投诉",
  failed: "失败",
  success: "成功",
};
function format(value: unknown): string {
  return displayValue(value);
}
function Empty({
  pending = false,
  message,
}: {
  pending?: boolean;
  message?: string;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        {pending ? <Link2 size={25} /> : <Inbox size={25} />}
      </div>
      <h3>{pending ? "尚未接入" : "暂无数据"}</h3>
      <p>
        {message ||
          (pending
            ? "接入 VD 管理契约后，这里会显示权威数据。"
            : "当前查询没有匹配的记录。")}
      </p>
    </div>
  );
}

export default function ConsoleView({
  section,
  detailId,
  actor,
  configured,
  providers,
}: {
  section: Resource;
  detailId?: string;
  actor: Actor;
  configured: boolean;
  providers: ProviderStatus[];
}) {
  const [tab, setTab] = useState<Resource>(section);
  const [data, setData] = useState<PageResult>({ items: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(!configured);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const [cursor, setCursor] = useState("");
  const [reload, setReload] = useState(0);
  const [dialog, setDialog] = useState<ActionSpec | null>(null);
  const [selected, setSelected] = useState<Record<string, unknown> | null>(
    null,
  );
  const [template, setTemplate] = useState<EmailTemplate>("invitation");
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setData({ items: [] });
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (filter) params.set("status", filter);
    if (detailId) params.set("id", detailId);
    if (cursor) params.set("cursor", cursor);
    fetch(`/api/admin/${tab}?${params}`)
      .then(async (response) => {
        const result = await response.json();
        if (response.status === 401) {
          window.location.assign("/login");
          return;
        }
        if (result.code === "MFA_REQUIRED") {
          window.location.assign("/mfa");
          return;
        }
        if (!response.ok) {
          if (result.code === "CONTRACT_PENDING") {
            if (active) {
              setPending(true);
              setError("");
            }
            return;
          }
          throw new Error(result.message || "数据暂时不可用。");
        }
        if (active) {
          setPending(false);
          setData(result);
        }
      })
      .catch((error) => {
        if (active) setError(error.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [tab, query, filter, cursor, detailId, reload]);
  const title = detailId
    ? "用户详情"
    : (navigation.find((item) => item.id === section)?.label ?? "");
  function action(spec: ActionSpec) {
    return (
      <button
        className={
          spec.action === "ban" ||
          spec.action === "revoke" ||
          spec.action === "reject"
            ? "secondary danger-text"
            : "secondary"
        }
        disabled={
          !configured ||
          !canMutate(actor.role, spec.resource, spec.action) ||
          (spec.input?.tier === "pro" &&
            data.summary?.proGrantSupported !== true)
        }
        onClick={() => setDialog(spec)}
      >
        {spec.label}
      </button>
    );
  }
  function detailGrid(
    row: Record<string, unknown>,
    fields: [string, string][],
  ) {
    return (
      <dl className="detail-grid">
        {fields.map(([key, label]) => (
          <div key={key}>
            <dt>{label}</dt>
            <dd className={key === "id" ? "mono" : ""}>{format(row[key])}</dd>
          </div>
        ))}
      </dl>
    );
  }
  function table(resource: Resource = tab) {
    const fields = columns[resource] ?? [];
    return (
      <section className="panel table-panel">
        <div className="panel-header">
          <h2>{resource === "quotas" ? "额度策略与个人覆盖" : "记录列表"}</h2>
          <span className="muted">
            {loading ? "正在加载…" : `${data.items.length} 条记录`}
          </span>
        </div>
        {error ? (
          <div role="alert" className="notice error-notice">
            {error}
            <button className="secondary" onClick={() => setReload(reload + 1)}>
              重试
            </button>
          </div>
        ) : loading ? (
          <div className="loading-state">
            <RefreshCw className="spin" size={20} />
            正在读取权威数据…
          </div>
        ) : data.items.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  {fields.map(([key, label]) => (
                    <th key={key}>{label}</th>
                  ))}
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((row, index) => (
                  <tr key={String(row.id ?? index)}>
                    {fields.map(([key]) => (
                      <td key={key}>
                        {[
                          "status",
                          "accountStatus",
                          "membershipStatus",
                        ].includes(key) ? (
                          <span
                            className={`table-status ${["banned", "rejected", "failed", "revoked"].includes(String(row[key])) ? "bad" : ""}`}
                          >
                            {format(row[key])}
                          </span>
                        ) : ["before", "after"].includes(key) ? (
                          <details>
                            <summary>查看快照</summary>
                            <pre>{format(row[key])}</pre>
                          </details>
                        ) : (
                          <span title={format(row[key])}>
                            {format(row[key])}
                          </span>
                        )}
                      </td>
                    ))}
                    <td>
                      {resource === "users" ? (
                        <Link
                          className="text-link"
                          href={`/users/${encodeURIComponent(String(row.id))}`}
                        >
                          查看
                          <ChevronRight size={14} />
                        </Link>
                      ) : resource === "invitations" ? (
                        <div className="row-actions">
                          <span
                            className="muted"
                            title="完整邀请码仅在创建成功或原请求重试回执中显示。"
                          >
                            脱敏码不可复制
                          </span>
                          <button
                            className="text-link"
                            onClick={() => setSelected(row)}
                          >
                            管理
                          </button>
                        </div>
                      ) : resource === "audit" ? (
                        <span className="muted">只读</span>
                      ) : (
                        <button
                          className="text-link"
                          onClick={() => setSelected(row)}
                        >
                          查看
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty pending={pending} />
        )}
        <div className="table-footer">
          <span>每页最多 50 条 · 数据由 VD 管理服务提供</span>
          {data.nextCursor && (
            <button
              className="secondary"
              onClick={() => setCursor(data.nextCursor!)}
            >
              下一页
              <ArrowRight size={13} />
            </button>
          )}
          {cursor && (
            <button className="secondary" onClick={() => setCursor("")}>
              返回首页
            </button>
          )}
        </div>
      </section>
    );
  }
  function dashboard() {
    return (
      <>
        <div className="overview-grid">
          {metrics
            .slice(0, 1)
            .flatMap((group) => group.fields.slice(0, 4))
            .map(([key, label], index) => (
              <article
                className={`metric-card ${index === 0 ? "featured" : ""}`}
                key={key}
              >
                <div className="metric-label">
                  {label}
                  <UsersIcon index={index} />
                </div>
                <strong>{format(data.summary?.[key])}</strong>
                <span className="metric-note">
                  {pending ? "尚未接入" : "VD 权威数据"}
                  <span className="metric-placeholder">—</span>
                </span>
              </article>
            ))}
        </div>
        <div className="dashboard-middle">
          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>用户增长趋势</h2>
                <p>新用户与活跃用户的变化</p>
              </div>
              <span className="subtle-chip">最近 7 日</span>
            </div>
            <Empty pending message="增长趋势时间序列尚未接入。" />
          </section>
          <section className="panel">
            <div className="panel-header">
              <h2>运营待办</h2>
              <Activity size={17} />
            </div>
            <div className="todo-list">
              {[
                ["待审核申请", "pendingApplications", "beta-applications"],
                ["待处理反馈", "pendingFeedback", "feedback"],
                ["待处理举报", "pendingReports", "feedback"],
                ["即将到期用户", "expiringUsers", "entitlements"],
              ].map(([label, key, url]) => (
                <Link href={`/${url}`} key={label}>
                  <span>
                    <span className="todo-dot" />
                    {label}
                  </span>
                  <strong>{format(data.summary?.[key])}</strong>
                  <ChevronRight size={15} />
                </Link>
              ))}
            </div>
            <div className="panel-bottom">
              <ShieldCheck size={16} /> 所有变更均需原因与审计记录
            </div>
          </section>
        </div>
        <div className="section-title">
          <h2>运营指标</h2>
          <span>缺少来源时显示暂无数据</span>
        </div>
        <div className="metric-sections">
          {metrics.map((group) => (
            <section className="panel" key={group.group}>
              <div className="panel-header">
                <h2>{group.group}</h2>
                <span className="subtle-chip">VD</span>
              </div>
              <dl className="metric-list">
                {group.fields.map(([key, label]) => (
                  <div key={key}>
                    <dt>{label}</dt>
                    <dd>{format(data.summary?.[key])}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
        <div className="section-title">
          <h2>系统与生产状态</h2>
          <Link className="text-link" href="/infrastructure">
            查看基础设施
            <ArrowUpRight size={14} />
          </Link>
        </div>
        <section className="panel">
          {detailGrid(data.summary ?? {}, [
            ["currentCommit", "当前生产提交"],
            ["latestDeployment", "最新 Vercel 部署"],
            ["deploymentHealth", "部署健康"],
            ["databaseEnvironment", "数据库环境"],
          ])}
        </section>
      </>
    );
  }
  function userDetail() {
    const row = data.items[0];
    if (!row)
      return (
        <section className="panel">
          <Empty pending={pending} message={error || undefined} />
        </section>
      );
    return (
      <>
        <section className="panel profile-panel">
          <div className="large-avatar">
            {String(row.name || row.email || "用").slice(0, 1)}
          </div>
          <div>
            <h2>{format(row.name)}</h2>
            <p className="muted">{format(row.email)}</p>
            <p className="mono muted">{detailId}</p>
          </div>
          <span className="table-status">{format(row.accountStatus)}</span>
        </section>
        <div className="detail-columns">
          <section className="panel">
            <div className="panel-header">
              <h2>账号资料</h2>
            </div>
            {detailGrid(row, [
              ["id", "用户 ID"],
              ["email", "邮箱"],
              ["name", "用户名"],
              ["createdAt", "注册时间"],
              ["lastActiveAt", "最后活跃"],
              ["cohort", "内测批次"],
              ["inviteSource", "邀请来源"],
            ])}
          </section>
          <section className="panel">
            <div className="panel-header">
              <h2>活动摘要</h2>
              <span className="subtle-chip">仅元数据</span>
            </div>
            {detailGrid(row, [
              ["tasksCount", "任务数量"],
              ["goalsCount", "目标数量"],
              ["reviewsCount", "回顾数量"],
              ["lastActiveAt", "最后活跃"],
              ["featureUsage", "功能用量"],
            ])}
          </section>
        </div>
        <section className="panel">
          <div className="panel-header">
            <h2>会员授权</h2>
            <span className="subtle-chip">VD 权威计算</span>
          </div>
          {detailGrid(row, [
            ["currentTier", "当前套餐"],
            ["effectiveTier", "最终有效层级"],
            ["validUntil", "有效截止"],
            ["entitlementSources", "授权来源"],
            ["subscriptionId", "Paddle 订阅"],
            ["adminGrants", "管理员授权"],
          ])}
          <div className="action-bar">
            {[1, 7, 30, 90].map((days) => (
              <span key={days}>
                {action({
                  resource: "entitlements",
                  action: "grant",
                  label: `+${days} 天`,
                  target: detailId,
                  input: { days, tier: "plus", source: "admin_grant" },
                })}
              </span>
            ))}
            {action({
              resource: "entitlements",
              action: "grant",
              label: "赠送 Plus",
              target: detailId,
              input: { tier: "plus", source: "admin_grant" },
            })}
            {action({
              resource: "entitlements",
              action: "grant",
              label: "永久测试权限",
              target: detailId,
              input: { permanent: true, tier: "plus", source: "testing" },
            })}
            {action({
              resource: "entitlements",
              action: "grant",
              label: "赠送 Pro",
              target: detailId,
              input: { tier: "pro", source: "admin_grant" },
            })}
            {data.summary?.proGrantSupported !== true && (
              <span className="muted">Pro 授权待 VD 权威接口支持</span>
            )}
            {action({
              resource: "entitlements",
              action: "revoke",
              label: "撤销管理员授权",
              target: detailId,
            })}
          </div>
        </section>
        <section className="panel">
          <div className="panel-header">
            <h2>AI 额度</h2>
            <span className="subtle-chip">独立额度策略</span>
          </div>
          {detailGrid(row, [
            ["policy", "当前策略"],
            ["limit", "额度"],
            ["used", "已使用"],
            ["remaining", "剩余"],
            ["resetAt", "重置时间"],
            ["inputTokens", "输入 tokens"],
            ["outputTokens", "输出 tokens"],
            ["estimatedCost", "预估费用"],
          ])}
          <div className="action-bar">
            {[20, 100].map((delta) => (
              <span key={delta}>
                {action({
                  resource: "quotas",
                  action: "adjust",
                  label: `+${delta} 次`,
                  target: detailId,
                  input: { delta },
                })}
              </span>
            ))}
            {action({
              resource: "quotas",
              action: "reset",
              label: "重置本周期",
              target: detailId,
            })}
            {action({
              resource: "quotas",
              action: "adjust",
              label: "设置自定义额度",
              target: detailId,
            })}
            {action({
              resource: "quotas",
              action: "adjust",
              label: "测试账号无限额度",
              target: detailId,
              input: { unlimited: true },
            })}
          </div>
        </section>
        <section className="panel">
          <div className="panel-header">
            <h2>账号控制</h2>
          </div>
          <div className="action-bar">
            {[1, 7, 30].map((days) => (
              <span key={days}>
                {action({
                  resource: "bans",
                  action: "suspend",
                  label: `暂停 ${days} 天`,
                  target: detailId,
                  input: { days },
                })}
              </span>
            ))}
            {action({
              resource: "bans",
              action: "restrict",
              label: "限制账号",
              target: detailId,
            })}
            {action({
              resource: "bans",
              action: "ban",
              label: "永久封禁",
              target: detailId,
            })}
            {action({
              resource: "bans",
              action: "unban",
              label: "解除限制",
              target: detailId,
            })}
          </div>
        </section>
        <section className="panel restricted-panel">
          <div>
            <h2>
              <LockKeyhole size={17} />
              受限用户内容
            </h2>
            <p className="muted">
              查看内容需要工单、原因、范围与时间窗口，访问本身会留痕。
            </p>
          </div>
          {action({
            resource: "restricted-content",
            action: "inspect",
            label: "查看受限用户内容",
            target: detailId,
          })}
        </section>
      </>
    );
  }
  function recordDetail() {
    if (!selected) return null;
    const target = String(
      ["entitlements", "quotas", "bans"].includes(tab)
        ? (selected.userId ?? selected.id)
        : selected.id,
    );
    return (
      <section className="panel selected-panel">
        <div className="panel-header">
          <h2>记录详情</h2>
          <button className="secondary" onClick={() => setSelected(null)}>
            收起
          </button>
        </div>
        {detailGrid(
          selected,
          (columns[tab] ?? []).concat(
            tab === "beta-applications"
              ? [
                  ["reviewNote", "审核备注"],
                  ["history", "审核历史"],
                  ["submittedFields", "全部提交字段"],
                ]
              : [],
          ),
        )}
        <div className="action-bar">
          {tab === "beta-applications" && (
            <>
              {action({
                resource: tab,
                action: "approve",
                label: "批准并生成邀请码",
                target,
              })}
              {action({
                resource: tab,
                action: "approve-and-email",
                label: "批准并发送邀请邮件",
                target,
              })}
              {action({
                resource: tab,
                action: "reject",
                label: "拒绝",
                target,
              })}
              {action({
                resource: tab,
                action: "shortlist",
                label: "标记候选",
                target,
              })}
              {action({
                resource: tab,
                action: "resend",
                label: "重新发送邀请",
                target,
              })}
            </>
          )}
          {tab === "invitations" && (
            <>
              {action({
                resource: tab,
                action: "disable",
                label: "禁用",
                target,
              })}
              {action({
                resource: tab,
                action: "enable",
                label: "重新启用",
                target,
              })}
              {action({
                resource: tab,
                action: "revoke",
                label: "撤销",
                target,
              })}
              {action({
                resource: tab,
                action: "expire",
                label: "修改失效时间",
                target,
              })}
            </>
          )}
          {tab === "entitlements" &&
            typeof selected.grantId === "string" &&
            action({
              resource: tab,
              action: "revoke",
              label: "撤销管理员授权",
              target,
              input: { grantId: selected.grantId },
            })}
          {tab === "quotas" &&
            action({
              resource: tab,
              action: "adjust",
              label: "设置自定义额度",
              target,
            })}
          {tab === "bans" &&
            action({
              resource: tab,
              action: "unban",
              label: "解除限制",
              target,
            })}
          {tab === "email" &&
            action({
              resource: tab,
              action: "resend",
              label: "重新发送",
              target,
            })}
        </div>
      </section>
    );
  }
  return (
    <>
      <div className="page-heading">
        <div>
          {detailId && (
            <Link className="back-link" href="/users">
              <ArrowLeft size={14} />
              返回用户列表
            </Link>
          )}
          <span className="eyebrow">
            {section === "dashboard"
              ? "Visual Deadline / 运营概况"
              : "Visual Deadline / 运营管理"}
          </span>
          <h1>{title}</h1>
          <p>
            {detailId
              ? "查看账号元数据，执行有据可查的运营操作。"
              : descriptions[section]}
          </p>
        </div>
        <div className="heading-actions">
          <button
            className="secondary"
            onClick={() => setReload(reload + 1)}
            disabled={loading}
          >
            <RefreshCw size={15} className={loading ? "spin" : ""} />
            刷新
          </button>
          {section === "invitations" && (
            <button
              className="primary"
              disabled={
                !configured || !canMutate(actor.role, "invitations", "create")
              }
              onClick={() =>
                setDialog({
                  resource: "invitations",
                  action: "create",
                  label: "生成邀请码",
                  target: "new",
                  input: { kind: "personal", limit: 1 },
                })
              }
            >
              <Plus size={15} />
              生成邀请码
            </button>
          )}
        </div>
      </div>
      {pending && (
        <div className="connection-notice">
          <Database size={19} />
          <div>
            <strong>VD 运营数据尚未接入</strong>
            <span>当前未加载用户或运营指标。接入权威管理契约后即可使用。</span>
          </div>
          <Link href="/settings">
            查看接入状态
            <ArrowUpRight size={14} />
          </Link>
        </div>
      )}
      {error && !columns[tab] && (
        <div role="alert" className="notice error-notice">
          {error}
          <button className="secondary" onClick={() => setReload(reload + 1)}>
            重试
          </button>
        </div>
      )}
      {section === "dashboard" ? (
        dashboard()
      ) : detailId ? (
        userDetail()
      ) : (
        <>
          {section === "entitlements" && (
            <div className="tabs">
              {[
                ["entitlements", "会员授权"],
                ["quotas", "AI 额度"],
              ].map(([id, label]) => (
                <button
                  className={tab === id ? "active" : ""}
                  key={id}
                  onClick={() => {
                    setTab(id as Resource);
                    setSelected(null);
                    setCursor("");
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          {columns[tab] && (
            <>
              <form
                className="filterbar"
                onSubmit={(event) => {
                  event.preventDefault();
                  setQuery(search);
                  setCursor("");
                }}
              >
                <div className="searchbox">
                  <Search size={17} />
                  <input
                    aria-label="搜索记录"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={
                      section === "users"
                        ? "搜索邮箱、用户 ID、用户名或邀请码"
                        : "搜索邮箱、记录 ID 或关键词"
                    }
                  />
                </div>
                {["beta-applications", "invitations", "bans"].includes(tab) && (
                  <select
                    aria-label="筛选状态"
                    value={filter}
                    onChange={(event) => {
                      setFilter(event.target.value);
                      setCursor("");
                    }}
                  >
                    <option value="">全部状态</option>
                    {(tab === "beta-applications"
                      ? [
                          "pending",
                          "shortlisted",
                          "approved",
                          "rejected",
                          "invited",
                          "registered",
                          "expired",
                        ]
                      : tab === "bans"
                        ? ["normal", "restricted", "suspended", "banned"]
                        : ["active", "disabled", "revoked", "expired"]
                    ).map((value) => (
                      <option key={value} value={value}>
                        {statusLabels[value]}
                      </option>
                    ))}
                  </select>
                )}
                <button className="secondary">查询</button>
              </form>
              {recordDetail()}
              {table()}
            </>
          )}
          {section === "entitlements" && (
            <div className="notice compact">
              {tab === "quotas"
                ? "Free、Plus、Pro 与独立额度策略均由 VD 管理。个人覆盖与 Paddle 订阅解耦。"
                : "授权来源独立展示：Paddle 订阅、历史会员、内测赠送、管理员补偿、推广和测试。手动赠送不会修改 Paddle 订阅周期。"}
            </div>
          )}
          {section === "bans" && (
            <section className="panel">
              <div className="panel-header">
                <h2>账号控制操作</h2>
              </div>
              <div className="action-bar">
                {[1, 7, 30].map((days) => (
                  <span key={days}>
                    {action({
                      resource: "bans",
                      action: "suspend",
                      label: `暂停 ${days} 天`,
                      input: { days },
                    })}
                  </span>
                ))}
                {action({ resource: "bans", action: "ban", label: "永久封禁" })}
                {action({
                  resource: "bans",
                  action: "unban",
                  label: "解除限制",
                })}
              </div>
            </section>
          )}
          {section === "email" && (
            <section className="panel email-preview">
              <div className="panel-header">
                <div>
                  <h2>中文邮件模板</h2>
                  <p>本地预览适配器 · 不会发送邮件</p>
                </div>
                <span className="subtle-chip">预览模式</span>
              </div>
              <div className="template-layout">
                <div className="template-list">
                  {Object.entries(emailTemplates).map(([key, value]) => (
                    <button
                      key={key}
                      className={template === key ? "active" : ""}
                      onClick={() => setTemplate(key as EmailTemplate)}
                    >
                      <Mail size={15} />
                      {value.label}
                    </button>
                  ))}
                </div>
                <div className="template-preview">
                  <p className="muted">
                    发件人：Visual Deadline &lt;invite@visualdeadline.com&gt;
                  </p>
                  <h3>{emailTemplates[template].subject}</h3>
                  <iframe
                    title="邮件模板预览"
                    sandbox=""
                    srcDoc={
                      renderEmail(template, {
                        name: "收件人",
                        ...(template === "invitation"
                          ? {
                              code: "〈实际邀请码〉",
                              expiresAt: "〈实际截止时间〉",
                              registrationUrl: "https://visualdeadline.com",
                            }
                          : {}),
                      }).html
                    }
                  />
                </div>
              </div>
            </section>
          )}
          {section === "analytics" && (
            <>
              <section className="panel">
                <div className="panel-header">
                  <h2>用户转化漏斗</h2>
                  <span className="subtle-chip">VD 事件账本</span>
                </div>
                <div className="funnel-grid">
                  {funnel.map((label, index) => (
                    <div key={label}>
                      <span className="funnel-index">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span>{label}</span>
                      <strong>
                        {format(data.summary?.[`funnel${index}`])}
                      </strong>
                    </div>
                  ))}
                </div>
              </section>
              <section className="panel">
                <div className="panel-header">
                  <h2>分组与留存</h2>
                </div>
                <p className="panel-copy">
                  按邀请批次、推荐来源、注册周、机构、身份查看激活率、D1 / D3 /
                  D7、WAU、MAU、每周活跃天数、AI 与回顾采用率、付费转化、ARPU
                  和每活跃用户 AI 预估成本。
                </p>
                <Empty pending />
              </section>
            </>
          )}
          {section === "infrastructure" && (
            <div className="provider-grid">
              {providers.map((provider) => (
                <section className="panel provider-card" key={provider.name}>
                  <div className="provider-logo">
                    {provider.name.slice(0, 1)}
                  </div>
                  <div>
                    <h2>{provider.name}</h2>
                    <span className="subtle-chip">{provider.label}</span>
                  </div>
                  <p>{provider.detail}</p>
                </section>
              ))}
            </div>
          )}
          {section === "settings" && (
            <>
              <section className="panel">
                <div className="panel-header">
                  <h2>接入与权限</h2>
                  <ShieldCheck size={19} />
                </div>
                {detailGrid(
                  {
                    role: "所有者",
                    auth: "Supabase Auth · 每次请求验证",
                    gateway: configured ? "已配置，等待服务验证" : "尚未接入",
                    domain: "admin.visualdeadline.com",
                    audit: "由 VD 管理契约原子写入",
                    session: "最长 1 小时；过期后重新登录",
                  },
                  [
                    ["role", "当前角色"],
                    ["auth", "认证方式"],
                    ["gateway", "VD 管理服务"],
                    ["domain", "目标域名"],
                    ["audit", "审计边界"],
                    ["session", "会话有效期"],
                  ],
                )}
              </section>
              <section className="panel">
                <div className="panel-header">
                  <h2>待接入依赖</h2>
                </div>
                <p className="panel-copy">
                  Supabase 运营数据、VD 管理
                  API、不可变审计日志、邀请码消费、有效会员投影、额度重置、账号限制与邮件发送账本。详细契约与上线清单位于项目
                  docs 目录。
                </p>
                <div className="panel-bottom">
                  <LockKeyhole size={16} />
                  凭据仅在部署平台的服务端环境中配置。
                </div>
              </section>
            </>
          )}
        </>
      )}
      {dialog && (
        <ActionDialog
          spec={dialog}
          close={() => setDialog(null)}
          done={() => {
            setReload(reload + 1);
            setSelected(null);
          }}
        />
      )}
    </>
  );
}
function UsersIcon({ index }: { index: number }) {
  return index === 0 ? (
    <Database size={17} />
  ) : index === 3 ? (
    <Activity size={17} />
  ) : (
    <ArrowUpRight size={17} />
  );
}
