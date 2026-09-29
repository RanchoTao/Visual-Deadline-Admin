# Admin 架构

## 边界

```text
浏览器（中文界面 / 最少 DTO）
  → Next Route Handler（身份验证 / RBAC / 来源校验 / 请求 ID）
  → server-only VD gateway（内部凭据 / 超时 / 错误隔离）
  → VD 权威管理服务（业务规则 / 事务 / 幂等 / 不可变审计）
  → VD 数据库与服务商
```

这是独立仓库，不在产品前端内挂载，不复制 Plus、到期叠加、邀请码消费、额度重置、封禁执行规则。UI 中的“+7 天”等只是管理命令参数；最终状态由 VD 返回。

## 模块

| 位置                         | 职责                                       |
| ---------------------------- | ------------------------------------------ |
| `src/app/(console)`          | 认证保护的页面                             |
| `src/app/api/auth`           | 服务端 Supabase 登录、退出与 HttpOnly 会话 |
| `src/app/api/admin`          | 每次请求独立认证、授权与响应投影           |
| `src/server/operations.ts`   | 操作边界与基本输入校验                     |
| `src/server/gateway-core.ts` | 可注入并测试的权威 HTTP 管理接口           |
| `src/server/projection.ts`   | 普通视图的字段白名单与审计快照脱敏         |
| `src/server/providers`       | 服务接入能力与隔离边界                     |
| `src/lib/email-templates.ts` | 纯中文模板渲染与预览                       |
| `src/components`             | 导航、查询、数据表、受控操作弹窗           |

## 检查到的产品现状

2026-09-28 只读检查 `D:/Projects/Visual-Deadline`，提交 `aeb969352b125e9c1a173abadf5c1f5a60c3149a`（`codex/chinese-ui-polish`）：

- `src/domain/billing/contracts.ts` 定义了 `vd.plus` 与独立授权来源。
- `supabase/migrations/20260823193000_billing_v1.sql` 有 `billing_admin_grant(uuid, text, timestamptz, uuid, text)`，仅支持 `vd_monthly` / `vd_yearly`，没有请求 ID、完整 before/after 审计与任意天数赠送。
- `server/billing/domain.js` 与数据库已有有效会员投影，应由产品侧提供权威查询，不在 Admin 重算。
- 未找到满足本项目范围的 admin API、运营审计结构、内测申请 / 邀请管理、AI 额度管理或封禁操作契约。

因此现有 billing RPC **未直接调用**。接口草案 `vd-admin-v1` 是待双方确认的接入边界，不能当作已存在的 VD 后端能力。产品仓库未修改。

## 数据状态

“尚未接入”表示未配置或后端能力未实现；“暂无数据”表示权威源没有返回该值或查询为空。未知量保持未知，不以 0、样例用户、图表趋势代替。时间序列、完整分析筛选和服务商实时指标为后续范围。

## 上线路径

1. VD 实现契约、权限校验与原子不可变审计。
2. 在测试环境验收所有命令的真实事务、拒绝路径和幂等重放。
3. 使用独立 Supabase 运营身份，部署服务端变量，限制运营域名与账户。
4. 在 Vercel 创建独立 Next.js 项目，将 `admin.visualdeadline.com` 绑定至验收后的部署。
5. 保持 Paddle 为 Sandbox；生产 Paddle 接入不属于本次授权。
