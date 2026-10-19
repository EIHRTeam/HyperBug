# Security Architecture

## 1. 文档目的

本文档定义项目的安全架构、最低安全基线、密码学要求、身份认证模型、数据保护策略以及插件安全边界。

本规范适用于：

- 官方 Web Frontend；
- Backend API；
- Authentication Service；
- Core Modules；
- Official Plugins；
- Plugin API；
- External Integrations；
- CI/CD 与 Release Pipeline。

本规范中的要求优先于具体 Framework 或 Library 的默认行为。

安全相关实现不得因为：

- 开发便利；
- 第三方插件要求；
- Legacy compatibility；
- Provider limitation

而静默降低本规范定义的最低安全等级。

---

# 2. 规范性术语

本文使用：

- **MUST**：必须满足；
- **MUST NOT**：明确禁止；
- **SHOULD**：除非存在明确理由，否则应满足；
- **SHOULD NOT**：通常不得采用；
- **MAY**：可选。

偏离 MUST / MUST NOT 要求必须通过 Architecture Decision Record 和 Security Review。

---

# 3. 总体安全原则

项目长期遵循：

> Secure by default.

以及：

> Core defines policy; plugins provide mechanisms.

核心安全策略必须由 Core 强制执行。

插件可以选择：

```text
Identity Provider
CAPTCHA Provider
Notification Provider
KMS Provider
External Integration
```

但插件不得决定是否执行：

```text
Authentication
Authorization
Input Validation
Output Sanitization
Rate Limiting
Audit
Encryption Policy
CORS Policy
Secret Handling
```

---

# 4. 威胁模型

平台是一个公开 Internet 服务。

必须默认存在以下攻击者：

```text
Anonymous Internet attacker

Malicious registered user

Compromised public account

Malicious content submitter

Bot / spam network

Compromised external integration

Malicious or compromised plugin

Supply-chain attacker

Database reader

Object-storage reader

Network observer

Future cryptographically relevant quantum attacker
```

不得假定公众提交的任何内容可信。

---

# 5. Trust Boundaries

主要 Trust Boundary：

```text
Browser
│
├── Static Frontend
│
│ HTTPS
▼
Public API
│
├── Core
├── Plugin Runtime
├── D1
├── R2
├── Queues
└── Workflows

Browser
│
│ top-level authorization flow
▼
Authorization Service
│
└── Identity Providers

Core
│
└── External Services / Plugins
```

Frontend 是不可信执行环境。

浏览器中可读取的数据不得被视为 Secret。

---

# 6. Frontend 与 Backend 分离

架构默认：

```text
Frontend:
https://issues.example.org

API:
https://api.example.net

Authorization:
https://auth.example.net
```

三者可以：

- 不同 Origin；
- 不同 Registrable Domain；
- 不同 Provider。

安全模型不得依赖：

```text
shared-origin
shared-domain cookie
third-party cookie
reverse proxy
same-provider deployment
```

---

# 7. Authentication Architecture

Browser-based Frontend 的默认认证协议：

```text
OAuth 2.0 Authorization Code
+
PKCE
```

不得使用 OAuth Implicit Flow。

不得向静态 SPA 分发 Client Secret。

IETF 当前 Browser-Based Applications BCP 要求 public browser clients 使用 Authorization Code + PKCE，并明确分析了浏览器应用中 Token 暴露风险。

---

# 8. PKCE

PKCE MUST 使用：

```text
S256
```

不得使用：

```text
plain
```

每次 Authorization Request 必须产生新的：

```text
code_verifier
code_challenge
state
```

`code_verifier`：

- 使用 CSPRNG；
- 不得重复；
- 不得持久保存到长期 Storage。

---

# 9. Authorization Code

Authorization Code 必须：

- Single-use；
- Short-lived；
- 与 Client 绑定；
- 与 Redirect URI 绑定；
- 与 PKCE Challenge 绑定。

推荐生命周期：

```text
≤ 60 seconds
```

成功兑换后立即失效。

重复兑换必须失败。

---

# 10. OAuth Redirect URI

Redirect URI 必须使用 Exact Match。

禁止：

```text
https://*.example.com/callback
```

式宽松匹配。

禁止允许任意：

```text
redirect_uri
return_to
next
```

跳转到未经注册的 Origin。

所有跳转目标必须经过明确 Allowlist。

---

# 11. OAuth State

Authorization Request 必须使用高熵 `state`。

Callback 必须验证：

```text
received_state === expected_state
```

验证失败立即终止流程。

使用 OpenID Connect 时同时验证：

```text
nonce
```

RFC 10017 明确要求 browser-based client 对 redirect flow 实施 CSRF 防护，并列出 PKCE、`state` 和 OIDC `nonce` 等机制。

---

# 12. Token Architecture

官方 Browser Client 默认使用：

```text
Opaque Access Token
```

而不是要求 JWT。

推荐格式：

```text
at_<public-id>.<secret>
```

其中：

```text
public-id
```

用于服务器快速定位 Token Record。

真正的 Secret 部分必须至少具有：

```text
256 bits
```

CSPRNG entropy。

---

# 13. 为什么默认使用 Opaque Token

Opaque Token 可以提供：

- Immediate revocation；
- Server-side session control；
- 更简单的权限撤销；
- 更少的 Client-visible claims；
- 无需业务层依赖公钥签名；
- 更自然的 Token rotation。

平台不得为了“无数据库查询”默认把长期权限状态编码进 JWT。

---

# 14. Access Token 生命周期

Browser Access Token 应短生命周期。

默认建议：

```text
10 minutes
```

合理范围：

```text
5–15 minutes
```

具体值可配置，但不得无明确理由设置为数小时或数日。

---

# 15. Browser Token Storage

Browser Access Token MUST：

```text
仅存在于内存
```

不得默认写入：

```text
localStorage
sessionStorage
IndexedDB
Cache Storage
Cookie readable by JavaScript
```

页面刷新后可以通过新的 Authorization Flow 恢复登录状态。

---

# 16. Refresh Token

官方 SPA 默认：

```text
不持有持久 Refresh Token
```

长期登录状态保留在 Authorization Service 自己的一方 Session 中。

页面需要重新获取 Access Token 时：

```text
Frontend
↓
top-level redirect
↓
Authorization Service
↓
已有 Session
↓
Authorization Code
↓
Frontend
```

这样不需要依赖第三方 Cookie。

如果未来向 Browser Client 引入 Refresh Token，必须单独通过 Security ADR。

---

# 17. Authorization Session

Authorization Service 可以使用 Cookie 保存自身 Session。

Cookie 必须至少：

```text
Secure
HttpOnly
Path=/
SameSite=Lax
```

并优先使用：

```text
__Host-
```

Cookie prefix。

不得设置宽泛：

```text
Domain=.example.net
```

除非经过专门安全评估。

---

# 18. Session Rotation

以下行为后必须轮换 Session Identifier：

```text
login
password change
privilege escalation
staff role change
MFA / step-up completion
account recovery
```

Session fixation 必须被视为安全缺陷。

---

# 19. Session Lifetime

Session 应同时具有：

```text
idle timeout
absolute timeout
```

高权限 Staff Session 应短于普通 Public User Session。

敏感管理操作可以要求：

```text
recent authentication
```

或 Step-up Authentication。

---

# 20. API Credential Transmission

业务 API 使用：

```http
Authorization: Bearer <access-token>
```

不得把 Access Token 放在：

```text
URL query
URL fragment
path
Referer-visible location
```

API Client 对业务请求默认：

```text
credentials: "omit"
```

---

# 21. API Token Storage

服务端不得保存 Bearer Token 明文。

推荐：

```text
token =
public_id + random_secret
```

数据库保存：

```text
public_id
HMAC-SHA-256(index-key, random_secret)
```

或安全等级相当的 keyed digest。

验证必须使用 constant-time comparison。

Cloudflare Workers Web Crypto 当前提供 SHA-256、HMAC、AES-GCM 等能力，并提供 timing-safe comparison extension。

---

# 22. Personal Access Tokens

如果未来支持 Personal Access Token：

必须：

- CSPRNG 生成；
- 至少 256-bit Secret；
- Server-side hash/HMAC storage；
- Scoped；
- Expirable；
- Revocable；
- 显示创建时间；
- 显示最后使用时间；
- 只在创建时显示完整值。

推荐格式：

```text
ipt_<id>_<secret>
```

以便 Secret Scanning 和人为识别。

---

# 23. Public User 与 Staff Identity

必须保持：

```text
Public User
≠
Staff
```

Staff 权限不得因为：

```text
email match
email domain
display name
external profile
```

自动授予。

---

# 24. Staff SSO

Staff SSO 应优先使用：

```text
OpenID Connect
```

其次：

```text
OAuth 2.0
SAML
```

External Identity canonical key：

```text
issuer + subject
```

Email 不得作为内部 Staff Identity 的唯一稳定 ID。

---

# 25. OIDC Validation

OIDC Plugin 必须验证：

```text
issuer
audience
signature
exp
iat
nonce
state
```

必要时验证：

```text
azp
auth_time
amr
acr
```

必须拒绝：

```text
alg = none
```

必须显式定义允许的 Signature Algorithm。

JWKS 必须通过可信 HTTPS Endpoint 获取。

---

# 26. SSO Claims

SSO Claim 属于 Authentication 输入。

它不自动等于 Authorization。

例如：

```text
groups = ["maintainers"]
```

可以经过显式 Mapping 转换为：

```text
local role = Maintainer
```

但最终权限决策必须由本地 Authorization Engine 完成。

---

# 27. Authentication Assurance

Core 应能够表示 Authentication Assurance。

例如：

```text
password
passkey
sso
sso+mfa
step-up
```

高风险操作可以要求：

```text
minimum assurance level
```

---

# 28. Password Authentication

如果 Public Account 启用 Password：

密码不得加密保存。

必须使用 Password Hashing。

首选：

```text
Argon2id
```

OWASP 当前首选 Argon2id，并给出至少 19 MiB、2 iterations、parallelism 1 的基础配置建议。

---

# 29. Workers Runtime 与 Argon2id

Cloudflare Workers 当前 `node:crypto` 明确不支持 `argon2` / `argon2Sync`。

因此官方 Worker Build 必须在以下方案中选择经过性能测试的实现：

```text
Audited Argon2id WASM implementation
```

或：

```text
scrypt
```

作为运行时受限环境 fallback。

不得因此退化为：

```text
SHA-256(password)
SHA-512(password)
MD5(password)
```

---

# 30. Password Hash Parameters

参数必须版本化保存：

```text
algorithm
memory cost
time cost
parallelism
salt
version
```

登录成功后，如果发现参数低于当前标准，可以：

```text
verify
↓
rehash
↓
replace
```

逐步升级。

---

# 31. Password Salt

每个 Password Hash 必须使用独立随机 Salt。

Salt 不需要保密。

不得全站共用固定 Salt。

---

# 32. Password Pepper

项目 MAY 使用额外 Pepper 作为 Defense in Depth。

Pepper：

- 不存数据库；
- 存 Secret Provider；
- 支持轮换。

Pepper 不替代强 Password Hash。

---

# 33. Password Reset

Password Reset Token 必须：

- CSPRNG；
- Single-use；
- Short-lived；
- Server-side hashed；
- Account-bound。

推荐生命周期：

```text
15–30 minutes
```

Password Reset 成功后应撤销该账户现有敏感 Session。

---

# 34. Passkeys / WebAuthn

Public User MAY 使用 Passkey。

Staff 在非 SSO 场景 SHOULD 支持 Passkey / WebAuthn。

Staff 高权限操作优先要求：

```text
user verification
```

WebAuthn ceremony 应在 Authorization Service 所属 Origin 完成。

---

# 35. Authorization

所有 Authorization 必须在 Backend 执行。

Frontend 的：

```text
hidden button
disabled control
route guard
```

仅属于 UX，不是安全边界。

---

# 36. Object-level Authorization

所有资源访问必须验证目标对象权限。

例如：

```text
PATCH /issues/:id
```

不得仅检查：

```text
user is logged in
```

而必须检查：

```text
can(principal, "issue:update", issue)
```

必须防止 BOLA / IDOR。

---

# 37. Role Model

Core 可以提供：

```text
Public User

Triage
Maintainer
Administrator
```

但内部权限判断应基于 Permission，而不是散落的 Role 条件。

例如：

```text
issue:triage
issue:assign
issue:close
milestone:manage
project:configure
plugin:manage
```

---

# 38. Least Privilege

所有身份、插件和 Service Token 必须遵循：

> Least Privilege.

不得因为开发方便默认：

```text
admin:*
```

---

# 39. Sensitive Administration

以下操作至少要求 Administrator，并 SHOULD 要求近期重新认证：

```text
plugin installation
plugin configuration
SSO configuration
secret rotation
role management
project deletion
bulk data export
encryption key operation
```

---

# 40. CORS

Production API 使用 Explicit Origin Allowlist。

例如：

```text
https://issues.example.org
```

不得使用：

```http
Access-Control-Allow-Origin: *
```

处理认证后的 Browser API。

不得无条件：

```text
Origin → Access-Control-Allow-Origin
```

反射请求 Origin。

---

# 41. Preview Deployment

Production API 不应默认允许：

```text
*.pages.dev
*.vercel.app
*.netlify.app
```

等全部 Preview Domain。

推荐：

```text
Production Frontend
→ Production API

Preview Frontend
→ Staging API
```

确需访问 Production 时应显式注册具体 Preview Origin。

---

# 42. CORS Credentials

业务 API 不依赖 Cookie，因此默认：

```text
Access-Control-Allow-Credentials
```

不需要开启。

Access Token 通过：

```text
Authorization
```

传递。

---

# 43. Origin Validation

Browser Request 如果包含 `Origin`：

Backend 必须验证其是否属于允许的 Origin。

CLI / Server-to-server 请求通常没有 Origin，不能因此自动拒绝。

---

# 44. CSRF

Bearer-token API 不依赖 Ambient Authority，因此不以传统 Cookie CSRF 作为主要认证模型。

仍使用 Cookie 的：

```text
Authorization Service
Account management
SSO callback/session operations
```

必须实施 CSRF 防护。

至少包括：

```text
SameSite
state / nonce
Origin validation
CSRF token where appropriate
```

---

# 45. Fetch Metadata

Core MAY 利用：

```text
Sec-Fetch-Site
Sec-Fetch-Mode
Sec-Fetch-Dest
```

作为 Browser Request 的 Defense in Depth。

Fetch Metadata 不得替代：

```text
Authentication
Authorization
CSRF token
CORS
```

---

# 46. Frontend Content Security Policy

无插件情况下的目标 CSP 基线：

```text
default-src 'none';

script-src 'self';

style-src 'self';

img-src 'self' https: data: blob:;

font-src 'self';

connect-src 'self'
  https://api.example.net
  https://auth.example.net;

object-src 'none';

base-uri 'none';

frame-ancestors 'none';

form-action 'self'
  https://auth.example.net;

manifest-src 'self';

worker-src 'self' blob:;
```

实际 Domain 通过 Deployment Config 生成。

---

# 47. CSP 禁止项

Core Frontend MUST NOT 要求：

```text
unsafe-eval
```

并 SHOULD 避免：

```text
unsafe-inline
```

不得为了任意第三方插件直接设置：

```text
script-src *
connect-src *
frame-src *
```

---

# 48. CAPTCHA 与 CSP

reCAPTCHA、hCaptcha 等插件可能需要：

```text
script-src
frame-src
connect-src
```

增加 Provider Origin。

Plugin Manifest 应声明所需 CSP 扩展。

Deployment Build 将必要 Origin 合并到 CSP。

不得为了一个 Plugin 关闭整个 CSP。

---

# 49. Security Headers

Static Frontend SHOULD 设置：

```http
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
```

以及严格 CSP。

如果站点禁止被嵌入：

```text
frame-ancestors 'none'
```

是主要 Clickjacking Protection。

---

# 50. HSTS

HTTPS Production Domain SHOULD 使用 HSTS。

启用：

```text
includeSubDomains
preload
```

前必须确认所有相关 Subdomain 均长期支持 HTTPS。

不得机械复制 HSTS Preload 配置。

---

# 51. COOP / COEP

Frontend MAY 使用：

```text
Cross-Origin-Opener-Policy
```

增强窗口隔离。

`Cross-Origin-Embedder-Policy` 不作为默认要求，因为它可能影响 CAPTCHA、External Media 等第三方资源。

使用前必须进行兼容性验证。

---

# 52. No Runtime Remote Code

Core Frontend MUST NOT：

```text
download arbitrary JavaScript
↓
eval
```

也不得：

```text
dynamic import arbitrary plugin URL
```

执行第三方代码。

这包括：

```text
remote plugins
remote configuration scripts
user supplied JavaScript
```

---

# 53. Markdown Security

平台允许：

```text
GitHub Flavored Markdown
+
limited raw HTML
```

但 raw HTML 永远是不可信输入。

GitHub 自身的公开 Markup 流程明确包含 HTML sanitization，并会积极移除 script、inline style、class/id 等可能有风险的内容。

项目参考其安全模型，但维护自己的 Versioned Allowlist。

---

# 54. Markdown Pipeline

强制处理顺序：

```text
Raw Markdown
↓
Markdown Parser
↓
GFM Extensions
↓
Raw HTML Parse
↓
Sanitization
↓
Safe HAST / React Nodes
↓
Render
```

如果采用 `rehype-raw` 一类机制，Sanitizer 必须位于其之后；允许 raw HTML 而不进行最终 HTML-tree sanitization 是明确的 XSS 风险。

---

# 55. Markdown Canonical Data

Database 保存：

```text
raw Markdown
```

而非仅保存预渲染 HTML。

可选缓存：

```text
sanitized rendered representation
```

必须记录：

```text
sanitization policy version
```

以支持未来重新渲染。

---

# 56. Markdown Allowlist

Allowlist 应显式列举允许的：

```text
elements
attributes
URL schemes
```

而不是：

```text
allow everything except blacklist
```

典型允许元素可以包括：

```text
p
br
hr

h1–h6

strong
em
del
s

blockquote

ul
ol
li

pre
code
kbd

table
thead
tbody
tfoot
tr
th
td

a
img

details
summary

sup
sub
abbr
```

具体清单由独立 Markdown Policy Module 管理。

---

# 57. Markdown 明确禁止

必须移除或转义：

```text
script
style
iframe
object
embed
form

event handler attributes
on*

srcdoc

javascript:
vbscript:
file:
```

SVG/MathML 等具有较大攻击面的内容不得因为“浏览器支持”自动加入 Allowlist。

---

# 58. Markdown URL Policy

`href` 至少可以允许：

```text
https:
http:
mailto:
```

是否允许：

```text
tel:
```

由产品需求决定。

图片 URL 默认只允许：

```text
https:
http:
platform-managed attachment URL
```

不得允许用户构造可执行 URL Scheme。

---

# 59. External Markdown Images

外部图片存在：

- IP disclosure；
- Tracking；
- Referrer leakage；
- Content replacement

风险。

官方部署 SHOULD 采用：

```text
privacy-preserving image proxy
```

或者提供：

```text
click to load external image
```

策略。

直接加载外部图片时至少使用合理 Referrer Policy。

---

# 60. HTML Sanitizer Centralization

Sanitization Policy 必须集中于：

```text
packages/security/markdown
```

业务组件不得各自维护不同 Allowlist。

Issue Body、Comment、Profile Content 等必须使用相同安全基础设施。

---

# 61. User Content Rendering

不得把未经 Sanitization 的用户输入传递给：

```text
dangerouslySetInnerHTML
innerHTML
insertAdjacentHTML
```

如果内部必须使用 HTML Sink，只允许使用安全渲染层的最终输出。

---

# 62. Input Validation

所有 API Input 必须在 Server Boundary 验证。

验证至少包括：

```text
type
length
format
enum
cardinality
nesting depth
```

Frontend Validation 仅用于 UX。

---

# 63. Body Size Limits

Backend 必须为不同 Endpoint 设置 Body Limit。

例如：

```text
JSON request
Markdown body
Issue Form
Webhook
Upload metadata
```

不得无限接收 Request Body。

---

# 64. Query Complexity

Search Query AST 必须限制：

```text
maximum depth
maximum predicates
maximum text length
maximum label filters
maximum sort keys
```

防止构造高成本数据库查询。

---

# 65. SQL Security

所有 SQL 查询必须参数化。

Search Query Parser 不得把用户字符串直接拼接进入 SQL。

推荐路径：

```text
User Query
↓
Parser
↓
Validated AST
↓
Query Compiler
↓
Parameterized SQL
```

---

# 66. Database Authorization

数据库查询条件不是 Authorization 的替代品。

例如：

```text
WHERE project_id = ?
```

不能替代：

```text
can(principal, "issue:read", project)
```

对于非公开资源必须在业务层显式检查权限。

---

# 67. Sensitive Data Classification

至少定义以下分类：

### Public

例如：

```text
Public Issue
Public Comment
Public Label
```

不要求应用层字段加密。

### Personal

例如：

```text
Email
Private Profile Data
IP-derived abuse metadata
```

应最小化保存，并根据需求加密。

### Sensitive

例如：

```text
Private integration metadata
SSO claim cache
account recovery metadata
```

需要受控访问，并根据可恢复需求加密。

### Secret / Credential

例如：

```text
OAuth Client Secret
Refresh Token
Webhook Secret
CAPTCHA Secret
KMS Credential
External API Key
```

必须加密或进入 Secret Store。

---

# 68. Encryption at Rest

所有需要可逆保存的 Secret / Sensitive Credential MUST 使用：

```text
AES-256-GCM
```

或经过 Security ADR 批准、安全等级不低于它的现代 AEAD。

Cloudflare Workers Web Crypto 当前原生支持 256-bit AES-GCM。

不得自行实现 AES。

---

# 69. AES-GCM Nonce

AES-GCM 必须为每个 Key 使用唯一 Nonce。

推荐：

```text
96-bit nonce
```

通过 CSPRNG 生成。

在相同 Key 下复用 GCM Nonce 属于严重安全缺陷。

---

# 70. Authenticated Additional Data

AES-GCM 应使用 AAD 将 Ciphertext 与上下文绑定。

例如：

```text
resource_type
resource_id
field
tenant/project
schema_version
```

示例：

```text
oauth-identity:
<identity-id>:
refresh-token:
v1
```

---

# 71. Envelope Encryption

敏感数据采用 Envelope Encryption：

```text
KEK
 │
 │ wrap
 ▼
DEK
 │
 │ AES-256-GCM
 ▼
Sensitive Data
```

DEK 应由 CSPRNG 产生。

---

# 72. Data Encryption Key

推荐每个：

```text
record
credential
small logical group
```

使用独立 DEK。

是否使用每记录还是每逻辑组 DEK，应根据：

```text
security
storage overhead
rotation cost
```

评估。

---

# 73. Key Encryption Key

KEK MUST NOT 存储在：

```text
D1
R2
Git repository
Frontend
runtime config
logs
```

KEK 来源必须是可信 Secret / KMS Provider。

---

# 74. Key Provider

Core 定义抽象：

```text
KeyProvider
```

官方可以支持：

```text
Worker Secret
Cloudflare Secrets Store
External KMS
HashiCorp Vault
```

Cloudflare Workers Secret 是加密 Secret Binding；Secrets Store 则提供账户级集中 Secret 管理与作用域控制。

截至 2026 年 9 月，Cloudflare Secrets Store 仍处于 Open Beta，因此 Core 不得只实现这一种 Key Provider。

---

# 75. DEK Wrapping

优先使用 KMS Provider 原生：

```text
wrap / unwrap
```

能力。

如果本地完成 wrapping，可以使用：

```text
AES-256-KW
```

或经过审查的 AES-256-GCM wrapping scheme。

不得自行设计新的 Key Wrapping Algorithm。

---

# 76. Encrypted Record Format

Encrypted Payload 必须自描述。

示例：

```json
{
  "v": 1,
  "alg": "A256GCM",
  "kid": "data-kek-2026-01",
  "iv": "...",
  "wrappedKey": "...",
  "ciphertext": "..."
}
```

不得依赖“当前系统一定知道用哪个 Key”。

---

# 77. Key Rotation

必须支持：

```text
key versioning
KEK rotation
DEK re-wrapping
lazy migration
```

旧 Key 不得在替换后立即删除，直到所有仍需要的数据完成迁移。

---

# 78. Crypto Agility

所有持久密码学对象必须包含：

```text
algorithm
version
key id
```

这样未来可以安全迁移算法。

不得设计成：

```text
ciphertext BLOB
```

且没有任何算法元数据。

---

# 79. Exact-match Search on Encrypted Fields

例如 Email 需要：

```text
encrypted value
+
lookup index
```

推荐：

```text
email_ciphertext =
AES-256-GCM(...)

email_lookup =
HMAC-SHA-256(
  lookup_key,
  normalize(email)
)
```

不得为了可搜索性直接保存第二份明文 Email。

---

# 80. Hashing vs Encryption

如果业务不需要恢复 Secret 明文：

> MUST hash, not encrypt.

例如：

```text
Password
Password Reset Token
API Token
Session Token
Email Verification Token
```

不需要可逆保存。

---

# 81. Cryptographic Randomness

所有：

```text
token
session id
authorization code
nonce
salt
DEK
PKCE verifier
```

必须使用 CSPRNG。

Browser：

```text
crypto.getRandomValues()
```

Worker：

```text
crypto.getRandomValues()
```

不得使用：

```text
Math.random()
timestamp
UUID without security analysis
```

产生 Credential。

---

# 82. Symmetric Cryptography and PQC

AES-256 不属于 ML-KEM 一类 Post-Quantum Public-key Algorithm。

但高强度 Symmetric Cryptography 通常被认为已经具有合适的 Post-Quantum 安全余量；当前 PQ migration 重点主要在 Key Agreement 和 Digital Signatures。Cloudflare 的 PQC 文档也明确区分了 Symmetric Cipher、Key Agreement 和 Signature 三部分。

因此本项目：

```text
Data encryption
→ AES-256-GCM

MAC
→ HMAC with ≥256-bit key

Public-key transition
→ PQ / hybrid algorithms
```

---

# 83. Post-Quantum Standards

项目 PQC Roadmap 应优先基于 NIST 标准：

```text
FIPS 203 → ML-KEM
FIPS 204 → ML-DSA
FIPS 205 → SLH-DSA
```

NIST 已于 2024 年正式发布上述三个标准。

不得采用未经过充分标准化和审查的自定义“量子安全算法”。

---

# 84. PQ Key Agreement

网络连接支持时优先使用 Hybrid：

```text
X25519MLKEM768
```

而不是完全删除 Classical Component。

Hybrid 可以同时保留经典密码安全性和 PQ Protection。

---

# 85. Cloudflare PQ Transport

Cloudflare 当前 Visitor → Cloudflare TLS 1.3 已支持：

```text
X25519MLKEM768
```

包括：

- Workers；
- `workers.dev`；
- Pages；
- R2 Public Buckets

等 Cloudflare HTTPS 产品。

因此 Cloudflare Pages / Workers 官方部署 SHOULD 保持 TLS 1.3 和 PQ Hybrid Key Agreement 可用。

---

# 86. PQ Signature 状态

不得宣称：

```text
Cloudflare hosted application
=
fully post-quantum authenticated end-to-end
```

截至 2026 年 9 月，Visitor → Cloudflare 的 PQ Key Agreement 已支持，但该链路的 PQ Signature 仍处于计划阶段。

安全文档必须准确区分：

```text
post-quantum confidentiality
post-quantum authentication
```

---

# 87. Application-level PQC

当前 Cloudflare Workers Web Crypto 支持列表尚未提供 ML-KEM / ML-DSA 原生 Web Crypto API。

因此 Core MUST NOT 为了“提前支持 PQC”而自行实现或引入未经充分审计的纯 JS 密码原语。

原则：

```text
Use platform cryptography
when mature support exists.
```

---

# 88. Node 24 与 PQC

项目开发 Toolchain 使用 Node.js 24。

当前 Node.js 24.5+ 已提供 ML-KEM / ML-DSA 相关能力，但这不能被假定为 Cloudflare Workers Runtime 同样支持。

Build-time capability 与 Production Runtime capability 必须分开评估。

---

# 89. HMAC

需要共享密钥认证时：

```text
HMAC-SHA-256
```

是默认选择。

Key 至少：

```text
256 bits
```

适用于：

```text
Webhook signature
Blind index
Token digest
Internal request authentication
```

---

# 90. Webhook Signature

Outbound Webhook 请求必须至少包含：

```text
delivery id
timestamp
signature
```

签名示例：

```text
HMAC-SHA-256(
  secret,
  timestamp || "." || raw_body
)
```

Receiver 应拒绝：

```text
invalid signature
expired timestamp
replayed delivery id
```

---

# 91. Constant-time Verification

Signature、MAC 和 Secret Digest comparison 必须使用 timing-safe comparison。

不得使用普通字符串：

```text
a === b
```

比较秘密 MAC。

---

# 92. CAPTCHA

CAPTCHA 是 Plugin Mechanism。

Core Anti-abuse 不依赖任何单一 Provider。

可以存在：

```text
plugin-recaptcha
plugin-hcaptcha
plugin-turnstile
```

---

# 93. CAPTCHA Server Verification

Client 返回的：

```text
captcha token
score
success
```

不能直接信任。

Core / Plugin Backend 必须向 Provider Verify Endpoint 验证。

支持时还应验证：

```text
hostname
action
timestamp
score
```

---

# 94. CAPTCHA Secrets

CAPTCHA Secret Key：

```text
Backend only
```

不得：

```text
embed in frontend
runtime config
public plugin manifest
```

Site Key 等 Provider 明确设计为公开的数据可以进入 Frontend Config。

---

# 95. CAPTCHA 不替代 Rate Limit

即使 CAPTCHA 验证成功：

仍必须执行：

```text
rate limiting
account controls
content validation
abuse heuristics
```

CAPTCHA 是额外信号，不是信任证明。

---

# 96. Rate Limiting

Core 至少对以下 Endpoint 分类限流：

```text
login
password reset
registration
issue creation
comment creation
reaction
search
attachment upload
API token creation
webhook configuration
```

---

# 97. Rate-limit Dimensions

根据 Endpoint 可以组合：

```text
IP
account
principal
project
token
route
```

不得只依赖一个全站 IP Limit。

---

# 98. Privacy-preserving Abuse Metadata

如果业务无需长期保留完整 IP：

SHOULD 使用：

```text
truncation
short retention
rotating keyed hash
```

等方式减少长期隐私数据保存。

Anti-abuse 数据保留期限应独立配置。

---

# 99. Upload Authorization

Attachment Upload 必须经过授权。

推荐流程：

```text
Frontend
↓
Create Upload Intent
↓
API authorization + limits
↓
short-lived upload capability
↓
R2
↓
Finalize
↓
API verification
```

---

# 100. Attachment Object Key

不得直接将用户文件名作为 R2 Key。

使用：

```text
UUID/random object id
```

用户原始 Filename 仅保存为 Metadata。

---

# 101. Attachment Validation

至少检查：

```text
declared MIME
actual magic bytes where practical
file size
extension
project quota
user quota
```

不得只相信：

```http
Content-Type
```

---

# 102. Dangerous Attachment Types

例如：

```text
HTML
SVG
XML
script
executable
```

不得在主 Frontend Origin 直接 Inline Render。

默认应：

```http
Content-Disposition: attachment
X-Content-Type-Options: nosniff
```

---

# 103. Media Origin Isolation

推荐：

```text
Frontend:
issues.example.org

User Media:
media.example.net
```

User-controlled file 不与 Authentication / Frontend Origin 共享安全上下文。

Media Origin 不应持有 Authentication Cookie。

---

# 104. SVG

User-uploaded SVG 默认：

```text
download-only
```

如果未来提供 Inline SVG：

必须通过专门 SVG Sanitizer，并从独立 Media Origin 提供。

普通 HTML Sanitizer 不自动被认为足以安全处理 SVG。

---

# 105. Malware Scanning

Malware Scanning 可以通过 Plugin 实现。

Core 应提供：

```text
upload quarantine
scan status
release/reject hook
```

等 Extension Point。

未安装 Malware Scanner 时不得宣传附件已扫描。

---

# 106. SSRF

任何 Server-side Fetch 用户或管理员提供的 URL 都可能产生 SSRF。

包括：

```text
Webhook
Import
External image proxy
Plugin URL
OIDC discovery
```

所有通用 Outbound Fetch 应通过集中安全 Wrapper。

---

# 107. Outbound URL Policy

默认仅允许：

```text
https:
```

特殊场景可以明确允许：

```text
http:
```

但生产 Secret-bearing Request SHOULD NOT 使用明文 HTTP。

禁止：

```text
file:
ftp:
data:
javascript:
```

等非预期 Scheme。

---

# 108. Outbound Redirects

跟随 Redirect 时必须重新验证目标 URL。

不得验证第一个 URL 后无限跟随到任意目标。

设置合理：

```text
maximum redirect count
```

---

# 109. Webhook SSRF

Webhook Endpoint 由 Staff 配置仍不代表可信。

应限制：

```text
scheme
port where appropriate
redirect
destination class
```

并防止访问 Provider Metadata / Local infrastructure 等敏感 Endpoint。

---

# 110. Secrets

Secrets 不得出现在：

```text
source control
frontend bundle
runtime config
logs
analytics
error messages
URL
```

官方 Cloudflare 部署使用：

```text
Worker Secrets
```

或：

```text
Secrets Store
```

保存部署 Secret。

---

# 111. Logging

默认日志不得记录：

```text
Authorization
Cookie
password
access token
refresh token
authorization code
captcha token
client secret
webhook secret
private key
```

Request Body 默认不得完整记录。

---

# 112. Error Response

Production API 不得向 Client 暴露：

```text
stack trace
SQL
internal file path
environment variables
secret
raw provider response
```

返回：

```text
stable error code
safe user message
request id
```

---

# 113. Request ID

每个 Request SHOULD 具有唯一 Request ID。

Request ID 用于：

- Observability；
- Audit correlation；
- Incident response。

Request ID 本身不得包含敏感信息。

---

# 114. Audit Log

至少记录以下 Staff / Security 操作：

```text
login
failed privileged login
role change
permission change
issue moderation
account suspension
plugin enable/disable
plugin configuration
SSO configuration
secret/key rotation
API token creation/revocation
bulk export
project destructive operation
```

---

# 115. Audit Entry

Audit Entry 至少包含：

```text
timestamp
actor principal
action
target
request id
result
safe metadata
```

不得将 Secret 放入 Audit Metadata。

---

# 116. Audit Mutability

应用层不得提供：

```text
edit audit entry
delete individual audit entry
```

常规功能。

法律或隐私要求产生的清理应采用独立受控流程，并产生新的 Audit Event。

---

# 117. Plugin Trust Tiers

插件至少分为：

```text
Trusted Native Plugin

Isolated External Plugin
```

---

# 118. Trusted Native Plugin

Native Plugin 与 Core 一起：

```text
build
bundle
execute
```

因此其安全权限实际上等价于应用代码。

Manifest 声明的 Permission 不是强沙箱。

文档必须明确：

> Installing a Native Plugin means trusting its code.

---

# 119. External Plugin

需要强隔离的第三方 Plugin 应运行于：

```text
separate Worker
separate service
external runtime
```

并通过：

```text
scoped token
signed webhook
service binding
```

进行通信。

---

# 120. Frontend Plugins

Frontend Native Plugin 必须在 Build Time 集成。

不得通过远程：

```text
<script src=...>
dynamic import(...)
eval(...)
```

形成任意运行时代码生态。

---

# 121. Plugin Secrets

Plugin Secret 必须通过：

```text
Secret Provider
```

获得。

Plugin Config API 必须明确区分：

```text
public setting
secret setting
```

Secret Setting 永不通过普通 Read API 返回明文。

---

# 122. Plugin Database Access

第三方 Plugin SHOULD NOT 直接获得 Core Database 的任意 SQL 访问。

优先通过：

```text
Plugin API
Domain API
Scoped Storage
```

操作数据。

Native Official Plugin 如确需 Migration，必须使用命名空间和审查流程。

---

# 123. Plugin CSP Extension

Frontend Plugin 如果需要扩展 CSP：

Manifest 必须明确声明：

```text
script origins
frame origins
connect origins
image origins
```

Core Build Process 负责审查和合并。

Plugin 不得自行覆盖整份 CSP。

---

# 124. Dependency Security

新增 Dependency 必须评估：

```text
maintainer activity
security history
transitive dependency count
runtime compatibility
bundle impact
install scripts
native/WASM code
```

安全敏感功能优先使用标准 Runtime Crypto，而不是普通 JavaScript Crypto Package。

---

# 125. Lifecycle Scripts

CI / Production Build SHOULD 限制不必要的 package lifecycle script。

需要执行：

```text
postinstall
preinstall
install
```

的 Dependency 应进入显式审核范围。

---

# 126. Lockfile

必须提交：

```text
pnpm-lock.yaml
```

CI 使用 Frozen Lockfile。

Release Build 不得隐式解析新的 Dependency Version。

---

# 127. Supply-chain Review

项目 SHOULD 使用：

```text
dependency vulnerability scanning
secret scanning
license scanning
automated dependency update
```

但自动 Update 不得绕过 Test 和 Review。

---

# 128. Release Integrity

Release Workflow 应尽可能提供：

```text
provenance
artifact hash
reproducible metadata
signed release metadata
```

数字签名算法未来应具备 PQ migration 路径。

---

# 129. Configuration Security

Production Security Config：

```text
allowed origins
token lifetime
SSO issuer
upload limits
CSP extensions
rate limits
```

必须经过 Schema Validation。

无效安全配置 SHOULD：

```text
fail closed
```

而不是回退到宽松默认值。

---

# 130. Production Defaults

Production 默认不得：

```text
enable debug
return stack traces
allow all origins
disable authorization
disable sanitizer
disable rate limits
accept insecure redirect URLs
```

---

# 131. Development Mode

开发便利功能必须通过显式：

```text
development environment
```

启用。

不得仅根据：

```text
hostname === localhost
```

隐式绕过关键认证逻辑。

---

# 132. Cache Security

包含以下内容的响应必须：

```http
Cache-Control: no-store
```

或等价安全策略：

```text
token
authorization code
private account data
staff administration
secret configuration
```

---

# 133. Public API Caching

Public Issue 数据可以进行 CDN Cache，但必须明确区分：

```text
anonymous public representation
authenticated representation
```

不得让用户特定响应被公共 Cache 复用。

---

# 134. Cache Keys

如果 Response 受到：

```text
Authorization
Origin
Locale
```

影响，Cache Policy 必须明确包含相关维度或禁用 Shared Cache。

---

# 135. Clickjacking

Frontend 默认：

```text
frame-ancestors 'none'
```

如果未来允许 Embed：

必须通过明确 Feature / Plugin 放宽，并限定 Embed Origin。

---

# 136. Open Redirect

所有：

```text
returnTo
redirect
next
callback
```

参数必须使用：

- Relative-path Allowlist；或
- Exact Origin Allowlist。

不得直接：

```text
302 Location: user_input
```

---

# 137. Account Enumeration

Login、Password Reset 等 Endpoint SHOULD 避免不必要地暴露：

```text
this email exists
this email does not exist
```

同时兼顾实际 UX 与 Abuse Detection。

---

# 138. Email Verification

Verification Token：

- 高熵；
- Single-use；
- Hashed at rest；
- Expiring。

Email 修改应重新验证。

Staff Identity 不通过 Public Email Verification 获得 Staff 权限。

---

# 139. Notification Security

Notification 内容必须安全编码。

Email HTML 不得直接插入未经处理的 Markdown HTML。

Notification Link 必须使用可信 Platform Origin。

---

# 140. Mention Abuse

平台应限制：

```text
mentions per issue
mentions per comment
notification fan-out
```

防止用公开 Issue 作为通知轰炸工具。

---

# 141. Search Security

搜索结果只能返回调用者有权限访问的数据。

Search Index 不得绕过主数据权限。

如果未来引入外部 Search Backend：

必须设计对应的 Access Control。

---

# 142. Export Security

Data Export 必须进行权限检查。

包含敏感数据的 Export：

- 使用加密对象；
- 使用短生命周期 Download Authorization；
- 设置自动删除 TTL；
- 产生 Audit Event。

---

# 143. Import Security

Import File 是不可信输入。

必须限制：

```text
size
record count
nesting
compression ratio
archive paths
format
```

必须防范：

```text
zip bomb
path traversal
parser DoS
```

---

# 144. Queues

Queue Message 不得被假定为可信，仅因为它来自内部 Queue。

Consumer 必须验证：

```text
message version
type
required fields
```

敏感 Credential 不应无必要写入 Queue Message。

---

# 145. Workflows

Workflow State 不得保存明文 Secret。

需要 Secret 时应在执行 Step 时从 Secret Provider 获取。

---

# 146. Data Minimization

安全数据只保存实现目的所需的最小集合。

例如：

```text
IP
SSO claims
device information
login metadata
```

必须有明确目的和 Retention Policy。

---

# 147. Data Retention

至少应能够独立配置：

```text
security log retention
audit retention
abuse metadata retention
expired session retention
deleted account retention
temporary upload retention
export retention
```

---

# 148. Secret Rotation

所有长期 Secret SHOULD 支持轮换。

例如：

```text
webhook signing keys
token HMAC key
email blind-index key
encryption KEK
OAuth client secret
CAPTCHA secret
```

设计不得要求全站停机才能轮换。

---

# 149. Incident Key Rotation

系统必须支持：

```text
current key
previous key
```

短期并存，完成无中断 Rotation。

如果 Key 被确认泄漏，则应支持紧急撤销。

---

# 150. Crypto Implementation Rule

项目不得自己实现：

```text
AES
Argon2 primitive
ML-KEM primitive
ML-DSA primitive
HMAC primitive
SHA primitive
```

应使用：

```text
Web Crypto
Node crypto where runtime supports it
audited mature implementation
KMS/HSM
```

---

# 151. Security Regression Tests

必须有自动测试覆盖：

```text
authorization bypass
CORS
OAuth state
PKCE
open redirect
Markdown XSS
unsafe URL scheme
token expiration
token revocation
webhook replay
upload type handling
rate limit
plugin permission boundary
```

---

# 152. Markdown Security Corpus

项目 SHOULD 维护专门恶意 Markdown Fixture：

```text
script
event attributes
javascript URLs
SVG
MathML
malformed HTML
nested tags
encoded URLs
DOM clobbering patterns
```

Sanitizer 更新必须运行整个 Corpus。

---

# 153. Fuzzing

以下 Parser / Compiler SHOULD 进行 Fuzz Testing：

```text
search query parser
Markdown pipeline
Issue Form schema
import parser
plugin manifest
```

---

# 154. Security-sensitive Code Review

以下变更需要额外 Security Review：

```text
authentication
authorization
crypto
password storage
token handling
HTML sanitization
CSP
CORS
upload
plugin runtime
outbound fetch
SSO
CAPTCHA
KMS
```

---

# 155. Security ADR

以下变化必须建立 ADR：

```text
new authentication flow
persistent browser credential
new cipher
new password hashing algorithm
new key provider
new runtime plugin execution model
weaker CSP
new raw HTML capability
new cross-origin trust
new public-key signature algorithm
```

---

# 156. Cloudflare-specific Security

Cloudflare 是 Backend 一等公民，因此官方部署应利用：

```text
Workers secrets
TLS 1.3
PQC hybrid key agreement
DDoS protection
platform rate limiting where appropriate
```

但安全架构不得假设：

```text
Cloudflare will automatically prevent all application attacks
```

Application-layer Authorization、Sanitization 和 Validation 始终由 Core 负责。

---

# 157. Security Provider Independence

这些能力可以 Cloudflare-first：

```text
Secrets
KMS integration
Rate limiting
Object storage
```

但应通过合理抽象避免 Core 逻辑只能在单一 Provider 上工作。

Frontend 尤其不得依赖 Cloudflare-specific Runtime。

---

# 158. Fail-closed Principle

以下安全组件发生异常时默认 Fail Closed：

```text
authorization
token verification
SSO signature validation
encryption key retrieval
CAPTCHA when policy requires it
plugin permission validation
```

不得把：

```text
exception
timeout
provider failure
```

解释为验证通过。

---

# 159. Availability Exception

Anti-abuse Provider 可以根据明确 Policy 支持：

```text
fail closed
risk-based fallback
```

例如 CAPTCHA Provider Outage。

该策略必须：

- 明确配置；
- 可审计；
- 不影响核心 Authorization。

---

# 160. 安全最低基线总结

项目的默认安全模型可以归纳为：

```text
Static cross-site SPA
        │
        │ Authorization Code + PKCE
        ▼
Authorization Service
        │
        │ first-party HttpOnly session
        ▼
Short-lived opaque access token
        │
        │ Authorization: Bearer
        ▼
Public API
        │
        ├── Authentication
        ├── Authorization
        ├── Validation
        ├── Rate Limiting
        ├── Audit
        └── Encryption Boundary
```

数据保护：

```text
Passwords
→ Argon2id / approved memory-hard fallback

Non-recoverable tokens
→ keyed hash / digest

Recoverable secrets
→ AES-256-GCM

DEK protection
→ Envelope Encryption

Key establishment
→ PQ hybrid where platform supports it

PQC roadmap
→ ML-KEM / ML-DSA / SLH-DSA
```

Content：

```text
GFM
+
limited raw HTML
+
strict allowlist sanitizer
+
CSP
```

Plugin：

```text
Native Plugin
→ trusted code

External Plugin
→ isolated + scoped capability
```

---

# 161. 非目标

本项目不声称：

```text
formally verified security
complete quantum-proof authentication today
malware-free uploads without scanner plugin
Native Plugin sandboxing
zero-trust solely because Cloudflare is used
```

任何安全声明必须准确反映实际实现和当前平台能力。

---

# 162. 最终安全原则

长期安全设计应坚持以下底线：

> Browser is not a secret store.

> Authentication is not authorization.

> CORS is not authentication.

> CAPTCHA is not trust.

> Encryption is not password hashing.

> Native plugins are trusted code, not sandboxed code.

> Public user content is always untrusted.

> Sensitive secrets are encrypted; non-recoverable credentials are hashed.

> Crypto primitives are provided by mature platforms and libraries, never invented locally.

> Post-quantum security is treated as a migration strategy with crypto agility, not as a marketing label.

> Security policy belongs to Core and cannot be disabled by ordinary plugins.