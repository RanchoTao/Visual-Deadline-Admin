# 安全模型

## 身份与会话

- 浏览器将密码直接提交给同源登录 Route Handler；服务端转发至 Supabase Auth。
- 使用 `/auth/v1/user` 逐次验证 access token，不能用 JWT 解码结果或 `user_metadata` 授权。
- 初始所有者通过服务端 `ADMIN_OWNER_USER_IDS` UUID 白名单绑定。其他角色只定义权限结构，尚未开放账号绑定。
- access token 只存在于 HttpOnly、SameSite=Strict、Path=/ 会话 Cookie；生产设置 Secure，最长一小时，无 refresh token 或 localStorage 存储。
- 无注册入口、演示绕过或硬编码账号。注销清除 Cookie，并尝试撤销当前 Supabase 会话；上游不可用时本地会话仍清除。
- 账号禁用 / 所有者白名单移除后，后续请求拒绝。Supabase 访问 token 在正常有效期内的上游撤销语义须在接入验收中确认。

## API

所有运营 GET 与 POST 逐次验证身份和权限。导航显示不构成授权。变更 POST 要求匹配的 Origin；缺失或跨站 Origin 均拒绝。客户端不能指定 actor 或 role。普通内容查询禁止通过 restricted-content GET 访问。

内部凭据只由 `server-only` 包装模块读取。无 `NEXT_PUBLIC_*` 私钥，无直接数据库表写入。上游请求禁止跟随重定向，有超时，不将上游错误正文或环境值传给浏览器。响应禁用共享缓存，设置 nosniff、no-referrer、DENY frame。

页面使用每次请求生成的 CSP nonce 与 strict-dynamic；生产脚本不允许 unsafe-inline / unsafe-eval，默认连接仅同源。开发环境仅为 Next 调试开启 unsafe-eval 与 WebSocket。邮件沙盒预览需静态 inline styles，因此 style-src 允许 unsafe-inline。相机、麦克风与定位被 Permissions-Policy 禁用。nonce 行为按 [Next.js 官方 CSP 指南](https://nextjs.org/docs/app/guides/content-security-policy) 实现并验收。

普通数据通过字段白名单投影；任意 tasks/goals/reviews 原文、token、未知 provider 对象均剥离。审计 before/after 只保留运营状态白名单。受限内容仅经独立审计 POST 返回，关闭弹窗时清理页面状态，不持久化。

## 审计与幂等

- 所有状态变更以及受限内容读取要求原因（至少 8 字符）。
- 确认弹窗展示操作、目标、原因、参数与请求 ID。
- 同一弹窗重试沿用同一 `Idempotency-Key`，服务端将其转给 VD。
- VD 必须原子提交变更与不可变审计，回执含 actor、action、target、reason、before、after、timestamp、requestId。
- Admin 校验回执与请求匹配才显示成功。缺少回执时显示核查提示；操作可能已经提交，不允许把报错当作未发生。
- Admin 不提供审计修改或删除路由。真实不可变性、重放、事务回滚及 append-only 权限需要 VD 后端验收。

## 接入验收要求

必须确认：HTTPS、独立运营账号、部署白名单正确、Supabase 登录限制、生产 Cookie 与缓存头、VD 内部调用者权限、后台 actor 验证、所有跨用户操作授权、不可变审计、幂等并发行为、受限内容最小范围与到期、真实邮件 ledger/outbox。凭据不进入代码、浏览器资源、构建日志或 Git。

目前自动测试证明 Admin 控制点及合约行为，未证明生产数据库安全、真实邮件投递或服务商配置。上线前在受控环境执行这些集成验收。
