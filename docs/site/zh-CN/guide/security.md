# 配置安全

[文档首页](../index.md) · [安装](deployment.md) · [运维](operations.md) · [私密报告](troubleshooting.md)

候选版本的安全机制已有记录范围内的本地证据。托管后端G1、MVP G2及真实Free的13.G6仍未通过，不是生产认证。原生插件不能削弱 Core 策略。

## 环境、来源与浏览器边界

显式将 `HYPERBUG_ENV` 设为 `local`、`staging` 或 `production`。`DEBUG` 默认false，仅本地可为true。`ALLOWED_ORIGINS` 包含1–16个唯一精确HTTPS来源，不含通配符、路径、凭据或尾斜杠；显式本地模式也接受回环HTTP。无效策略阻止启动。缺少Origin不免除认证/权限检查。

注册公开客户端 `hyperbug-web`、精确前端 `/oauth/callback` 及作用域 `public-api`，不设置客户端机密。凭据输入、通行密钥与授权同意位于第一方授权来源。业务API使用bearer令牌并省略credentials，不使用跨站会话Cookie。应用令牌/草稿只在内存中，刷新、过期、退出或失去访问即清除私有状态。前端保持静态，由部署生成限制性CSP，不引入运行时脚本/插件注入、SSR、Pages Functions或API代理。

私有、账号、令牌及错误响应使用no-store。匿名实例元数据可缓存60秒，带验证器及Origin/Authorization/Cookie区分。预检最高300秒。前端配置公开且no-store，未版本化HTML重新验证，带哈希资源不可变。精确API/上传CORS与隔离媒体权限须匹配实际部署。

## 输入与运营限制

| 设置 | 默认/接受范围 |
| --- | --- |
| `MAX_BODY_BYTES`、`REQUEST_TIMEOUT_MS` |65,536字节/10,000ms；路由更严格限制仍适用 |
| JSON深度/节点/对象键/数组元素/字符串长度 |16 /4,096 /128 /256 /32,768个UTF-16单元 |
| URL长度/查询数量/名称/值 |8,192 /64 /128 /2,048个UTF-16单元 |
| `AUTHORIZATION_TIMEOUT_MS` |1,000ms；10–5,000 |
| `STORE_READ_TIMEOUT_MS`、`STORE_WRITE_TIMEOUT_MS` |1,000ms；10–10,000 |
| `ADMIN_RECENT_AUTH_SECONDS` |300秒；1–900 |
| `RETENTION_EXPIRED_SESSION_SECONDS` |86,400秒；1–2,592,000 |
| `ASYNC_ORPHAN_RETENTION_SECONDS` |意图到期后86,400秒；3,600–31,536,000 |
| `ASYNC_TERMINAL_RETENTION_SECONDS` |2,592,000秒；86,400–31,536,000 |

所有设置及解析范围见权威[配置规范](https://github.com/EIHRTeam/HyperBug/blob/feat/v1/docs/SECURITY-FOUNDATION.md)。原安全日志、审计、滥用、删除账号、临时上传、导出 `RETENTION_*` 仍保留，显式设置会拒绝启动；不得编造清理配置。计划清理保留审计/内容历史、活动引用及必需密钥/对象计账。提供方日志保留独立配置。

完整可选Turnstile机密/站点密钥/主机名绑定会启用必需挑战验证；部分配置失败。公开测试密钥仅限本地。已配置提供方失败时拒绝受保护操作。CAPTCHA不替代可信IP/账号限流、持久锁定或权限。Node读取原生socket对端并忽略任意转发头；反向代理真实客户端策略须验证。Workers使用受控签名入口与私有API，直接未签名请求不会获得可信客户端身份。

## 账号、保证等级与恢复

Public User与Staff身份域独立，邮箱/名称相同不授予权限。项目Triage/Maintainer/Administrator角色不授予独立 `instance-administrator`。初始化通过一次性运营通道机密注册首个Staff，没有未认证绕过。升级角色回填选择最早活动Staff，迁移前检查实际对象。暂停或凭据变更后，旧会话/令牌在下次主库验证时被拒绝；会话续期不提高认证时间或保证等级。

敏感操作要求当前角色及最近经用户验证的通行密钥登录（assurance2）。密码/初始化凭据为assurance1；仅注册通行密钥不会升级当前令牌。保证等级迁移前的凭据需要重新认证。恢复码重新生成需要最近认证；只显示一次，存储带密钥摘要，只兑换一次，替换凭据并撤销旧会话/令牌。没有强制密码设置器或实例角色管理API。最后管理员丢失后，运营重置初始化须满足存储前提，不得删除Staff/历史强行注册。

## 密钥、备份与插件信任

在私有父目录中离线运行 `node tooling/provision-operator-files.ts /absolute/new/private/directory`。独立随机机密文件使用0700目录/0600文件与独占写入，不打印值。生成不会自动激活密钥。经现有审计受信任KeyRegistry集成激活公开引用；PostgreSQL CLI要求无查询参数的TCP URI并验证TLS，D1使用原生私有绑定集成。没有公开密钥、重放或重建维护接口。

Node密钥/滥用密钥/初始化/存储挂载须为归属当前用户、无符号链接、权限0400/0600的普通文件。Worker使用Secret绑定，不放vars或公开配置。Workers初始化绑定为 `HYPERBUG_BOOTSTRAP_ENROLLMENT`，Node使用 `HYPERBUG_BOOTSTRAP_FILE`。HMAC凭据/盲索引/滥用/password-pepper用途与AES信封密钥保持分离。可恢复机密使用AES-256-GCM及封装的每记录密钥；记录指明精确密钥版本。缺失/撤销材料或生命周期状态不可用时拒绝使用。

计划轮换保留current/previous/required版本，按预期修订重新封装或迁移，仅移除无引用密钥。备份捕获固定所有必需版本，过期不自动解除。泄露时立即审计撤销，旧库恢复后重新协调当前状态。已演练顺序及恢复限制见[运维](operations.md)。

原生插件拥有应用权限，不是沙箱。集成前审核源码/来源、权限、目标、机密字段及构建时UI/CSP。外部服务使用有作用域签名合约，插件从不决定Core策略。机密设置只写，读取仅暴露是否存在。

## Minimum与部署验收

显式选择 `cloudflare-minimum` / `minimum-v2`，Node拒绝Minimum。密码使用必需版本化pepper、每用户16字节随机盐及PBKDF2-HMAC-SHA256，新记录50,000次/已存最高100,000次。新密码至少12个Unicode码点、最多1,024UTF-8字节并拒绝常见密码。其离线保护弱于Argon2id；数据库与pepper同时泄露后在线控制无法补偿。建议通行密钥。Standard在PBKDF2登录验证后重新哈希；Minimum拒绝Argon2id，降级须有已验证恢复计划。

全部FREE-01–FREE-08降级/补偿及不可削弱的授权、审计、内容、加密、TLS/HSTS和浏览器令牌边界见[矩阵](deployment.md)与 [Free运维](deploy-cloudflare.md)。账号/写入等待审计激活及pepper预检；激活前就绪不可用。公开读取/存活不代表账号/写入就绪。源码策略不是测得的Free CPU适配或发布能力。

发布前在所选生产环境验证证书/主机名、HTTPS/HSTS、真实代理/客户端IP隔离、存储CORS及扫描桥接/资源隔离/更新。Cloudflare混合TLS能力不能证明部署实际协商或端到端后量子认证。不得禁用TLS验证。上传成功不证明扫描/放行；扫描或存储失败保留隔离/计账。[私密漏洞报告](troubleshooting.md)是已验证保密渠道；不承诺生产SLA或支持响应期限。
