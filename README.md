# Visual Deadline 运营控制台

独立的 Admin-0 / Admin-1 项目，目标域名为 `admin.visualdeadline.com`。普通界面使用简体中文。当前交付是可接入的安全基础，**未连接生产数据，未部署，未发送邮件**。

Admin-1 仍是经过合约测试的控制台，尚未启用任何生产运营写入。下一项必需依赖是 VD 权威管理 API。目标套餐模型为 Free / Plus / Pro；生产 Admin 强制 Supabase TOTP MFA / AAL2。

## 本地启动

```powershell
npm ci
Copy-Item .env.example .env.local
# 在受控环境中填写变量；不要粘贴到聊天、日志或 Git。
npm run dev
```

打开 `http://localhost:3000`。未配置认证时会显示中文接入提示，运营页面与 API 均拒绝匿名访问。没有公开演示账号或认证绕过。推荐 Node.js 22 LTS 或更新版本。

### 首次所有者接入

1. 在 Supabase Auth 中准备已确认邮箱的独立运营账号。
2. 设置服务端 `SUPABASE_URL`、`SUPABASE_PUBLISHABLE_KEY`。
3. 将运营账号的 **Auth user UUID** 放入 `ADMIN_OWNER_USER_IDS`（逗号分隔）。不要使用邮箱、用户可编辑的 metadata 或客户端角色作为权限来源。
4. 生产登录后先进入 `/mfa` 注册或挑战 TOTP，达到 AAL2 后才能访问控制台。每次运营请求重新验证 Supabase 身份和 AAL。会话最多一小时，过期后重新登录。不存储 refresh token。
5. 待 VD 权威管理 API 交付并验收后，再设置 `VD_ADMIN_API_URL` 与 `VD_ADMIN_API_TOKEN`。这是待由 VD 后端实现并验收的管理服务，不是 Supabase REST URL。参阅 [管理契约](docs/VD_ADMIN_CONTRACT.md)。

`.env.example` 仅含变量名，无默认凭据。无凭据、无契约、服务故障均不生成虚构数据或执行替代写入。生产环境仅允许 HTTPS 上游；本地开发可使用回环地址。

## 已包含

- 14 项中文导航、桌面和适配平板的运营布局。
- 总览、用户搜索与详情、内测审核队列、邀请码管理。
- 会员赠送 / 撤销、独立 AI 额度、封禁 / 解封、操作确认与必填原因。
- 只读审计页面、单独受限内容访问流程。
- Server-only VD gateway、RBAC、数据最小化、请求 ID 与幂等转发。
- 6 个服务适配器边界，8 个中文邮件模板与沙盒预览。
- 缺失接入、空数据、加载、错误、重新登录状态。

## 验证

```powershell
npm test
npm run typecheck
npm run build
git diff --check
```

测试使用本地合成的接口回执，验证安全控制与命令转发，**不证明 VD 的数据库事务、RLS、业务规则或线上服务已实现**。HTTP 合约验收运行 `npm run test:http`（会启动本地 fixture 和 Next 开发服务，无真实凭据）。

构建后运行 `npm run check:client` 检查浏览器产物边界，`npm run test:production` 检查实际生产运行时的 CSP nonce、认证拒绝、缓存与 frame 防护。

## 文档

- [架构](docs/ADMIN_ARCHITECTURE.md)
- [安全模型](docs/ADMIN_SECURITY_MODEL.md)
- [所有者紧急恢复](docs/ADMIN_BREAK_GLASS.md)
- [权限](docs/ADMIN_RBAC.md)
- [服务接入](docs/PROVIDER_INTEGRATIONS.md)
- [内测运营](docs/BETA_OPERATIONS.md)
- [VD 管理接口契约草案](docs/VD_ADMIN_CONTRACT.md)

发布前需在 VD 侧实现管理契约并验收原子审计、幂等、权限与数据投影。GitHub PR 不会自动合并；此项目不会自动部署或修改 Visual Deadline 产品仓库。

仅 `NODE_ENV=development` 允许所有者 AAL1，登录页明确标注较弱认证。生产无绕过开关。Free 无 premium 能力，Plus 对应 vd.plus，Pro 对应 vd.pro 并包含 vd.plus。Pro 按钮在权威能力声明缺失时禁用，服务端也拒绝请求；这不表示 VD 生产已支持 Pro。


## PR140 source-list compatibility

The VD entitlements list returns one entitlement/source record with its own `id`, `userId`, tier/source/status/validity/reason and effective tier. An optional `grantId` identifies only an independent administrator grant; the UI offers revocation only when that authoritative ID exists. Subscription records have no administrator revocation action. User detail remains aggregated and its existing grant controls remain supported.

Ordinary invitation lists contain masked codes. The console labels these as `脱敏码不可复制`; full codes are displayed only in the successful creation or matching original idempotent receipt. No production configuration, deployment or subscription edit is enabled by this compatible change.
