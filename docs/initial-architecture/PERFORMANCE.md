# Performance Architecture

## 1. 文档目的

本文档定义项目的性能架构、最低性能基线、数据库访问策略、缓存策略、异步处理模型、前端性能要求以及性能可观测性要求。

本规范适用于：

* Official Web Frontend；
* Backend API；
* Database Access Layer；
* Search；
* Attachment；
* Queues；
* Workflows；
* Plugin Runtime；
* Official Plugins；
* External Integrations；
* CI/CD Performance Regression Testing。

本规范与：

```text
PRODUCT.md
ARCHITECTURE.md
SECURITY.md
```

共同构成项目核心工程基线。

安全性、正确性和数据一致性优先于性能优化。

不得为了：

```text
lower latency
higher throughput
lower infrastructure cost
higher cache hit rate
reduced database access
```

而削弱：

```text
Authentication
Authorization
Input Validation
Output Sanitization
Audit
Encryption
Rate Limiting
Data Integrity
```

---

# 2. 规范性术语

本文使用：

* **MUST**：必须满足；
* **MUST NOT**：明确禁止；
* **SHOULD**：除非存在明确理由，否则应满足；
* **SHOULD NOT**：通常不得采用；
* **MAY**：可选。

偏离重要 MUST / MUST NOT 性能要求，应通过 Architecture Decision Record 或 Performance Review。

---

# 3. 总体性能原则

项目长期遵循：

> Measure before optimizing.

以及：

> Bound every potentially unbounded operation.

以及：

> Move non-critical work off the synchronous request path.

核心原则包括：

```text
Bounded work
Bounded result sets
Indexed access
Minimal synchronous I/O
Explicit caching
Asynchronous fan-out
Backpressure
Idempotency
Performance observability
```

任何面向公众的输入都不得被允许无界放大：

```text
CPU
Memory
Database rows scanned
Database writes
Network requests
Queue messages
Notifications
Plugin calls
Object storage
```

---

# 4. 性能不是安全边界的替代品

以下技术：

```text
CDN Cache
D1 Index
Rate Limiting
Queues
Browser Cache
Read Replication
```

不得被视为安全边界。

例如：

```text
Cache hit
```

不能代替：

```text
Authorization
```

而：

```text
Rate Limit
```

不能代替：

```text
Input Complexity Limit
```

性能优化必须建立在正确的业务和安全语义之上。

---

# 5. Synchronous Request Path

用户同步请求路径应尽量仅包含完成业务操作所必需的工作。

例如创建 Issue：

```text
Request
↓
Authentication
↓
Authorization
↓
Validation
↓
Core Transaction
↓
Commit
↓
Response
```

以下工作原则上 SHOULD NOT 阻塞同步响应：

```text
Email
Webhook
Search index update
Analytics
Derived metadata
External notification
Plugin side effect
Heavy media processing
Export generation
```

这些工作应优先交由：

```text
Queues
Workflows
```

处理。

---

# 6. API Request Budget

公共 API 必须避免在单个请求中执行无界工作。

每个 Endpoint SHOULD 定义：

```text
maximum input size
maximum collection size
maximum database result size
maximum downstream calls
maximum plugin invocations
maximum fan-out
```

不得存在：

```text
GET all
LIST everything
unbounded export
unbounded relation expansion
```

形式的公开 API。

---

# 7. Database Performance

D1 是主要事务数据库。

数据库访问应遵循：

```text
Indexed access
Bounded result sets
Minimal round trips
Explicit transaction boundary
No accidental full scans
No N+1 query pattern
```

性能敏感查询必须能够通过：

```text
query metrics
EXPLAIN QUERY PLAN
rows read
rows written
latency
```

进行分析。

---

# 8. Index Policy

以下字段类型通常 SHOULD 建立与访问模式匹配的索引：

```text
foreign key / relation key
project id
issue number
author id
assignee relation
state
type
milestone
created at
updated at
event ordering key
notification owner
token public id
```

不得因为：

```text
ORM can generate SQL
```

而忽略索引设计。

新增高频 Query 必须同时评估：

```text
filter
sort
join
pagination
index
```

是否匹配。

---

# 9. Query Review

以下数据库变更 SHOULD 进入 Performance Review：

```text
new list endpoint
new search filter
new sort mode
new relation join
new aggregation
new dashboard query
bulk operation
high-frequency background query
```

关键查询应检查：

```text
query plan
index usage
rows scanned
temporary sort
join cardinality
result size
```

明显出现：

```text
full table scan
```

的热点查询，必须具有明确理由。

---

# 10. N+1 Query

Core API MUST NOT 在高频路径中产生明显的 N+1 查询。

例如禁止：

```text
load 50 issues
↓
query author × 50
↓
query labels × 50
↓
query assignees × 50
```

应优先采用：

```text
JOIN
IN (...)
batched queries
preloaded relation maps
D1 batch
```

等方式。

Issue List 和 Issue Detail 应特别防止 ORM 抽象隐藏 N+1 行为。

---

# 11. Database Round Trips

一次用户请求中的数据库往返次数应保持有界。

复杂聚合页面 SHOULD：

```text
batch compatible queries
```

而不是串行执行大量独立数据库请求。

可以并行的独立查询 MAY 并行执行，但不得因此形成无限并发。

---

# 12. Pagination

大型集合 API MUST 使用有界分页。

适用对象至少包括：

```text
Issues
Comments
Timeline
Audit Events
Notifications
Relations
Search Results
Users
Plugin records
```

默认优先：

```text
Cursor Pagination
/
Keyset Pagination
```

而不是大型：

```text
OFFSET
```

分页。

---

# 13. Cursor Pagination

推荐 API：

```http
GET /api/v1/issues?limit=50&after=<cursor>
```

Cursor 应为：

```text
opaque
versionable
tamper-safe where necessary
```

内部可以表示：

```text
sort key
+
stable unique key
```

例如：

```text
updated_at
+
id
```

排序必须包含稳定 Tie-breaker。

---

# 14. Pagination Limits

每个集合 Endpoint 必须定义：

```text
default page size
maximum page size
```

推荐初始范围：

```text
default:
30–50

maximum:
100
```

具体 Endpoint 可以采用更严格限制。

不得允许 Client 请求任意：

```text
limit = unlimited
```

---

# 15. Large OFFSET

高数据量表 SHOULD NOT 依赖：

```sql
LIMIT ...
OFFSET ...
```

实现深度分页。

浅层管理界面 MAY 使用 Offset Pagination，但必须设置最大可访问窗口。

当数据量或访问频率提升时，应迁移至 Cursor Pagination。

---

# 16. Search Architecture

第一阶段搜索使用：

```text
D1
+
SQLite FTS
```

Search API 与底层搜索实现保持解耦。

所有用户 Query 首先转换为：

```text
Structured Query AST
```

然后生成数据库查询。

---

# 17. Search Complexity Limits

Search Parser 不仅必须保证正确性，还必须限制查询复杂度。

至少应限制：

```text
query string length
AST depth
number of predicates
number of OR branches
number of negations
number of sort fields
result window
FTS expression size
```

不得允许攻击者通过复杂 Query 产生无限：

```text
CPU
SQL size
join complexity
rows scanned
memory
```

---

# 18. Search Result Limits

搜索结果必须分页。

不得提供：

```text
return all search results
```

搜索 Endpoint SHOULD 具有比普通 Issue List 更严格的：

```text
rate limit
complexity limit
execution budget
```

搜索排序模式必须能够映射为有界数据库查询。

---

# 19. Search Index Consistency

如果 Search Index 与主数据存在异步同步：

```text
Primary Data
↓
Queue
↓
Search Index
```

系统必须明确：

```text
consistency model
acceptable delay
retry behavior
rebuild strategy
```

搜索索引不得成为业务数据的唯一 canonical representation。

---

# 20. Public API Caching

公开、匿名、权限无关的数据 MAY 使用 CDN / Shared Cache。

例如：

```text
public project metadata
public issue
public labels
public milestones
anonymous issue list
```

缓存策略必须明确区分：

```text
anonymous representation
authenticated representation
user-specific representation
```

---

# 21. Private Response Caching

以下响应默认：

```http
Cache-Control: no-store
```

或使用等价安全策略：

```text
account data
staff data
token response
authorization response
private project data
secret configuration
permission-sensitive response
```

不得为了提高 cache hit rate 将用户特定响应放入 Shared Cache。

---

# 22. HTTP Validation

公开资源 SHOULD 支持标准 HTTP Cache Validation：

```text
ETag
If-None-Match
Last-Modified where appropriate
```

对于更新频率较低的公开数据，可以使用：

```text
Cache-Control
s-maxage
stale-while-revalidate
```

实际 TTL 必须根据：

```text
freshness requirement
invalidation model
traffic pattern
```

确定。

---

# 23. Cache Invalidation

Cache invalidation 必须与业务事件明确绑定。

例如：

```text
Issue Updated
↓
invalidate / version corresponding cache
```

不得依赖：

```text
eventually someone will wait for TTL
```

处理明显要求即时更新的操作。

如果使用短 TTL 足以满足产品一致性要求，可以采用 TTL-based invalidation。

---

# 24. Cache Key

Cache Key 必须考虑会改变 Representation 的维度，例如：

```text
Authorization state
Origin
Locale
Project
API Version
Content Negotiation
```

不得发生：

```text
user A response
↓
shared cache
↓
user B
```

的数据泄漏。

---

# 25. Cross-Origin Performance

Frontend 与 Backend 可以位于完全不同的 Origin。

因此跨域请求的性能成本属于正式架构考虑。

需要 Preflight 的生产 API SHOULD 设置合理：

```http
Access-Control-Max-Age
```

以减少重复 OPTIONS Request。

---

# 26. CORS Request Stability

官方 API Client SHOULD 尽量保持稳定的：

```text
Methods
Headers
Credential mode
```

避免因为无必要的动态 Header 导致更多 Preflight Cache Miss。

不得为了减少 Preflight：

```text
remove Authorization
weaken CORS
move credential into URL
```

---

# 27. Frontend Network Waterfall

Frontend SHOULD 避免页面启动时产生不必要的串行网络瀑布。

例如避免：

```text
load user
↓
load project
↓
load issue
↓
load labels
↓
load comments
```

当依赖关系允许时，应：

```text
parallel fetch
prefetch
reuse TanStack Query cache
```

但不得无限并发。

---

# 28. Frontend State Reuse

Remote State 由：

```text
TanStack Query
```

管理。

相同资源在合理 Freshness Window 内 SHOULD 复用已有 Query Cache。

不得因为多个组件分别 Mount 而重复产生无必要的相同 API 请求。

---

# 29. Frontend Bundle Policy

Frontend 是 Static SPA。

生产构建必须支持：

```text
code splitting
tree shaking
minification
content hashing
compression-friendly assets
```

非首页核心功能 SHOULD 使用 Route / Feature Level Lazy Loading。

包括但不限于：

```text
Admin
Plugin management
Import
Export
Heavy Markdown tooling
Optional CAPTCHA provider
Analytics
Advanced settings
```

---

# 30. Dependency Bundle Impact

新增 Frontend Dependency 必须考虑：

```text
initial bundle impact
shared chunk impact
tree shaking
duplicate dependency
runtime overhead
loading frequency
```

大型依赖不得因为：

```text
one small utility
```

被无条件加入 Initial Bundle。

---

# 31. Frontend Performance Budget

项目 SHOULD 维护 Frontend Performance Budget。

至少监控：

```text
initial JavaScript
initial CSS
route chunks
asset count
largest dependency
Core Web Vitals
long tasks
```

初期可以主要使用 Regression Budget：

```text
No unexplained significant regression.
```

待形成稳定生产基线后，再定义绝对 Bundle Budget。

---

# 32. Performance Regression

CI SHOULD 比较主要 Route 的：

```text
bundle size
compressed size
chunk count
```

明显增加必须可以被 Review 发现。

性能优化不得通过移除：

```text
accessibility
security validation
error handling
```

获得虚假的改善。

---

# 33. Authentication Performance

Authentication 继续遵循安全规范。

当前 Browser Client 默认：

```text
short-lived access token
memory-only token
top-level authorization recovery
```

性能优化不得通过持久化 Access Token 到：

```text
localStorage
sessionStorage
IndexedDB
```

解决。

如果未来引入：

```text
Refresh Token
```

必须通过 Security ADR。

---

# 34. Password Hashing Performance

Password Hashing 属于故意昂贵的安全操作。

因此：

```text
Argon2id
scrypt
```

不得以普通 API Latency 优化标准降低安全参数。

官方 Workers Build 必须对 Password Hash Implementation 执行实际 Benchmark。

必须确认：

```text
memory usage
CPU time
concurrency behavior
timeout behavior
abuse resistance
```

达到可接受水平。

如果目标 Runtime 无法安全运行所需参数：

> 应改变部署要求，而不是降低 Password Hash Security。

---

# 35. Attachment Upload Performance

附件 SHOULD 使用：

```text
Frontend
↓
Upload Intent
↓
Direct Object Storage Upload
↓
Finalize
```

避免大文件经过 Backend Worker Proxy。

Backend 只负责：

```text
authorization
intent creation
metadata
validation
finalization
```

---

# 36. Upload Limits

Upload Intent 必须绑定：

```text
principal
project
object key
maximum size
expiration
intent id
```

根据实现还可以绑定：

```text
declared MIME
content checksum
```

所有 Upload Size 必须存在上限。

---

# 37. Abandoned Upload

未 Finalize 的：

```text
pending
quarantine
temporary
```

对象必须存在 Retention Policy。

系统 SHOULD 自动清理：

```text
expired upload intent
abandoned object
failed upload
expired export
temporary derivative
```

避免对象存储无限增长。

---

# 38. Media Processing

以下处理 SHOULD NOT 发生在普通同步 API 请求路径：

```text
image transformation
thumbnail generation
archive extraction
malware scanning
large checksum calculation
media metadata extraction
```

应根据任务性质使用：

```text
Queue
Workflow
dedicated processing service
```

---

# 39. Queue Delivery Model

所有 Queue Consumer MUST 假设：

> A message may be delivered more than once.

因此 Consumer MUST 设计为：

```text
idempotent
```

不得假设：

```text
exactly once execution
```

---

# 40. Queue Message Identity

重要异步事件 SHOULD 具有稳定：

```text
event id
delivery id
job id
```

例如：

```text
issue-created:<event-id>
notification:<notification-id>
webhook:<delivery-id>
search-update:<event-id>
```

Consumer 可以使用：

```text
unique constraint
processed event record
downstream idempotency key
```

防止重复副作用。

---

# 41. Queue Retry

Queue Consumer 必须定义：

```text
retry count
backoff
permanent failure classification
```

不得无限重试：

```text
invalid data
unsupported version
permanent provider rejection
```

---

# 42. Dead Letter Queue

关键 Queue SHOULD 配置 Dead Letter Queue 或等价失败处理机制。

适用：

```text
notifications
webhooks
external integrations
imports
search updates
```

进入 Dead Letter 的消息必须具有：

```text
message id
failure reason
retry count
safe metadata
```

不得包含无必要 Secret。

---

# 43. Queue Backpressure

Producer 不得无限制产生下游工作。

以下功能必须具有 Fan-out Control：

```text
notifications
mentions
subscriptions
webhooks
bulk operations
plugin events
```

单个用户操作不得被允许产生无界：

```text
Queue Messages
External Requests
Notifications
```

---

# 44. Workflows

Workflows 用于：

```text
imports
exports
bulk operations
long-running integrations
retryable multi-step work
```

Workflow 每个 Step SHOULD：

```text
bounded
retry-safe
observable
idempotent where possible
```

Workflow State 不应保存大型不必要 Payload。

大型中间结果应考虑：

```text
R2
D1
```

等专门存储。

---

# 45. Export Performance

Product-level Export 不应直接等价为：

```text
database dump
```

Export SHOULD：

```text
authorize
↓
snapshot logical export request
↓
Workflow
↓
cursor-based batched reads
↓
stream/build output
↓
R2
↓
short-lived download authorization
```

避免：

```text
one huge synchronous query
```

和长时间数据库锁定。

---

# 46. Import Performance

Import 必须：

```text
stream or batch
```

处理。

不得：

```text
load arbitrary entire archive into memory
```

大型 Import 应由 Workflow 分批执行。

每批次必须存在：

```text
record limit
memory limit
retry boundary
checkpoint
```

---

# 47. Plugin Performance Boundary

Plugin 不得无界扩展 Core 同步请求路径。

Plugin Hook 必须明确：

```text
execution mode
timeout
payload limit
failure policy
concurrency
```

---

# 48. Synchronous Plugin Hooks

只有业务结果必须立即依赖 Plugin 时，才应使用同步 Hook。

例如：

```text
authentication provider
authorization-related provider
required CAPTCHA verification
```

普通：

```text
notification
webhook
analytics
external synchronization
```

SHOULD 使用异步执行。

---

# 49. Plugin Timeout

External Plugin 调用 MUST 存在 Timeout。

不得允许：

```text
Plugin unavailable
↓
Core request waits indefinitely
```

根据 Hook 类型可以：

```text
fail closed
fail request
enqueue retry
continue without non-critical side effect
```

具体语义必须显式定义。

---

# 50. Plugin Circuit Breaking

非关键 External Integration SHOULD 支持：

```text
timeout
retry budget
circuit breaker
```

防止下游 Provider 故障导致：

```text
request pile-up
queue explosion
resource exhaustion
```

---

# 51. External Fetch Budget

所有 Outbound Fetch SHOULD 定义：

```text
connection / request timeout
overall timeout
maximum redirect count
maximum response size
```

不得读取无限大小的外部 Response。

Import、Webhook、OIDC、External Integration 等功能必须特别注意这一点。

---

# 52. Rate Limiting Architecture

Rate Limiting 至少分为两类。

## 52.1 Edge Abuse Limiting

适用于：

```text
search
reaction
comment creation
issue creation
upload intent
anonymous endpoints
```

主要目标：

```text
volumetric abuse control
resource protection
cost protection
```

---

## 52.2 Security-sensitive Limiting

适用于：

```text
login
password reset
account recovery
MFA / step-up
API token creation
credential management
privileged configuration
```

这类 Limit 必须具有与安全需求匹配的一致性。

不得假设所有平台 Edge Rate Limit 都是严格全局计数器。

---

# 53. Durable Objects

Durable Objects 只在存在明确强协调需求时使用。

例如：

```text
strong coordination
strict serialized state
high-contention coordination
```

不得为了普通：

```text
Issue CRUD
Comment CRUD
Read Cache
```

默认引入 Durable Object。

如果一个安全敏感的全局状态确实需要强串行化，可以单独评估 Durable Object。

---

# 54. Read Replication

D1 Read Replication MAY 作为生产读扩展优化。

适合：

```text
Issue List
Issue Detail
Comments
Labels
Milestones
Public Search
```

启用时必须保留正确：

```text
read-after-write
session consistency
```

语义。

不得为了使用 Replica 而允许用户在成功写入后看到明显错误的旧状态。

---

# 55. Write Amplification

核心写操作必须评估 Write Amplification。

例如一次 Reaction 不应同步产生大量：

```text
database rows
audit rows
notification rows
search rows
webhook calls
```

不需要同步完成的副作用应转移到异步系统。

---

# 56. Counters and Aggregates

以下数据：

```text
comment count
reaction count
open issue count
closed issue count
milestone progress
```

是否实时计算或维护 Materialized Counter，应根据：

```text
read frequency
write frequency
consistency requirement
query cost
```

决定。

不得无理由为每个读取请求执行昂贵全表聚合。

---

# 57. Denormalization

项目优先保持关系模型。

但对明确 Hot Path，可以在有性能数据支持时使用受控 Denormalization。

任何 Denormalization 必须定义：

```text
canonical source
update mechanism
consistency model
rebuild strategy
```

不得创建无法修复的数据副本。

---

# 58. Observability

性能优化必须可观测。

Backend 至少 SHOULD 记录：

```text
request duration
request CPU time where available
D1 query count
D1 rows read
D1 rows written
D1 latency
R2 latency
external fetch latency
plugin latency
queue processing latency
```

---

# 59. Database Metrics

热点数据库操作 SHOULD 能够按：

```text
route
operation
query class
```

聚合：

```text
latency
rows read
rows written
errors
```

应能够识别：

```text
high rows-read query
full scan regression
slow query
high-frequency query
```

---

# 60. Cache Metrics

存在 Cache 时 SHOULD 观察：

```text
hit
miss
revalidation
bypass
stale
```

不得仅因为：

```text
cache hit rate is high
```

就判断缓存策略正确。

必须同时检查：

```text
correctness
freshness
security isolation
```

---

# 61. Queue Metrics

Queue SHOULD 监控：

```text
producer rate
consumer rate
lag
retry
failure
DLQ growth
processing latency
```

持续增加的 Queue Lag 必须视为容量或下游故障信号。

---

# 62. Performance Testing

测试体系除：

```text
Unit
Integration
Contract
End-to-End
Security Regression
```

外，SHOULD 增加：

```text
Performance Regression
Load
Stress where appropriate
```

---

# 63. Benchmark

至少应为以下路径建立可重复 Benchmark：

```text
Issue List
Issue Detail
Issue Creation
Comment Creation
Search
Authentication
Password Hash
Attachment Intent
```

Benchmark 数据集必须具有合理规模，而不是：

```text
10 rows database
```

这种无法暴露真实查询问题的测试环境。

---

# 64. Query Regression Tests

关键数据库查询 SHOULD 在代表性数据规模下监控：

```text
query count
rows read
latency
query plan
```

如果一次普通代码修改导致：

```text
rows read × 100
```

即使功能测试通过，也应被视为性能回归。

---

# 65. Load Testing

发布前 SHOULD 对核心公开 Endpoint 做基本 Load Testing。

重点包括：

```text
Issue List
Issue Detail
Search
Issue Creation
Comment Creation
Login
Upload Intent
```

Load Test 必须包含真实：

```text
authentication
authorization
database access
```

路径，而不仅测试 Hello World Worker。

---

# 66. Abuse-oriented Performance Testing

公开 Internet 服务还应测试：

```text
large valid payload
many small requests
complex search query
repeated failed login
high relation count
large comment thread
notification fan-out
abandoned upload
queue retry storm
slow external provider
```

性能测试与 Anti-abuse 测试存在交集。

---

# 67. Performance SLO

生产环境 SHOULD 维护明确 Performance SLO。

至少可以覆盖：

```text
API latency
API error rate
database latency
queue lag
frontend Core Web Vitals
```

具体数值应通过真实部署和流量基线确定。

不得在没有测量数据时为了文档完整性随意承诺不可验证 SLA。

---

# 68. Performance Error Budget

持续性能退化应与普通功能 Regression 同等对待。

如果：

```text
latency
database cost
queue lag
bundle size
```

持续超过项目已建立的性能基线，应优先处理，而不是永久提高阈值掩盖问题。

---

# 69. Graceful Degradation

非核心功能故障或过载时 SHOULD 优先 Gracefully Degrade。

例如：

```text
analytics unavailable
→ core issue creation still works

email provider slow
→ queue notification

search temporarily degraded
→ direct issue page still works
```

但不得对：

```text
authorization
authentication verification
data integrity
required validation
```

采用不安全降级。

---

# 70. Overload Protection

Backend 必须考虑：

```text
traffic spike
database overload
external provider outage
queue backlog
plugin outage
```

系统应通过：

```text
rate limiting
bounded concurrency
timeouts
backpressure
queueing
circuit breaker
```

防止局部故障扩散成全站资源耗尽。

---

# 71. Memory Policy

Workers Runtime 中不得无理由：

```text
buffer entire upload
buffer large download
load full export into memory
load full import archive into memory
```

优先使用：

```text
Streams
incremental processing
batch processing
R2
```

等方式。

---

# 72. Streaming

以下场景 SHOULD 优先考虑 Streaming：

```text
large export generation
large download proxy when unavoidable
import parsing
archive generation
large external response
```

Streaming 不得绕过：

```text
size limits
authorization
content validation
```

---

# 73. Cost as Performance Signal

Cloudflare 平台上的：

```text
CPU
D1 rows read
D1 rows written
R2 operations
Queue operations
Workflow execution
external requests
```

同时也是成本因素。

无必要的高资源消耗通常也属于性能缺陷。

但：

> Cost optimization MUST NOT weaken security or correctness.

---

# 74. Provider Independence

性能架构可以：

```text
Cloudflare-first
```

但 Core 的业务 Contract 不应假设：

```text
D1-specific SQL behavior
R2-only client semantics
Cloudflare-only cache API
```

为不可替代的公开协议。

Provider-specific 优化应尽量位于 Infrastructure / Adapter Layer。

---

# 75. Performance-sensitive Code Review

以下变更 SHOULD 进行额外 Performance Review：

```text
database schema
database index
list endpoint
search
pagination
bulk operation
cache
queue fan-out
plugin hook
upload
import
export
authentication flow
large dependency
frontend initial bundle
```

---

# 76. Performance ADR

以下变化原则上应创建 Architecture Decision Record：

```text
replace pagination model
introduce new cache layer
introduce read replica assumptions
introduce new search backend
introduce denormalized materialized data
move synchronous operation to async
introduce Durable Object for coordination
change queue delivery semantics
introduce large persistent frontend dependency
```

---

# 77. MVP Performance Baseline

MVP 在发布前至少必须满足：

```text
bounded API pagination
indexed common Issue queries
no obvious N+1 hot path
bounded Search Query complexity
rate limiting
direct R2 attachment upload
queue idempotency
queue retry policy
abandoned upload cleanup
structured performance metrics
frontend code splitting
bundle regression visibility
```

---

# 78. 后续优化能力

当真实流量证明有需要时，可以进一步采用：

```text
D1 Read Replication
aggressive public CDN caching
materialized counters
dedicated search backend
specialized read model
additional Workers
dedicated processing service
```

这些优化不应在没有实际需求时提前增加系统复杂度。

---

# 79. 非目标

项目不追求：

```text
premature microservices
zero database queries
100% cache hit rate
zero-latency global consistency
unbounded throughput
performance at the expense of security
benchmark-only optimization
```

也不要求普通自托管实例达到大型 Forge 的绝对流量规模。

---

# 80. 最终性能原则

长期性能设计应坚持以下底线：

> Every public operation must have a bound.

> Database access must be indexed, observable and intentionally shaped.

> Large collections use cursor-based pagination.

> N+1 is a defect on hot paths.

> Non-critical side effects do not belong on the synchronous request path.

> Queue consumers are idempotent.

> External dependencies always have timeouts and budgets.

> Cache correctness and security are more important than hit rate.

> Performance regressions must be measurable.

> Security parameters are not reduced to satisfy performance targets.

> Optimize from production evidence, not assumption.
