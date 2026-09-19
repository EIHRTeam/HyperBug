# 技术选型与部署架构报告

## 1. 文档目的

本文档确定项目现阶段的主要技术栈、运行时边界、部署模式、基础设施抽象和依赖策略。

本项目定位为：

> Cloudflare-first，但不 Cloudflare-only。

Cloudflare Workers、D1、R2、Queues 和 Workflows 是官方默认部署方案与一等公民运行环境；同时，项目必须能够脱离 Cloudflare，以：

```text
Node.js
+
PostgreSQL
+
S3-compatible Object Storage
```

构成完整、正式支持的自托管后端。

该要求不是“未来可能支持的移植目标”，而是正式架构约束。

现有架构已经要求公开 API 与具体 Framework 解耦，并明确 Cloudflare-first 但不要求所有组件 Cloudflare-only。

---

# 2. 总体结论

最终基础技术栈确定为：

| 层                       | 技术选择                                                 | 状态   |
| ----------------------- | ---------------------------------------------------- | ---- |
| Development Runtime     | Node.js 24 LTS                                       | 固定   |
| Package Manager         | pnpm 11 latest                                       | 固定   |
| Language                | TypeScript 7 latest                                  | 固定   |
| Monorepo                | pnpm Workspace                                       | 固定   |
| Backend Framework       | Elysia                                               | 固定   |
| Cloud Runtime           | Cloudflare Workers                                   | 一等公民 |
| Self-host Runtime       | Node.js 24 LTS                                       | 一等公民 |
| Frontend                | React 19 latest                                      | 固定   |
| Build Tool              | Vite `latest`                                        | 固定策略 |
| Test Framework          | Vitest `latest`                                      | 固定策略 |
| E2E                     | Playwright latest                                    | 固定   |
| Router                  | TanStack Router latest                               | 固定   |
| Remote State            | TanStack Query latest                                | 固定   |
| Form                    | TanStack Form latest                                 | 固定   |
| UI                      | Tailwind CSS 4 + shadcn/ui + Base UI                 | 固定   |
| Database ORM            | Drizzle ORM                                          | 固定   |
| Cloud Database          | Cloudflare D1                                        | 默认   |
| Self-host Database      | PostgreSQL 18.x                                      | 固定   |
| Cloud Blob              | Cloudflare R2                                        | 默认   |
| Self-host Blob          | S3-compatible Object Storage                         | 一等公民 |
| Cloud Async Queue       | Cloudflare Queues                                    | 默认   |
| Self-host Queue         | Graphile Worker                                      | 首选   |
| Cloud Long-running Jobs | Cloudflare Workflows                                 | 默认   |
| Self-host Workflows     | PostgreSQL state + Graphile Worker                   | 首选   |
| Cloud Coordination      | Durable Objects when justified                       | 按需   |
| Search / Cloud          | SQLite FTS5                                          | 默认   |
| Search / PostgreSQL     | PostgreSQL FTS + GIN                                 | 默认   |
| API                     | Versioned REST + OpenAPI                             | 固定   |
| Auth                    | OAuth 2.1 style Authorization Code + PKCE            | 固定协议 |
| Observability           | Structured logs + OpenTelemetry-compatible telemetry | 固定方向 |

---

# 3. 架构原则

架构采用：

```text
                    Public Contracts
                          │
                    Domain Model
                          │
                  Application Layer
                          │
                     Elysia HTTP
                          │
             ┌────────────┴────────────┐
             │                         │
             ▼                         ▼
      Cloudflare Runtime          Node Runtime
             │                         │
     Cloudflare Adapter             @elysia/node
             │                         │
       Workers / D1              PostgreSQL 18.x
       R2 / Queues               S3-compatible
       Workflows                 Graphile Worker
```

Core 不得直接把：

```text
D1Database
R2Bucket
MessageBatch
ExecutionContext
Cloudflare Workflow instance
pg.Pool
S3Client
```

暴露给 Domain Layer。

Infrastructure-specific 类型必须停留在 Adapter / Infrastructure Layer。

---

# 4. Backend Framework：Elysia

Elysia 保留为统一 Backend Framework。

现有架构已经指定：

```text
TypeScript
+
Elysia
+
Cloudflare Workers
```

同时规定公开 API 不得依赖 Elysia 特有类型。

这一原则继续保留。

Elysia 官方已经提供 Node runtime adapter：

```text
@elysia/node
```

因此同一应用可以正式运行在 Node.js。

Cloudflare Worker adapter 截至 2026 年 9 月仍由 Elysia 官方标记为：

```text
Experimental
```

但已经支持 AOT，并且官方推荐 Cloudflare Worker 使用 AOT。

因此 Elysia 的采用策略确定为：

```text
Elysia is fixed.

Cloudflare Adapter risk
is handled through
compatibility testing,
not by replacing Elysia.
```

---

# 5. Elysia Runtime Boundary

项目不得创建：

```text
one application implementation for Workers
+
another application implementation for Node
```

应共享：

```text
packages/server
```

其内部定义：

```text
routing
middleware
validation
authentication integration
authorization middleware
error mapping
domain invocation
```

运行时入口分别位于：

```text
apps/api-cloudflare
apps/api-node
```

目标结构：

```text
apps/
├── api-cloudflare/
│   └── src/index.ts
│
└── api-node/
    └── src/index.ts

packages/
└── server/
    ├── app.ts
    ├── routes/
    ├── middleware/
    └── context/
```

其中：

```text
api-cloudflare
→ CloudflareAdapter
→ .compile()

api-node
→ @elysia/node
→ .listen()
```

业务代码不得调用：

```text
.listen()
```

或导出 Cloudflare：

```text
fetch(request, env, ctx)
```

作为 Core 架构的一部分。

---

# 6. Cloudflare 一等公民定义

Cloudflare-first 意味着官方首先保证：

```text
Workers
D1
R2
Queues
Workflows
Durable Objects where justified
```

组合的：

```text
documentation
CI
integration tests
deployment templates
performance tests
security tests
upgrade tests
```

完整性。

Cloudflare 部署继续是：

> 默认推荐部署方式。

但产品协议、数据模型、插件协议和业务逻辑不得要求 Cloudflare 才能实现。

---

# 7. 正式部署 Profiles

项目定义三个部署 Profile。

## Profile A — Cloudflare Native

默认且优先支持：

```text
Static Frontend
        │
        ▼
Cloudflare Workers
        │
        ├── D1
        ├── R2
        ├── Queues
        ├── Workflows
        └── Durable Objects when justified
```

这是：

```text
reference deployment
```

也是 CI 和文档覆盖最完整的部署方式。

---

## Profile B — Self-hosted

正式支持：

```text
Static Frontend
        │
        ▼
Node.js 24 LTS
        │
        ├── PostgreSQL 18.x
        ├── S3-compatible Object Storage
        └── Graphile Worker
```

最低正式生产部署不要求：

```text
Redis
RabbitMQ
Kafka
Temporal
Kubernetes
```

PostgreSQL 和 S3-compatible Object Storage 已足以提供主要持久化能力。

---

## Profile C — Workers + PostgreSQL

架构允许：

```text
Cloudflare Workers
       │
    Hyperdrive
       │
PostgreSQL
```

但该 Profile 暂不作为 PostgreSQL 18.x 的一级保证。

截至当前 Cloudflare Hyperdrive 官方“Known supported versions”仍只列到 PostgreSQL 17.x。

因此：

```text
Workers + PostgreSQL 18.x
```

必须在实际兼容测试通过后才能标记为正式受支持组合。

不得仅因为 PostgreSQL wire protocol 相同而宣称官方支持。

Cloudflare 当前推荐 Hyperdrive 使用：

```text
node-postgres / pg
```

作为 JavaScript / TypeScript PostgreSQL Driver。

---

# 8. PostgreSQL 版本策略

Self-hosted Backend 固定使用：

```text
PostgreSQL 18.x
```

而不是：

```text
PostgreSQL >= 18
```

也不自动跟随 PostgreSQL 下一 Major。

当前正式 minor 为：

```text
PostgreSQL 18.6
```

PostgreSQL 官方建议始终使用当前 Major 对应的最新 Minor Release。

因此版本策略定义为：

```text
Supported Major:
18

Supported Minor:
latest available 18.x
```

例如当前：

```text
18.6
```

未来：

```text
18.7
18.8
...
```

应通过正常 CI / release validation 后尽快跟进。

PostgreSQL 19 不因发布 GA 自动成为正式支持版本。

Major 升级必须经过：

```text
ADR
+
migration tests
+
performance tests
+
compatibility review
```

---

# 9. D1 与 PostgreSQL 的定位

Cloudflare：

```text
D1
```

Self-host：

```text
PostgreSQL 18.x
```

二者属于：

> 两个正式 Database Backend。

不是：

```text
PostgreSQL primary
+
SQLite compatibility mode
```

也不是：

```text
D1 primary
+
PostgreSQL best-effort port
```

它们共享业务语义，但允许数据库物理实现不同。

---

# 10. Database Abstraction

共享：

```text
Domain Entity
Repository Contract
Query Semantics
DTO
Search AST
Pagination semantics
Transaction intent
```

分别实现：

```text
D1 Adapter
PostgreSQL Adapter
```

推荐：

```text
packages/database/
├── contracts/
│
├── d1/
│   ├── schema/
│   ├── repositories/
│   ├── migrations/
│   └── search/
│
└── postgres/
    ├── schema/
    ├── repositories/
    ├── migrations/
    └── search/
```

不得追求：

```text
one SQL schema
runs identically everywhere
```

作为架构目标。

---

# 11. Database Feature Policy

允许 D1 使用：

```text
SQLite FTS5
D1 batch
SQLite indexes
SQLite query planner behavior
D1 Sessions
```

允许 PostgreSQL 使用：

```text
tsvector
GIN
partial indexes
expression indexes
RETURNING
native PostgreSQL transactions
PostgreSQL locking
PostgreSQL JSONB where justified
```

不得为了实现“公共 SQL 子集”禁止这些能力。

真正共享的是：

```text
behavior
```

而不是：

```text
SQL syntax
```

---

# 12. ORM：Drizzle

Database Layer 采用：

```text
Drizzle ORM
+
Drizzle Kit
```

原因包括：

```text
D1 / SQLite support
PostgreSQL support
typed query construction
migration support
low abstraction overhead
raw SQL escape hatch
```

Drizzle 同时明确支持 PostgreSQL、SQLite 与 Cloudflare D1。

由于项目允许合理采用 unstable dependency，现阶段允许使用：

```text
Drizzle ORM 1.0 RC
Drizzle Kit matching RC
```

当前 npm `rc` channel 为：

```text
1.0.0-rc.4
```

同时已经存在后续 RC development builds。

采用规则是：

```text
RC allowed
exact resolution required
lockfile required
automated migration tests required
```

禁止生产依赖长期使用：

```json
"drizzle-orm": "rc"
```

作为不可复现的安装语义。

仓库实际安装结果必须由 lockfile 固定。

---

# 13. ORM 使用边界

Drizzle 被定位为：

> typed SQL layer

而不是：

> database portability abstraction.

以下能力可以直接使用原生 SQL：

```text
FTS
EXPLAIN
complex indexes
database-specific pagination
bulk update
database-specific optimization
```

不得为了保持 ORM API 纯粹而导致：

```text
N+1
full table scan
poor FTS
unnecessary round trips
```

性能规范优先。

---

# 14. Blob Storage 总体策略

Blob Storage 属于正式 Infrastructure Port。

统一逻辑接口：

```text
BlobStore
```

提供至少：

```text
put
get
head/stat
delete
copy where supported
multipart lifecycle
direct upload authorization
temporary download authorization
```

业务层不得直接依赖：

```text
R2Bucket
S3Client
```

---

# 15. Cloudflare Blob：R2

Cloudflare 默认：

```text
R2
```

Backend 内部操作优先使用：

```text
Workers R2 Binding
```

因为这是 Worker 内访问 R2 的原生接口。

但 Direct Browser Upload 可以使用 R2 的：

```text
S3-compatible Presigned URL
```

Cloudflare 官方明确支持用 presigned `PUT` URL 让浏览器绕过 Worker 直接上传。

---

# 16. Self-host Blob：S3-compatible

Node / PostgreSQL Self-host Profile 的正式 Blob Backend 是：

```text
S3-compatible Object Storage
```

这是一级架构依赖，而不是 Optional Plugin。

正式部署应能够使用：

```text
AWS S3
Cloudflare R2 S3 API
MinIO
Ceph RGW
other compatible implementations
```

但是否标记为“官方验证兼容”必须通过项目自己的 compatibility test suite。

不能仅凭厂商宣称：

```text
S3 compatible
```

就保证全部功能可用。

---

# 17. S3 API 子集

Core 只依赖项目真正需要的 S3 能力。

初始要求：

```text
PutObject
GetObject
HeadObject
DeleteObject
Multipart Upload
Presigned GET
Presigned PUT
basic metadata
```

不应把：

```text
AWS IAM
AWS-specific replication
AWS Lambda integration
Glacier lifecycle semantics
S3 Select
```

等 AWS 专有功能引入 Core Contract。

---

# 18. S3 Client

Node S3 Adapter 首选：

```text
@aws-sdk/client-s3
```

Direct Upload / Download Authorization 使用：

```text
@aws-sdk/s3-request-presigner
```

AWS SDK for JavaScript v3 是 AWS 当前 JavaScript SDK 主线，并提供独立 S3 client package。

Presigned URL 使用官方：

```text
@s3-request-presigner
```

方案。

---

# 19. Cloudflare 与 S3 Contract 的关系

R2 本身提供 S3-compatible API。

因此：

```text
BlobStore Contract
```

应尽可能以：

```text
portable object-storage semantics
```

设计。

但 Cloudflare Runtime 内部仍可以使用：

```text
R2 Binding
```

获得更自然的平台集成。

即：

```text
same abstraction
≠
same SDK
```

---

# 20. Direct Upload

附件上传统一采用：

```text
Client
  │
  ▼
Create Upload Intent
  │
  ▼
Presigned / temporary upload capability
  │
  ▼
Blob Storage
  │
  ▼
Finalize
```

Cloudflare：

```text
R2 presigned PUT
```

Self-host：

```text
S3-compatible presigned PUT
```

这样两种部署保持基本相同的性能模型。

不得默认：

```text
Browser
→ Backend API
→ Buffer complete file
→ Object Storage
```

作为主要上传路径。

---

# 21. Upload Security

Presigned URL 必须被视为：

```text
Bearer Capability
```

Cloudflare 官方同样明确要求将其视为 bearer token。

Upload Intent 必须绑定：

```text
Principal
Project
Object Key
Expiration
Maximum Size
Declared Content Type
Single upload intent
```

Finalize 时必须重新验证实际对象。

---

# 22. Large Upload

对象存储 Adapter 必须支持：

```text
single PUT
+
multipart upload
```

Cloudflare R2 当前建议小中型文件使用 single PUT，大文件或需要恢复/并行上传时使用 multipart。

项目不应硬编码某个单一阈值为公共 API Contract。

具体 threshold 属于 Storage Adapter Configuration。

---

# 23. Local Filesystem 的定位

可以提供：

```text
FileSystemBlobStore
```

但其定位仅为：

```text
development
tests
single-machine evaluation
migration/recovery utility
```

不作为正式 Self-host Production Profile 的一级 Blob Backend。

正式生产自托管参考架构是：

```text
Node.js
+
PostgreSQL 18.x
+
S3-compatible Object Storage
```

---

# 24. Search

公共 Search API 只暴露：

```text
Structured Search AST
```

现有架构已经要求 Search Backend 与查询协议解耦。

Database-specific compilation：

```text
                 Search AST
                  /      \
                 /        \
                ▼          ▼
              D1        PostgreSQL
               │            │
             FTS5       tsvector
                           +
                          GIN
```

不得公开：

```text
FTS5 MATCH
```

或：

```text
tsquery
```

作为稳定公共协议。

---

# 25. Async Processing

Cloudflare：

```text
Queues
```

负责：

```text
notifications
webhooks
search updates
plugin events
derived processing
```

这与现有 Architecture 保持一致。

---

# 26. Self-host Queue

Node/PostgreSQL Profile 首选：

```text
Graphile Worker
```

原因是它直接建立在：

```text
Node.js
+
PostgreSQL
```

之上，不要求额外 Redis、RabbitMQ 或 Kafka。

Graphile Worker 当前要求 PostgreSQL 12+ 和 Node 22.18+，因此与：

```text
Node 24
PostgreSQL 18.x
```

完全兼容。

---

# 27. Queue Contract

Core 定义：

```text
TaskQueue
```

而不是：

```text
CloudflareQueue
GraphileWorker
```

概念。

至少提供：

```text
enqueue
schedule
retry metadata
idempotency identity
```

两种实现：

```text
CloudflareTaskQueue
GraphileTaskQueue
```

---

# 28. Queue Delivery Semantics

系统统一按照：

```text
at-least-once
```

设计。

任何 Consumer MUST：

```text
idempotent
```

重要 Job 必须具有：

```text
event id
job id
delivery id
```

Graphile Worker 的 `job_key` 可以用于特定任务的唯一调度、更新和替换语义。

但业务级 idempotency 不应仅依赖 Queue implementation。

---

# 29. Long-running Workflow

Cloudflare：

```text
Cloudflare Workflows
```

用于：

```text
import
export
bulk operations
long-running integrations
```

与现有架构一致。

Self-host 第一阶段不引入 Temporal。

采用：

```text
PostgreSQL workflow state
+
Graphile Worker
```

实现 durable step execution。

---

# 30. Self-host Workflow Model

例如：

```text
export_jobs

id
state
cursor
progress
attempt
result_object_key
created_at
updated_at
```

Worker：

```text
load job state
↓
execute bounded step
↓
checkpoint
↓
enqueue next step
```

这样：

```text
Node
PostgreSQL
S3
Graphile Worker
```

已经可以完成完整长任务体系。

未来如复杂度达到要求，可以增加：

```text
TemporalWorkflowAdapter
```

但不作为 Core 基础部署依赖。

---

# 31. Frontend

前端维持既有架构：

```text
React 19
TypeScript 7
Vite
TanStack Router
TanStack Query
TanStack Form
Tailwind CSS
shadcn/ui
Base UI
```

现有文档已经规定该组合，并要求 Static SPA、Cloudflare Pages 一等公民但托管中立。

不引入 SSR runtime。

---

# 32. Vite Version Policy

Vite 不固定 Major：

```text
Vite latest stable
```

作为正式工程策略。

当前 npm `latest` 为：

```text
Vite 8.3.0
```

文档不再写：

```text
Vite 8
```

作为长期硬编码要求。

正确表述：

> 项目持续跟踪 Vite npm `latest` stable release。

Actual build version 仍由：

```text
pnpm-lock.yaml
```

保证可复现。

---

# 33. Vitest Version Policy

Vitest 同样采用：

```text
Vitest latest stable
```

当前 npm `latest`：

```text
Vitest 5.0.1
```

版本升级由 Dependency Update PR 驱动。

不得使用：

```text
floating install during CI
```

CI 始终：

```text
pnpm install --frozen-lockfile
```

---

# 34. TypeScript

使用：

```text
TypeScript 7 latest
```

TypeScript minor / patch 原则上持续跟进。

TypeScript Major 升级要求：

```text
compatibility review
```

但不需要长期停留在旧 Major 以追求保守兼容。

---

# 35. Dependency Philosophy

项目采用：

> Modern-first, latest-oriented, reproducible.

并明确允许：

```text
alpha
beta
rc
experimental
unstable
```

依赖。

但是否使用 prerelease 取决于风险，而不是版本标签本身。

---

# 36. Unstable Dependency Policy

依赖分为：

| 类型                               | Prerelease policy              |
| -------------------------------- | ------------------------------ |
| Formatter / Linter / Dev tooling | Alpha/Beta 可接受                 |
| Build tooling                    | Beta/RC 可接受                    |
| Test tooling                     | Beta/RC 可接受                    |
| Framework                        | Beta 可接受但需完整 integration test  |
| ORM                              | RC 可接受                         |
| Database Driver                  | 优先 stable                      |
| Authentication                   | 优先 stable                      |
| Sanitizer                        | stable only by default         |
| Cryptography                     | stable / audited only          |
| Persistent storage format        | 极保守                            |
| Migration tooling                | RC 可接受，但 migration output 必须审查 |

因此：

```text
unstable allowed
```

不意味着：

```text
unstable preferred
```

---

# 37. Elysia Pre-release Policy

生产基线默认使用：

```text
Elysia latest stable
```

同时 CI SHOULD 测试：

```text
Elysia next
```

允许：

```text
allowed-to-fail
```

compatibility lane。

若 Elysia next 提供对 Cloudflare Worker、AOT、TypeScript 或 OpenAPI 的关键改进，可在 GA 前采用，但必须经过：

```text
validation regression
routing regression
OpenAPI regression
Workers integration
Node integration
performance benchmark
```

---

# 38. API Contract

公开 API 固定为：

```text
/api/v1/*
```

并具有：

```text
OpenAPI
Stable DTO
Pagination conventions
Error model
Authentication model
```

现有 Architecture 已明确这些属于正式产品接口。

---

# 39. Contract 不使用 Server Type Export

不得将：

```text
typeof app
Eden Treaty
server implementation type
```

作为公共 API 的唯一正式协议。

可以在内部工具中使用这些能力提高 DX，但：

```text
OpenAPI
+
packages/contracts
```

仍然是外部 Contract Boundary。

---

# 40. Runtime Schema

公共 DTO / Contract Schema 建议采用独立：

```text
TypeBox
```

或等价 JSON-Schema-oriented schema layer。

不得要求客户端：

```text
install Elysia
```

才能理解公共协议。

---

# 41. Authentication

安全模型继续保持：

```text
Browser SPA
        │
Authorization Code + PKCE
        ▼
Authorization Service
        │
short-lived token
        ▼
Public API
```

现有 SECURITY.md 已明确 Browser、Authorization Service 和 Public API 的边界。

---

# 42. Auth Implementation

Better Auth 可以作为：

```text
Authentication implementation candidate
```

进入正式 PoC。

其当前 OAuth Provider 支持 public client PKCE，并支持 opaque access token。

但：

```text
authorization
roles
project permissions
Staff identity
```

始终属于 Core Domain。

Auth Library 不成为业务权限系统。

---

# 43. Staff SSO

Staff 与 Public User 保持不同 Identity Domain。

现有产品规范要求：

```text
issuer + subject
```

作为 Staff External Identity 的稳定身份键，并由本地系统负责 Authorization。

因此 Internal SSO 继续属于：

```text
Plugin
```

而不是 Core 对某个 Identity Provider 的硬依赖。

---

# 44. Plugin Architecture

保持：

```text
Trusted Native Plugin
Isolated External Plugin
```

现有 Security 明确 Native Plugin 等价于可信应用代码，而 External Plugin 应独立运行并通过 scoped capability 通信。

External Plugin MUST NOT 获得：

```text
arbitrary Core SQL access
```

应通过：

```text
Plugin API
Domain API
Scoped Storage
```

访问数据。

---

# 45. Observability

统一定义：

```text
Telemetry Port
```

至少支持：

```text
structured log
metric
trace
request correlation
```

Cloudflare 实现：

```text
Workers Logs
Workers Traces
OTLP export
```

Node 实现：

```text
structured logger
OpenTelemetry
OTLP exporter
```

业务代码不得依赖某个 SaaS observability provider。

---

# 46. Monorepo

保持：

```text
pnpm Workspace
```

第一阶段不引入：

```text
Nx
Turborepo
Rush
```

作为必要基础设施。

推荐结构：

```text
repo/
│
├── apps/
│   ├── web/
│   ├── api-cloudflare/
│   └── api-node/
│
├── packages/
│   ├── contracts/
│   ├── api-client/
│   ├── domain/
│   ├── application/
│   ├── server/
│   │
│   ├── database/
│   │   ├── contracts/
│   │   ├── d1/
│   │   └── postgres/
│   │
│   ├── blob/
│   │   ├── contracts/
│   │   ├── r2/
│   │   └── s3/
│   │
│   ├── queue/
│   │   ├── contracts/
│   │   ├── cloudflare/
│   │   └── graphile/
│   │
│   ├── workflow/
│   ├── security/
│   ├── search/
│   ├── plugin-api/
│   └── observability/
│
└── tooling/
```

---

# 47. CI Matrix

核心 CI 必须分别验证：

| Target     | Runtime           | Database        | Blob          |
| ---------- | ----------------- | --------------- | ------------- |
| Cloudflare | workerd / Workers | D1              | R2            |
| Self-host  | Node 24           | PostgreSQL 18.x | S3-compatible |
| Frontend   | Browser           | —               | —             |

Self-host integration test SHOULD 使用真实：

```text
PostgreSQL 18
+
S3-compatible server
```

而不是完全 mock。

可以在 CI 中使用：

```text
MinIO
```

或另一经过确认的 lightweight S3-compatible implementation 作为测试服务。

---

# 48. Database CI

数据库测试至少覆盖：

```text
migration from empty
migration upgrade
schema equivalence at domain level
repository contract
cursor pagination
search semantics
transaction behavior
idempotency
concurrency-sensitive operations
```

D1 与 PostgreSQL 不要求生成完全相同 SQL。

要求的是：

```text
same documented product semantics
```

---

# 49. Blob Compatibility Tests

S3 Adapter 必须拥有独立 compatibility test suite。

至少覆盖：

```text
PUT
GET
HEAD
DELETE
presigned PUT
presigned GET
metadata
multipart upload
abort multipart
large object streaming
Content-Type
checksum behavior where used
```

某个 S3-compatible Provider 只有通过该测试后，才可以进入：

```text
Officially tested providers
```

列表。

---

# 50. Performance Boundary

PERFORMANCE.md 中的核心原则继续适用于两个 Runtime：

```text
bounded work
cursor pagination
indexed access
no N+1
direct uploads
idempotent async jobs
timeouts
backpressure
observability
```

不能出现：

```text
Cloudflare version is efficient
Self-host version is compatibility-only
```

的双重标准。

---

# 51. Security Boundary

安全策略同样不得由 Infrastructure Adapter 改变。

例如：

```text
Authorization
Markdown sanitization
Input validation
Audit
Encryption policy
Plugin permission
```

在：

```text
Workers
```

和：

```text
Node
```

中必须具有相同安全语义。

现有产品原则已经规定 Core 定义安全 Policy，而 Plugin 只提供 Mechanism。

---

# 52. 关键风险

当前主要工程风险是：

| 风险                                        | 处理方式                                    |
| ----------------------------------------- | --------------------------------------- |
| Elysia Cloudflare Adapter 仍 Experimental  | 双 Runtime CI + AOT + integration tests  |
| D1 / PostgreSQL dialect 差异                | Repository Contract + 双实现               |
| 两套 migration 可能产生语义漂移                     | Contract tests + migration fixtures     |
| S3-compatible 实现差异                        | Compatibility suite                     |
| Drizzle 1.0 RC                            | exact lock + migration review           |
| Graphile / Queues 行为不同                    | 统一 at-least-once contract               |
| Workflows 无直接 self-host 等价物               | PostgreSQL durable state + bounded jobs |
| Cloudflare Hyperdrive 尚未列 PostgreSQL 18.x | 不将该组合列为一级保证                             |

---

# 53. 当前正式技术决策

当前可以视为已经确定：

```text
Backend Framework
→ Elysia

Cloud Runtime
→ Cloudflare Workers

Self-host Runtime
→ Node.js 24 LTS

Cloud Database
→ D1

Self-host Database
→ PostgreSQL 18.x

Cloud Blob
→ R2

Self-host Blob
→ S3-compatible Object Storage

Cloud Queue
→ Cloudflare Queues

Self-host Queue
→ Graphile Worker

Cloud Workflow
→ Cloudflare Workflows

Self-host Workflow
→ PostgreSQL state + Graphile Worker

ORM
→ Drizzle

Frontend
→ React 19 + TanStack stack

Build
→ Vite latest

Test
→ Vitest latest + Playwright

Language
→ TypeScript 7 latest

Package Manager
→ pnpm 11
```

---

# 54. 下一阶段

完成本报告后，下一阶段不应继续扩大 Framework 选型范围。

应开始定义：

```text
DATA-MODEL.md
```

重点确定：

```text
ID strategy
timestamp representation
Issue schema
Comment schema
Timeline / Event schema
relation model
label / assignee relation
PostgreSQL and D1 schema mapping
cursor structure
index strategy
FTS schema
transaction boundary
outbox/event model
idempotency model
audit schema
migration conventions
```

尤其需要首先解决：

> 如何让 D1 与 PostgreSQL 共享产品数据语义，同时允许两边充分利用各自数据库能力。

这是下一阶段对性能、可移植性和长期演进影响最大的技术决策。

---

# 55. 最终架构结论

项目正式采用：

```text
Cloudflare-first
but portable
```

Cloudflare 部署：

```text
Workers
+
D1
+
R2
+
Queues
+
Workflows
```

自托管部署：

```text
Node.js 24
+
PostgreSQL 18.x
+
S3-compatible Object Storage
+
Graphile Worker
```

两者共享：

```text
Product behavior
Domain model
Application services
Elysia routes
Public REST API
OpenAPI
Plugin protocol
Security policy
Performance policy
```

而允许分别优化：

```text
database schema
SQL
search implementation
blob adapter
queue adapter
workflow adapter
runtime integration
observability adapter
```

最终原则：

> Share product semantics, not infrastructure implementation.

> Cloudflare is the reference platform, not a mandatory runtime.

> PostgreSQL 18.x and S3-compatible storage are first-class self-host infrastructure.

> Modern and pre-release dependencies may be adopted when their engineering benefit justifies the risk.

> Vite and Vitest track latest stable releases rather than being permanently bound to one major version.

> Portability must not be achieved by reducing every backend to the lowest common denominator.
