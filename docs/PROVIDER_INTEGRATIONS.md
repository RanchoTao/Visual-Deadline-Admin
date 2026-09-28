# 服务接入

| 服务     | 当前交付                                | 后续接入                                                        |
| -------- | --------------------------------------- | --------------------------------------------------------------- |
| VD       | typed gateway、DTO 投影、命令与审计回执 | 实现并验收 `vd-admin-v1`                                        |
| Supabase | 服务端 Auth REST 验证与登录             | 数据库身份 / 健康 / schema 版本由 VD 投影；不在前端使用特权密钥 |
| GitHub   | 只读状态适配器边界                      | main SHA、近期提交、PR / Issue 数、最新发布                     |
| Vercel   | 只读状态适配器边界                      | 生产部署、状态、SHA、近期部署                                   |
| Paddle   | 明确尚未接入                            | **仅 Sandbox**；从 VD 账单投影读取，禁止改写订阅周期            |
| Resend   | 8 个中文模板、sandbox iframe 本地预览   | VD 可审计发送 / outbox 与 webhook 账本                          |
| DeepSeek | 明确 VD ledger 来源                     | 调用 / tokens / 预估费用 / 失败 / 延迟；不抓取控制台            |

这一版本未实现实时 provider API 查询；设置了 token 也不会把尚未实现的适配器标为已连接。每个 `ProviderAdapter.inspect()` 隔离失败，React 只接收标准化状态 DTO。

## 环境变量

所有变量均为服务端：

- `SUPABASE_URL`、`SUPABASE_PUBLISHABLE_KEY`：认证端点与 publishable key。
- `ADMIN_OWNER_USER_IDS`：已确认邮箱的 Supabase user UUID。
- `VD_ADMIN_API_URL`、`VD_ADMIN_API_TOKEN`：待实现管理服务的基址与限定内部 API 的凭据。
- `GITHUB_TOKEN`：未来只读 GitHub 适配器；限定到所需 repo。
- `VERCEL_TOKEN`、`VERCEL_PROJECT_ID`：未来只读部署适配器。
- `PADDLE_API_KEY`：未来 **Sandbox** 适配器；当前不调用。
- `RESEND_API_KEY`：未来邮件适配器；当前不调用。

这里不需要 Supabase service*role / secret key 或 DeepSeek API key；相应特权服务属于 VD 后端。不要从产品 `.env` 复制全部变量，也不要将凭据命名为 `NEXT_PUBLIC*\*`。

## 邮件

本地预览明确显示“预览模式”，不会调用 Resend、写入假发送成功记录或向外发送。HTML 变量转义，注册链接限 Visual Deadline HTTPS 域名。邀请、申请通过 / 拒绝、欢迎、会员赠送 / 到期、账号限制、客服回复模板均已提供。

目标发件身份：`Visual Deadline <invite@visualdeadline.com>`、`support@visualdeadline.com`、`notify@visualdeadline.com`。上线前由 Resend 验证域名与发件身份。未来发送只经 VD outbox，账本保存 message ID、template、recipient、status、createdAt、deliveredAt、bounce、complaint；事件按 provider ID 幂等处理。Admin 不在审核事务外直接发邮件，避免邮件发出却无审计的双写问题。
