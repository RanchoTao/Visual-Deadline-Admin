# VD 管理接口草案：vd-admin-v1

**这是 Admin 提出的待接入契约，不是已经存在的产品接口或权威审计 schema。** VD 应将现有域规则与权威审计结构映射到此 DTO；若产品正式契约不同，应更新 Admin adapter。

## 通用边界

基址为 `VD_ADMIN_API_URL`，服务端附带 `Authorization: Bearer <内部凭据>`、`X-Admin-Actor`、`X-Admin-Role`、`X-Admin-Contract: vd-admin-v1`。后端只接受受信内部调用者，验证 actor 真实绑定与角色、对象级权限。所有响应使用 JSON，禁止重定向。

### 读取

`GET v1/admin/{resource}?q=&cursor=&id=&status=&cohort=&limit=50`

资源：dashboard、users、beta-applications、invitations、entitlements、quotas、bans、audit、feedback、ai-usage、email、analytics、infrastructure、deployments、settings。

```ts
interface ReadResult {
  items: Record<string, unknown>[]; // 每页最多 100；UI 请求 50
  nextCursor?: string;
  summary?: Record<string, string | number | boolean | null>;
}
```

列表字段由 `src/lib/catalog.ts` 定义，详情元数据白名单在 `src/server/projection.ts`，typed DTO 在 `src/lib/contracts.ts`。所有列表记录必须有 id；邮箱 / 姓名搜索需服务端分页及权限控制。`users?id=` 返回最多一条，包含权威 effectivePlus、validUntil、entitlementSources、subscriptionId、adminGrants、quota 信息与 activity 数量。禁止附带任意私人原文。

`beta-applications` 提供提交字段与审核历史。`audit` 的 before/after 必须由产品先脱敏；Admin 再做状态白名单投影。禁止返回令牌、秘密或用户原文。

dashboard summary 键见 catalog.metrics；同时支持 currentCommit、latestDeployment、deploymentHealth、databaseEnvironment、source、observedAt、windowStart、windowEnd。单位、时区、自然日口径、预估费用币种与延迟单位须后端明确。analytics summary funnel0…funnel13 对应 catalog.funnel。未知量使用 null 或省略，不虚构值。

### 操作

`POST v1/admin/{resource}/actions`，附带 `Idempotency-Key: <UUID>`。

```ts
interface Command {
  action: string;
  target: string; // 记录 ID / 用户 ID；生成邀请码时为 new
  reason: string;
  input: Record<string, unknown>;
  requestId: string;
}
interface Receipt {
  result: Record<string, unknown>;
  auditEvent: {
    id: string;
    actor: string; // UUID，与请求 actor 一致
    action: string; // command 名，与请求 action 一致
    target: string;
    reason: string;
    before: unknown;
    after: unknown;
    timestamp: string; // ISO 8601
    requestId: string;
  };
}
```

| 资源               | 操作                                                      | 关键参数                                                                                       |
| ------------------ | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| beta-applications  | approve / approve-and-email / reject / shortlist / resend | target=申请 id；事务涵盖邀请与审计；邮件进入 outbox                                            |
| invitations        | create / disable / enable / revoke / expire               | kind、cohort、limit、expiresAt、note；不重用已消费 one-time 码                                 |
| entitlements       | grant / revoke                                            | target=用户 id；days 或 validUntil 或 permanent；source；revoke 可带 grantId，只影响管理员授权 |
| quotas             | adjust / reset                                            | target=用户 id；delta 或 limit 或 unlimited；后端验证测试账号与策略权限                        |
| bans               | restrict / suspend / ban / unban                          | target=用户 id；days、reasonCode；后端 enforcement                                             |
| email              | resend                                                    | target=原始发送记录 id；不得接受任意模板代码或任意收件地址                                     |
| restricted-content | inspect                                                   | target=用户 id；category、caseReference、scope、from、until；仅 owner                          |

所有日期参数为带时区 ISO 时间。scope 为 tasks / goals / reviews；category 为 support / report / security / legal / other。后端仍必须校验工单授权、用户关系、时间跨度与数量上限。

inspect 回执 result 为 `{scope, items:[{id, title?, content?, createdAt?, updatedAt?}]}`。scope 必须与请求一致，最多 50 条。Admin 只返回这些字符串字段，剥离其他数据；内容单字段上限 20,000 字符，后端须限制总响应体并明确分页或截断。普通命令 result 仅投影 inviteId、inviteCode、expiresAt、status、queuedEmailId、grantId、effectivePlus、validUntil、policy、limit、used、remaining。

## 原子性要求

1. 后端在同一事务中执行业务变更与不可变审计；审计失败则变更回滚。
2. 幂等作用域包含 actor 与 requestId；同内容重放返回原回执，改变内容的重放拒绝。
3. 串行化冲突、检查版本 / 当前状态，不静默覆盖并发管理员操作。
4. 审计 append-only，禁止运营角色 UPDATE / DELETE；审计结构以产品 schema 为权威。
5. 邮件发送使用 outbox，记录发送尝试及 provider 回执；不把“已排队”当“已送达”。
6. restricted-content 访问审计先提交后返回，返回只包含获准范围；上游须最小化内容并限制体积。
7. 4xx 拒绝、5xx 故障；缺少有效审计回执时 Admin 显示待核查，禁止假定成功或自动新建请求重试。

## 后端交付检查

需测试真实事务回滚、幂等重复 / 并发、role 撤销、跨用户权限、审计不可变、已消费邀请重启拒绝、赠送与订阅独立、额度重置语义、封禁在产品请求中生效、内容访问范围与邮件失败恢复。当前合成测试不替代这些后端测试。
