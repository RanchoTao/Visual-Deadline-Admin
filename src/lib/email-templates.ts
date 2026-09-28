export const emailTemplates = {
  invitation: {
    label: "内测邀请",
    subject: "你的 Visual Deadline 内测邀请已准备好",
    body: "感谢你关注 Visual Deadline。我们期待听到你的使用反馈。",
  },
  approved: {
    label: "申请通过",
    subject: "你的 Visual Deadline 内测申请已通过",
    body: "你的申请已通过审核。请使用邀请信息完成注册。",
  },
  rejected: {
    label: "申请未通过",
    subject: "Visual Deadline 内测申请审核结果",
    body: "感谢你的申请。本轮内测名额有限，暂时无法提供邀请。",
  },
  welcome: {
    label: "欢迎加入",
    subject: "欢迎使用 Visual Deadline",
    body: "欢迎加入 Visual Deadline，从第一个任务和目标开始。",
  },
  membershipGift: {
    label: "会员赠送",
    subject: "你收到了 Visual Deadline 会员授权",
    body: "我们为你的账号提供了会员授权。具体有效期请以账号页面为准。",
  },
  membershipExpiring: {
    label: "会员即将到期",
    subject: "你的 Visual Deadline 会员即将到期",
    body: "请前往账号页面查看当前授权来源与有效期。",
  },
  restriction: {
    label: "账号限制",
    subject: "Visual Deadline 账号状态通知",
    body: "你的账号状态发生了变更。如有疑问，请联系支持团队并提供工单编号。",
  },
  supportReply: {
    label: "客服回复",
    subject: "Visual Deadline 支持团队回复",
    body: "我们已收到你的问题，请查看本次工单的回复。",
  },
} as const;
export type EmailTemplate = keyof typeof emailTemplates;
function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
}
export function renderEmail(
  template: EmailTemplate,
  input: {
    name?: string;
    code?: string;
    expiresAt?: string;
    registrationUrl?: string;
  },
) {
  const definition = emailTemplates[template];
  let cta = "";
  if (input.registrationUrl) {
    const url = new URL(input.registrationUrl);
    if (
      url.protocol !== "https:" ||
      !["visualdeadline.com", "www.visualdeadline.com"].includes(url.hostname)
    )
      throw new Error("Registration URL must use Visual Deadline");
    cta = `<p><a href="${escapeHtml(url.href)}" style="background:#2458dc;color:white;padding:12px 20px;border-radius:8px;display:inline-block;text-decoration:none">前往注册</a></p>`;
  }
  return {
    subject: definition.subject,
    html: `<!doctype html><html lang="zh-CN"><body style="background:#f3f5fa;font-family:Arial,sans-serif;padding:32px;color:#18243a"><main style="max-width:560px;margin:auto;background:white;padding:32px;border-radius:12px"><p style="font-weight:bold;color:#2458dc">Visual Deadline</p><h1 style="font-size:22px">${escapeHtml(definition.label)}</h1><p>${escapeHtml(input.name || "你好")}，</p><p>${definition.body}</p>${input.code ? `<p>邀请码：<strong>${escapeHtml(input.code)}</strong></p>` : ""}${input.expiresAt ? `<p>有效截止：${escapeHtml(input.expiresAt)}</p>` : ""}${cta}<hr style="border:0;border-top:1px solid #e5e8f0"><p style="font-size:12px;color:#64748b">如需帮助，请联系 support@visualdeadline.com</p></main></body></html>`,
  };
}
export interface EmailAdapter {
  mode: "preview" | "resend";
  preview(
    template: EmailTemplate,
    input: Parameters<typeof renderEmail>[1],
  ): ReturnType<typeof renderEmail>;
}
export const previewEmailAdapter: EmailAdapter = {
  mode: "preview",
  preview: renderEmail,
};
