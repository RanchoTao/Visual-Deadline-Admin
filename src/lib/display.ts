const labels: Record<string, string> = {
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
  pro: "Pro",
  "vd.plus": "Plus 能力",
  "vd.pro": "Pro 能力",
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
  approve: "批准",
  "approve-and-email": "批准并发送邀请",
  reject: "拒绝",
  shortlist: "标记候选",
  resend: "重新发送",
  create: "生成",
  disable: "禁用",
  enable: "启用",
  revoke: "撤销",
  expire: "修改失效时间",
  grant: "赠送会员",
  adjust: "调整额度",
  reset: "重置本周期",
  restrict: "限制账号",
  suspend: "暂停账号",
  ban: "封禁",
  unban: "解除限制",
  inspect: "访问受限内容",
};
const fieldLabels: Record<string, string> = {
  id: "记录 ID",
  source: "来源",
  status: "状态",
  validUntil: "有效截止",
  reason: "原因",
  actor: "操作人",
  action: "操作",
  timestamp: "时间",
  name: "名称",
  count: "数量",
  label: "字段",
  value: "内容",
  days: "天数",
  permanent: "永久测试权限",
  unlimited: "测试无限额度",
  delta: "增加次数",
  limit: "额度上限",
  cohort: "内测批次",
  kind: "邀请码类型",
  expiresAt: "失效时间",
  note: "备注",
  grantId: "授权 ID",
  reasonCode: "风控原因类型",
  category: "访问原因类型",
  caseReference: "工单编号",
  scope: "内容范围",
  from: "开始时间",
  until: "截止时间",
  accountStatus: "账号状态",
  effectiveTier: "最终有效层级",
  currentTier: "当前套餐",
  tier: "授权层级",
  validFrom: "生效时间",
  capabilities: "能力",
  effectivePlus: "Plus 生效",
  used: "已使用",
  remaining: "剩余",
  code: "邀请码",
};
export function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "暂无数据";
  if (typeof value === "boolean") return value ? "是" : "否";
  if (Array.isArray(value))
    return value.length ? value.map(displayValue).join("\n\n") : "暂无数据";
  if (typeof value === "object")
    return (
      Object.entries(value)
        .map(([key, v]) => `${fieldLabels[key] || key}：${displayValue(v)}`)
        .join("\n") || "暂无数据"
    );
  if (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T/.test(value) &&
    Number.isFinite(Date.parse(value))
  )
    return new Date(value).toLocaleString("zh-CN", {
      timeZone: "Asia/Shanghai",
      hour12: false,
    });
  return labels[String(value)] ?? String(value);
}
