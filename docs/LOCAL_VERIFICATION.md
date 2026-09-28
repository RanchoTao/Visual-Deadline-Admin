# Admin-1 本地验收记录

日期：2026-09-28。环境：Windows、Node.js 25.2.1、npm 11.6.2、Next.js 16.3.6。依赖锁定在 package-lock.json；CI 使用 Node.js 22。

| 检查 | 已观察结果 |
|---|---|
| npm test | 21 / 21 通过 |
| npm run typecheck | 通过，先生成 Next route types |
| npm run build | 通过，受保护页面与登录为动态服务端页面 |
| npm run check:client | 16 个构建资源通过特权标识与 fixture token 检查 |
| npm run test:http | 44 项真实 Route Handler 合约检查通过 |
| npm run test:production | nonce 注入 / 逐请求更新、生产 CSP、认证拒绝、缓存与 frame 防护通过 |
| 浏览器 | 登录、用户列表 / 详情、会员原因与确认弹窗、审计成功回执、内测申请详情、邮件 iframe 预览通过 |
| 平板宽度 | 768 px 下页面宽度与 viewport 一致，无页面横向溢出；导航切换为菜单按钮 |
| 浏览器控制台 | 验证时未观察到 error / warn |

HTTP 与浏览器验证只使用本地 contract fixture。这里的账号、申请、邀请和回执全部为合成测试数据；截图中不展示真实运营指标。没有查询生产数据库、发送邮件、访问受限真实用户内容或修改产品业务数据。

## 界面截图

本地合约测试视图，非生产连接。数字指标保持未知，不插入模拟增长趋势。

![Admin 总览（本地合约测试）](screenshots/admin-console.png)

## 验证边界

这些检查证明 Admin 的权限、路由、渲染、安全边界与命令 / 回执处理。它们不证明 VD 的真实数据库事务、邀请码规则、会员计算、额度重置、封禁执行、审计不可变性或服务商投递已经实现。需要按 VD_ADMIN_CONTRACT.md 在产品后端单独验收。
