# 所有者 MFA 紧急恢复

生产没有 AAL1 绕过、固定恢复令牌或永久紧急账号。设备丢失不会降低 Admin 认证策略。

1. 使用组织保管的 Supabase 项目控制面访问权限，由项目所有者核实请求人身份、Auth user UUID 与 ADMIN_OWNER_USER_IDS。建立安全事件或工单，记录批准人、原因与时间；不要把密码、OTP、二维码或密钥写入工单。
2. 优先使用仍可用的已绑定验证器。全部丢失时，在受控设备登录 Supabase Dashboard 的 Authentication / Users，找到经过核实的所有者 UUID，检查并移除丢失的 MFA 因子。如 Dashboard 当前界面不支持，使用官方服务端 Admin MFA listFactors / deleteFactor 接口人工处理；所需项目管理员凭据从秘密管理器临时提供，绝不能写入 Admin 源码、浏览器或聊天。
3. 如怀疑设备或密码泄漏，先暂停相关人员访问，撤销会话并重置密码。移除因子后，按项目支持的管理方式撤销该用户现存会话；旧 access token 的撤销传播与有效期必须核查，不能假设删除因子立即让所有旧令牌失效。必要时暂时从 Admin UUID 白名单移除该用户直到旧会话不可用，再恢复原 UUID。
4. 所有者使用确认邮箱和密码重新登录 Admin。生产 AAL1 只能到 `/mfa`，注册新 TOTP 并验证后才能恢复 AAL2。不得设置 NODE_ENV=development、跳过中间件或临时修改代码放行生产。
5. 恢复后复核 Supabase Auth 审计与 Admin/VD 审计，记录操作者、受影响 UUID、旧因子 ID、变更时间、工单与成功 AAL2 验证证据。调查恢复窗口内的登录和运营操作；在安全事件记录中追加恢复审计。Admin 无后门审计写接口，不伪造 VD 原子审计回执。
6. 撤销人工操作中临时授予的权限，确认白名单、生产 AAL2 门禁和会话策略恢复正常，关闭事件。凭据如有暴露应轮换。

人工恢复仅在真实紧急事件中由授权项目所有者执行。本次开发没有连接 Supabase 项目，也没有执行真实恢复。

参考：[Supabase Admin MFA 删除因子](https://supabase.com/docs/reference/javascript/auth-admin-deletefactor)、[Supabase TOTP](https://supabase.com/docs/guides/auth/auth-mfa/totp)。
