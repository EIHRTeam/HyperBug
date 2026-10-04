# 配置首批安全基础能力

[文档首页](../index.md) · [运维指南](operations.md)

> 状态：后端安全与账户流程已在记录范围内完成本地验证。Cloudflare Minimum 是第三种正式配置，并明确披露密码风险。完整 G1/G2 与真实 Free 套餐验收仍未完成，不代表生产就绪。后续模块审计与 Argon2id 性能工作仍暂停。

## 设置环境和浏览器来源

将 `HYPERBUG_ENV` 明确设置为 `local`、`staging` 或 `production`。将 `ALLOWED_ORIGINS` 设置为用逗号分隔的精确 HTTPS 来源列表，例如 `https://issues.example.org`，最多支持 16 个不重复来源。不要包含路径、凭证、通配符域名或结尾斜杠。本地模式还允许 `http://localhost:5173` 等 HTTP 回环来源。

携带未列入名单的 Origin 的请求会收到 `ORIGIN_FORBIDDEN`（403）。不携带 Origin 的请求仍需接受正常的身份与权限检查；省略 Origin 不会授予访问权限。业务 API 不启用跨来源 Cookie。允许的预检结果最多保留 300 秒。当前所有响应都使用 `Cache-Control: no-store`。

`DEBUG` 默认为 `false`。只有明确指定本地环境时才能设置 `DEBUG=true`。API 错误始终只包含安全的错误码、消息和服务端生成的请求 ID，不会返回堆栈或服务商消息。配置对象只能包含策略设置，不要将凭证放入策略值。

## 限制 API 输入

默认请求体上限为 65536 字节，请求期限为 10000 毫秒。JSON 最大深度为 16，最多 4096 个值；每个对象最多 128 个键，每个数组最多 256 项，每个字符串最多 32768 个字符。URL 最长 8192 个字符，查询参数最多 64 个（重复参数也计数），参数名最长 128 个字符，解码后的值最长 2048 个字符。字符限制以 UTF-16 代码单元计数。各端点的校验规则可以施加更小的限制。

经审查后可通过 `MAX_BODY_BYTES`、`REQUEST_TIMEOUT_MS`、`MAX_JSON_DEPTH`、`MAX_JSON_NODES`、`MAX_JSON_OBJECT_KEYS`、`MAX_JSON_ARRAY_ITEMS`、`MAX_JSON_STRING_LENGTH`、`MAX_URL_LENGTH`、`MAX_QUERY_PARAMETERS` 和 `MAX_QUERY_VALUE_LENGTH` 调整部署设置。显式提供无效或越界值会阻止启动，不会自动切换到宽松的默认策略。

## 分别配置数据保留时间

下列值均以秒为单位，用于定义预期的清理截止时间；自动清理和受控审计保留流程尚待实现。这些设置不会延长凭证有效期，也不会授权删除仍被引用的记录。

| 设置 | 默认值 |
| --- | --- |
| `RETENTION_SECURITY_LOG_SECONDS` | 2592000（30 天） |
| `RETENTION_AUDIT_SECONDS` | 31536000（365 天） |
| `RETENTION_ABUSE_SECONDS` | 86400（1 天） |
| `RETENTION_EXPIRED_SESSION_SECONDS` | 86400（1 天） |
| `RETENTION_DELETED_ACCOUNT_SECONDS` | 2592000（30 天） |
| `RETENTION_TEMPORARY_UPLOAD_SECONDS` | 86400（1 天） |
| `RETENTION_EXPORT_SECONDS` | 86400（1 天） |

在将来执行清理流程前，应审查法律保留要求、隐私需求、关联记录以及备份所需的密钥版本。这些默认值不构成法律合规保证。

## 了解敏感管理操作的要求

敏感项目管理需要该项目的管理员角色。实例账号和插件管理需要独立的 `instance-administrator` 角色；创建项目不会授予该角色。首次初始化会授予实例角色，升级时则选择最早创建的活跃 Staff 账号，因此迁移前请核对接收者。最后一个活跃实例管理员不能被停用。

敏感操作需要最近通过验证的通行密钥登录。认证强度与认证时间属于当前提交的会话或令牌；在另一设备登录不会提升旧令牌的权限。认证强度迁移前签发的令牌需要重新通过通行密钥登录。`ADMIN_RECENT_AUTH_SECONDS` 默认为 300（此前硬编码窗口为 900），范围为 1–900。`AUTHORIZATION_TIMEOUT_MS` 默认为 1000，范围为 10–5000；两种运行配置都会使用这些设置，验证错误或超时将拒绝访问。

CAPTCHA 配置是可选的。不设置 `TURNSTILE_SECRET`、`TURNSTILE_SITE_KEY` 和 `TURNSTILE_HOSTNAME` 即可在没有服务商的情况下运行。通过合适的后端绑定同时提供这三项时，Turnstile 会自动选用；只提供一部分会阻止启动。Cloudflare 公开的测试密钥仅可用于本地开发；预发布和生产环境会拒绝使用。密钥仅保存在后端。如需在本地 Workers 开发中启用 Turnstile，请把这三项绑定和两个必需的密钥环写入已忽略的 `apps/api-cloudflare/.dev.vars.local-turnstile` 文件，或通过 shell 导出。文件或任意 Turnstile shell 绑定存在时，普通的 `corepack pnpm dev:cloudflare` 命令会自动选择该配置；两者都不存在时，无需 CAPTCHA 配置即可启动。`GET /api/v1/accounts/register` 会公开所选站点密钥及 `register` 验证动作。`POST` 在限流通过后、密码哈希前执行已配置的验证；未配置服务商时无需验证令牌。验证失败或不可用时会拒绝注册，CAPTCHA 不能替代限流或权限检查。本地 workerd 测试通过签名入口和模拟服务商验证了已配置分支：缺少令牌或服务商不可用时，会在账号写入前拒绝；真实服务商行为仍待验证。

注册端点是第一个使用敏感操作限流门禁的产品端点。它在密码哈希或写入账号前，对规范化账号名称和可信客户端 IP 限流。Node 从原生网络套接字获取 IP，并忽略转发请求头；位于反向代理后的部署仍需单独验证客户端 IP 策略。近似限流先于主计数器执行；通过近似限流后仍必须接受主计数器检查。标准 Workers 配置使用公开入口 Worker，通过服务绑定调用私有 API Worker。两者共享密钥，用于签发和验证短时有效的客户端地址断言；直接发送到 API、没有有效签名的请求会返回 503。本地 workerd 已通过这一组合完成注册和登录；真实部署中的客户端来源仍待验证。注册只创建 User 账号，不会自动登录或授予 Staff 权限。独立的登录、会话读取和退出端点已在本地通过测试；账号找回和完整授权仍未完成。

仅启动健康检查时，`/health/live` 仍可使用。防滥用密钥环和当前 token-HMAC 密钥能够加载，且主计数器、凭证和授权会话表都可查询后，`/health/ready` 才会返回 200；Workers 还需要近似限流绑定。在此之前它返回 503。返回 200 只确认这些只读前提，不表示账号写入、可信 Workers 入口或已部署的计数器已经就绪。

完整的配置范围和实现边界见[工程规范](https://github.com/EIHRTeam/HyperBug/blob/main/docs/SECURITY-FOUNDATION.md)。

## 凭证保护的实现状态

Core 已提供基于 CSPRNG 的不透明凭证、绑定用途的 HMAC 摘要、AES-256-GCM 信封加密和 AES-256-KW 密钥封装。可用的密钥来源为 `HYPERBUG_KEY_RING` Worker Secret 绑定，以及自托管环境中归运行用户所有、权限为 0400 或 0600 的私有 POSIX 文件。密钥不能放入普通运行时配置。

这些机制现已具备 D1 和 PostgreSQL 密钥生命周期注册表，可跟踪当前、历史和已撤销的密钥版本，并阻止删除存储数据或保留备份仍引用的密钥。两个后端入口现已将密钥来源与注册表及共享服务连接。自托管 Node 通过可选的 `HYPERBUG_KEY_FILE` 和完整的 PostgreSQL 连接选择密钥来源；加载注册表不需要独立的防滥用密钥文件，但账号准入和就绪检查仍需要它。只提供密钥文件而没有数据库连接会阻止启动。没有密钥来源时，仍可只启动健康检查，但需要密钥的操作会安全拒绝。注册和登录现已在本地使用标准密码服务及主存储支持的会话；账号找回和部署环境中的服务商验证仍待完成。密钥存在并不代表允许使用；密钥缺失、已撤销或服务商错误都会拒绝操作。不要使用无条件允许的策略，也不要删除保留数据或备份仍依赖的密钥版本。详见[密码学实现边界](https://github.com/EIHRTeam/HyperBug/blob/main/docs/CRYPTOGRAPHY.md)。


备份捕获会在快照开始前固定所需的密钥，并在捕获完成前阻止轮换和移除。备份到期不会自动释放这些密钥：保留期结束后，可信操作人员还必须确认所有副本均已销毁。服务商备份与恢复流程仍待完成；恢复的数据库在投入使用前必须核对当前撤销记录和保留备份清单。这些内部控制不提供公开的密钥管理端点。

## 部署模式状态

验收涵盖三种配置：Node/PostgreSQL 和 Cloudflare Standard 使用 Argon2id；Cloudflare Minimum 使用带 pepper 的 PBKDF2。选择 Minimum 时设置 `HYPERBUG_DEPLOYMENT_TIER=cloudflare-minimum` 和 `HYPERBUG_DEGRADATION_ACK=minimum-v2`。旧模式名称是已弃用别名，旧确认值会被拒绝。Node 不接受 Minimum。改用 `standard` 时移除降级确认值。

Minimum 开放公开密码注册、登录和恢复。新密码至少需要 12 个字符，限制输入大小，并拒绝内置常见密码。新记录使用 50,000 次迭代，存储成本上限为 100,000 次。其抵抗离线猜测的能力低于 Argon2id。应单独保管 pepper，并优先使用通行密钥。数据库和 pepper 同时泄露后，在线限流、持久化渐进锁定及已配置的 CAPTCHA 无法弥补离线猜测风险。

账户、认证和写入路由等待只追加审计的激活流程及 pepper 预检查；存活检查、实例信息和匿名公开 GET 仍可访问。激活待完成或失败时，就绪检查返回不可用。实例文档报告实际能力。标准配置登录验证 PBKDF2 后升级为 Argon2id；Minimum 拒绝 Argon2id，因此降级前需准备通行密钥、恢复码或凭证重置。

G1/G2 要求三种配置全部通过。额外的真实 Free 套餐验收（13.G6）仍未完成，本地成功不代表发布支持。Free 套餐的后台持久性、保留与导出、容量、邮件中继、恢复和批量限制见[配置规范](https://github.com/EIHRTeam/HyperBug/blob/main/docs/FREE-TIER-PROFILE.md)。授权、必需审计的原子性、内容安全、加密、TLS 和浏览器令牌策略始终是强制要求。

## 验证 HTTPS 与传输安全声明

应分别检查前端和 API 的主机名。Cloudflare 可与支持该能力的 TLS 1.3 客户端协商混合 `X25519MLKEM768` 密钥交换。自托管部署需要配置 HTTPS 终止服务；当前 Node 监听器使用本地 HTTP。在声明部署的保护能力前，应检查实际协商的密钥交换组、证书验证、代理边界和 HSTS 设置。仅凭 TLS 密码套件名称无法判断密钥交换算法。

本地 Node 检查已通过混合密钥协商、经典算法回退以及证书和协议拒绝用例，但这些结果不能验证实际 Cloudflare 或自托管部署。混合密钥交换保护机密性，并不代表整个应用链路已实现后量子身份认证。Cloudflare 面向源站的 ML-DSA 支持是独立能力，此处尚未配置或验证。详见[传输验证流程与证据](https://github.com/EIHRTeam/HyperBug/blob/main/docs/TRANSPORT-SECURITY.md)。

生成或重新生成恢复码要求在 `ADMIN_RECENT_AUTH_SECONDS`（默认 300 秒）内完成身份验证。会话验证时间过旧时返回 `REAUTHENTICATION_REQUIRED`（403），现有恢复码仍有效。配置 CAPTCHA 后，通行密钥登录需要提供登录操作的 `captchaToken`。账户、角色及插件管理、初始管理员注册和恢复码替换与审计事件在同一数据库事务中提交；审计写入失败时全部回滚，并返回 `AUDIT_UNAVAILABLE`（503）。

每个请求仍从主数据库读取会话状态。仅在达到续期时间时延长空闲有效期：普通用户每五分钟、员工每三分钟，且不超过现有绝对有效期。退出登录、撤销会话或更改凭据仍在下一个请求生效。
