# 配置首批安全基础能力

[文档首页](../index.md) · [运维指南](operations.md)

> 状态：首批后端安全控制已实现。身份认证、凭证加密、密码哈希、审计访问、分布式限流和出站请求保护尚未全部完成。这不代表系统已具备生产就绪条件。

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

权限契约要求敏感管理操作具备项目管理员权限、经验证的认证可信度和近期认证。`ADMIN_RECENT_AUTH_SECONDS` 默认为 300，不能超过 900；`AUTHORIZATION_TIMEOUT_MS` 默认为 1000，不能超过 5000，验证错误或超时会拒绝访问。账号流程和功能端点仍需在各自的实施阶段接入这一契约。

完整的配置范围和实现边界见[工程规范](https://github.com/EIHRTeam/HyperBug/blob/main/docs/SECURITY-FOUNDATION.md)。
