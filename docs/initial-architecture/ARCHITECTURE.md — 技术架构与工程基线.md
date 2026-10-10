# Architecture

## 1. 架构目标

技术架构围绕以下目标设计：

1. Frontend 与 Backend 完全分离；
2. Frontend 是纯静态应用；
3. Backend 以 Cloudflare Workers 为主要运行平台；
4. 前后端可以部署在完全不同的 registrable domain；
5. Core 使用模块化单体；
6. Plugin System 是正式基础设施；
7. API 是公共接口而不是 Web UI 私有接口；
8. 使用现代 Web Platform 能力；
9. 在兼容性、安全性和性能允许的前提下避免不必要的 Legacy 技术；
10. 保持开源自托管部署的可移植性。

---

# 2. Repository Model

项目采用 Monorepo。

推荐结构：

```text
/
├── apps/
│   ├── web/
│   └── api/
│
├── packages/
│   ├── contracts/
│   ├── api-client/
│   ├── core/
│   ├── domain/
│   ├── db/
│   ├── security/
│   ├── plugin-api/
│   ├── plugin-sdk/
│   ├── plugin-runtime/
│   ├── ui/
│   ├── config/
│   └── testing/
│
├── plugins/
│   ├── internal-sso/
│   ├── github/
│   ├── recaptcha/
│   ├── hcaptcha/
│   ├── turnstile/
│   ├── email/
│   └── webhook/
│
├── docs/
├── package.json
├── pnpm-workspace.yaml
└── ...
```

---

# 3. Monorepo 不等于单体部署

Frontend 和 Backend 可以共享：

```text
TypeScript contracts
Schemas
API Client
Plugin interfaces
UI primitives
Lint configuration
Build configuration
Test utilities
```

但不得依赖共享：

```text
Runtime
Origin
Domain
Deployment
Scaling lifecycle
Release process
```

原则：

> Monorepo does not imply monolithic deployment.

---

# 4. Node.js 基线

开发、构建、测试、CI 和工程脚本统一使用：

```text
Node.js 24 LTS
```

Node 24 是项目唯一默认 Node major。

建议：

```text
.node-version
24
```

以及：

```json
{
  "engines": {
    "node": ">=24 <25"
  }
}
```

CI 使用最新可用的 Node 24 LTS patch release。

不得因为某个开发者本地安装较旧 Node 版本而降低项目技术基线。

---

# 5. Node.js 与生产 Runtime 的区别

Node.js 24 LTS 是：

- Local development runtime；
- Package manager host；
- Build runtime；
- Test runtime；
- Code generation runtime；
- CI runtime。

Backend 的实际生产 Runtime 是：

```text
Cloudflare Workers Runtime
```

不得因为工程使用 Node.js 24 而假设生产环境支持完整 Node.js Runtime。

依赖选择应优先：

```text
Web Standards API
Workers native API
Web Crypto
Fetch
Streams
URL
Request / Response
```

只有必要时才启用或依赖 Workers 的 Node.js compatibility layer。

---

# 6. Package Management

Monorepo 使用：

```text
pnpm workspace
```

要求：

- Workspace dependencies 显式；
- Lockfile 提交；
- CI 使用 frozen lockfile；
- 不允许多个 package manager lockfile 共存。

依赖优先选择：

- ESM-first；
- TypeScript-first；
- Active maintained；
- Workers-compatible；
- Browser-native where practical。

---

# 7. Frontend Stack

Frontend 基线：

```text
React 19
TypeScript 7
Vite 8
```

应用层优先：

```text
TanStack Router
TanStack Query
TanStack Form
```

UI 层：

```text
Tailwind CSS
shadcn/ui
Base UI
```

具体 minor / patch version 可以持续更新，但 major 变更需要正常兼容性审查。

---

# 8. Frontend Rendering Model

Frontend 是：

```text
Static SPA
```

不是：

```text
SSR application
Node server
Pages Functions application
Vercel Functions application
Netlify Functions application
```

标准构建：

```text
pnpm build
↓
dist/
├── index.html
├── assets/
└── runtime configuration
```

`dist/` 应能够被通用静态 HTTP Server 直接托管。

---

# 9. Frontend Deployment

支持但不限于：

```text
Cloudflare Pages
Vercel
Netlify
GitHub Pages
S3-compatible object storage
nginx
Caddy
Other static hosting
```

其中：

> Cloudflare Pages 是一等公民部署目标。

项目应优先提供和测试：

- Cloudflare Pages deployment guide；
- Git integration；
- Preview deployment；
- SPA fallback；
- Security headers；
- Cache headers。

但应用代码不得依赖 Pages Functions。

---

# 10. Runtime Configuration

静态 Frontend 不应因为 API Domain 或普通站点配置变化而必须重新编译。

推荐启动时加载 Runtime Config：

```text
/config.json
```

例如：

```json
{
  "apiBaseUrl": "https://api.example.net",
  "applicationName": "Issue Tracker"
}
```

Runtime Config 只能包含公开信息。

任何 Secret 均不得进入：

```text
config.json
Frontend bundle
HTML
Public environment variables
```

---

# 11. Frontend / Backend Domain Model

架构默认认为 Frontend 和 Backend：

```text
不同 Origin
不同 Domain
甚至不同 Provider
```

例如：

```text
Frontend:
https://issues.example.org

Backend:
https://api.example.net
```

因此系统不得依赖：

- Shared-origin assumptions；
- Cross-site Session Cookie 作为业务 API 基础；
- Frontend-host-specific backend proxy。

---

# 12. Browser Compatibility Policy

Frontend Browser Compatibility 以：

> MDN Baseline — Widely Available

作为正式最低技术基线。

项目不维护长期静态的：

```text
Chrome >= X
Safari >= Y
Firefox >= Z
```

作为一级规范。

浏览器版本集合随 Baseline 和构建工具 major release 更新。

---

# 13. Vite Build Target

生产构建默认采用：

```ts
build: {
  target: "baseline-widely-available"
}
```

不得无理由降级到：

```text
es2015
legacy browsers
```

也不默认启用 legacy bundle。

---

# 14. Web Platform Feature Policy

选择浏览器技术时遵循以下顺序。

## Level A — Baseline Widely Available

可以直接使用。

例如符合该状态的：

- JavaScript syntax；
- CSS；
- DOM API；
- Web API。

原则上无需额外 Polyfill。

---

## Level B — Baseline Newly Available

可以在以下情况下使用：

- 明显改善产品质量；
- 有可靠 Feature Detection；
- 可以 Progressive Enhancement；
- 不支持时存在合理 fallback。

不得因为使用该特性导致核心产品无法工作。

---

## Level C — Limited Availability

默认不得成为核心功能的硬依赖。

只有满足以下条件之一时可以采用：

1. 有可靠轻量 Polyfill；
2. 可以作为 Optional Enhancement；
3. 经过明确 Architecture Decision 批准。

---

# 15. Modern-first

在 Baseline Widely Available 范围内：

> 优先使用现代 Web Platform 原生能力，而不是为旧浏览器保留历史方案。

例如，若现代标准能力已经达到目标兼容基线，则不应因为过去的浏览器限制继续保留：

- 大型兼容性 shim；
- 无必要 DOM library；
- Legacy CSS workaround；
- 已淘汰浏览器前缀；
- ES5-style architecture。

---

# 16. Polyfill Policy

默认：

```text
No blanket polyfill bundle
```

如果需要 Polyfill：

- 按功能单独评估；
- 只加载实际需要的部分；
- 考虑代码体积；
- 考虑安全维护；
- 考虑是否值得支持该能力。

Polyfill 不得成为长期隐藏的 Legacy 兼容层。

---

# 17. Progressive Enhancement

非核心能力可以使用较新的 Web Platform 特性。

例如：

```text
enhanced animation
advanced clipboard
view transitions
advanced CSS effects
```

如果不支持，则：

```text
gracefully degrade
```

而不是阻止用户使用 Issue 平台。

---

# 18. Baseline 不等于全部兼容性

Baseline 只定义主要浏览器的 Web Platform compatibility。

它不替代：

- Accessibility testing；
- Screen reader testing；
- Keyboard navigation；
- Touch usability；
- Performance testing；
- Security testing；
- Embedded WebView testing。

系统 WebView、特殊嵌入浏览器和其他未进入 Baseline 范围的环境不自动属于官方支持目标。

---

# 19. Accessibility

Frontend 设计目标至少满足：

```text
WCAG 2.2 AA
```

组件必须优先考虑：

- Semantic HTML；
- Keyboard operation；
- Focus management；
- Screen reader semantics；
- Reduced motion；
- Color contrast；
- Zoom；
- Touch targets。

不得为了视觉设计而破坏原生语义。

---

# 20. State Ownership

Frontend State 按职责分离。

```text
URL / Navigation State
→ TanStack Router

Remote / Server State
→ TanStack Query

Form State
→ TanStack Form

Local UI State
→ React state

Rare global ephemeral state
→ minimal dedicated store if required
```

不建立“所有状态都放一个 Global Store”的架构。

---

# 21. URL 是查询状态的一部分

Issue Filter、Sort、Search 等可共享状态应尽量能够编码到 URL。

例如：

```text
/issues?state=open&label=bug&assignee=me
```

目标：

- Refresh-safe；
- Shareable；
- Bookmarkable；
- Back / Forward navigation compatible。

---

# 22. Backend Stack

主要 Backend Stack：

```text
TypeScript 7
Elysia
Cloudflare Workers
```

数据与异步基础设施：

```text
Cloudflare D1
Cloudflare R2
Cloudflare Queues
Cloudflare Workflows
Durable Objects when justified
```

数据库访问层优先：

```text
Drizzle ORM
```

---

# 23. Backend Architecture

Backend 默认采用：

> Modular Monolith

模块可以包括：

```text
auth
identity
project
issue
comment
label
milestone
search
attachment
notification
audit
plugin
admin
```

代码模块边界清晰，但不因此：

```text
one module = one Worker
```

---

# 24. Service Split Policy

只有出现明确需求时才拆独立 Service / Worker，例如：

- 独立扩缩容；
- 安全隔离；
- 独立生命周期；
- 长任务；
- 第三方 Plugin；
- Runtime requirement 不同。

优先演进方式：

```text
Modular Monolith
↓
Extract Module
↓
Dedicated Worker
↓
Service Binding / API
```

而不是从第一版开始 Microservices。

---

# 25. API

Backend 提供版本化 REST API：

```text
/api/v1/*
```

API 是正式产品接口。

需要具备：

- OpenAPI；
- Stable DTO；
- Versioning；
- Pagination conventions；
- Error conventions；
- Authentication model；
- Authorization；
- Rate limiting。

---

# 26. API Contracts

前后端不直接跨 `apps/` import 实现类型。

禁止类似：

```ts
import type { App } from "../../api/src/app"
```

作为核心架构。

公共协议放置在：

```text
packages/contracts
```

例如：

```text
contracts/
├── issue
├── project
├── auth
├── search
└── plugin
```

官方客户端：

```text
packages/api-client
```

Frontend 通过 API Client 或 Contracts 调用 Backend。

---

# 27. API 与 Framework 解耦

Elysia 是 Backend Framework。

但公开 API Contract 不应设计成只能由 Elysia 消费。

这保证未来：

- CLI；
- Native App；
- Third-party clients；
- External plugins

无需依赖 Elysia 类型系统。

---

# 28. Database

D1 是主要事务数据库。

存储包括：

```text
Users
Staff
Projects
Issues
Comments
Labels
Milestones
Relations
Events
Permissions
Plugin metadata
```

业务关系优先采用关系模型。

---

# 29. Object Storage

R2 保存 Blob，例如：

```text
Attachments
Import files
Export files
Generated artifacts
Media derivatives
```

D1 只保存对应 Metadata。

---

# 30. Search

第一阶段优先使用：

```text
D1
+
SQLite FTS
```

搜索协议必须与实际搜索 Backend 解耦。

Frontend / API 使用结构化 Query Model。

未来可以替换 Search Backend，而无需改变产品查询语义。

---

# 31. Async Processing

Queues 用于短生命周期异步事件：

```text
notifications
webhooks
search updates
integration events
derived processing
```

用户同步请求不应等待这些非关键操作完成。

---

# 32. Long-running Processing

Workflows 用于：

```text
imports
exports
bulk operations
long-running integrations
retryable multi-step operations
```

---

# 33. Durable Objects

Durable Objects 只用于存在明确协调需求的功能，例如：

```text
Realtime room
Presence
Strong coordination
```

不得因为其可用而把普通 Issue CRUD 放进 Durable Objects。

---

# 34. Plugin Architecture

Plugin System 拆为：

```text
Plugin API
Plugin SDK
Plugin Runtime
Plugin Registry
Extension Points
```

详细协议由：

```text
PLUGIN-SPEC.md
```

定义。

---

# 35. Plugin Categories

至少支持概念上的：

```text
Trusted Native Plugin
Isolated External Plugin
```

Trusted Plugin 编译进入应用，视为可信代码。

需要安全隔离的第三方代码应独立运行。

---

# 36. Frontend Plugin Constraint

Frontend 是静态应用。

因此插件不能默认通过：

```text
remote URL
↓
dynamic import
↓
arbitrary JavaScript execution
```

注入第三方代码。

Frontend Native Plugin 默认属于 Build-time Composition。

External Plugin 应通过稳定 API 和受控 Extension Point 交互。

---

# 37. Authentication Architecture

由于 Frontend 与 Backend 可以完全 Cross-site：

认证协议必须在该场景下正常工作。

默认架构采用标准 Browser-based OAuth 模式：

```text
Authorization Code
+
PKCE
```

业务 API 使用短生命周期 Access Token。

详细规定由：

```text
SECURITY.md
```

定义。

---

# 38. CORS

Backend 把 Cross-origin Frontend 作为正常工作模式。

CORS：

- 使用显式 Origin Allowlist；
- 不把 `*` 用于敏感 API；
- 不无条件反射 Origin；
- 按 endpoint 控制 Methods 和 Headers。

具体策略由 `SECURITY.md` 定义。

---

# 39. Markdown Pipeline

Markdown canonical data 为原始 Markdown。

推荐流程：

```text
Markdown
↓
GFM Parser
↓
Raw HTML parser
↓
Strict Sanitizer
↓
React representation
```

HTML Policy 由安全包集中定义。

Frontend feature code 不得各自实现 Sanitizer。

---

# 40. Cryptography Boundary

密码学能力统一放入：

```text
packages/security
```

业务模块不得自行实现：

- Encryption；
- Password hashing；
- Token generation；
- Signing；
- Key derivation；
- Key wrapping。

详细算法、Key Management 与 PQC Strategy 由：

```text
SECURITY.md
```

集中定义。

---

# 41. Security Package

推荐：

```text
packages/security/
├── auth/
├── authorization/
├── crypto/
├── markdown/
├── anti-abuse/
├── token/
└── audit/
```

这样安全策略不会散落于各 Domain Module。

---

# 42. Error Handling

公共 API 使用统一 Error Contract。

需要区分：

```text
validation error
authentication error
authorization error
not found
conflict
rate limit
internal error
```

不得把底层：

```text
SQL errors
stack traces
provider secrets
internal exceptions
```

直接返回客户端。

---

# 43. Observability

Backend 采用结构化日志。

至少包含：

```text
request id
operation
route
status
duration
principal type when safe
project id when safe
error code
```

敏感数据不得写入日志。

Audit Log 与普通 Observability Log 是不同概念。

---

# 44. Testing

至少划分：

```text
Unit
Integration
Contract
End-to-End
Security regression
```

Frontend E2E：

```text
Playwright
```

通用 Unit / Integration：

```text
Vitest
```

公共 API 应具有 Contract Test。

Plugin API 应具有兼容性测试。

---

# 45. Tooling

工程工具优先采用现代、高性能、维护活跃的实现。

当前默认方向：

```text
Vite
Oxc / Vite native transforms
oxlint
oxfmt
Vitest
Playwright
```

工具选型原则不是“必须全部使用 Rust 工具”，而是：

```text
Correctness
Maintainability
Performance
Standards compliance
Ecosystem maturity
```

综合最优。

---

# 46. TypeScript Policy

项目使用 TypeScript 7。

默认开启严格类型检查。

不使用：

```text
any
```

作为规避类型设计问题的常规手段。

公共协议和 Plugin API 尤其需要保持严格、稳定的类型边界。

---

# 47. Dependency Policy

新增依赖需要评估：

```text
maintenance
bundle impact
runtime compatibility
security history
standards overlap
tree shaking
ESM support
type quality
```

如果 Web Platform 原生能力已经充分解决问题，则优先考虑原生能力。

但不因追求“零依赖”而重新实现成熟且复杂的安全/协议逻辑。

---

# 48. Platform Preference

基础设施层：

```text
Cloudflare-first
```

但并非所有组件都：

```text
Cloudflare-only
```

Backend 明确以 Cloudflare Workers 为主要 Runtime。

Frontend 保持静态托管中立。

Secrets / KMS / External Integration 通过适当抽象保持扩展可能。

---

# 49. Architecture Decision Records

以下变化原则上应产生 ADR：

- 更换核心 Framework；
- 更换 Database；
- 引入 Microservice；
- 修改 Authentication model；
- 修改 Browser compatibility baseline；
- 改变 Plugin execution model；
- 引入新的 cryptographic primitive；
- 新增 persistent client credential；
- 引入 Limited Availability Web API 作为核心依赖。

---

# 50. 总体架构

```text
                 Static Frontend
        React 19 + TypeScript 7 + Vite
                         │
             Cloudflare Pages first
          Vercel / Netlify / Others
                         │
                         │ HTTPS
                         │ Public REST API
                         ▼
                 Cloudflare Workers
                       Elysia
                         │
            ┌────────────┼────────────┐
            │            │            │
            ▼            ▼            ▼
           D1            R2         Queues
                                      │
                                      ▼
                                  Workflows

                         +
                   Plugin System
```

工程仓库：

```text
                        Monorepo
                           │
          ┌────────────────┴────────────────┐
          │                                 │
       apps/                             packages/
   ┌──────┴──────┐              ┌───────────┼───────────┐
   │             │              │           │           │
  web           api         contracts   security   plugin-api
```

最终边界：

> 前端是现代、Baseline Widely Available 的静态 Web 应用；后端是 Cloudflare-native 的公共 API；二者可以完全独立部署，通过稳定 Contract 协作，并由 Plugin Architecture 承担非普适扩展能力。