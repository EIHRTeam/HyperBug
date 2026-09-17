# Product

## 1. 项目定位

本项目是一个**面向公众的、轻量化、现代化、开源、可自托管且可复用的 Issue 反馈与问题跟踪平台**。

Issue 功能以 GitHub Issues 的能力和使用体验作为主要基准，但平台本身不依赖 Git 仓库、Pull Request、代码托管或特定 Forge。

项目主要解决：

> 公众发现问题、提出建议或反馈需求后，能够以较低门槛提交 Issue；项目内部人员能够高效完成分类、讨论、跟踪、关联、处理与关闭。

英文定位：

> A lightweight, modern and open-source issue tracking and public feedback platform with GitHub Issues-class capabilities, designed for self-hosting and reuse.

---

# 2. 核心原则

项目长期遵循以下原则。

## 2.1 Public-first

平台首先是公众反馈入口，而不是内部企业项目管理系统。

优先优化：

- 浏览已有 Issue；
- 搜索问题；
- 创建 Issue；
- 提交结构化反馈；
- 评论；
- 上传附件；
- 查看处理进度；
- 订阅更新。

普通用户不应需要理解复杂的项目管理术语即可使用平台。

---

## 2.2 GitHub Issues-class

“轻量化”不意味着 Issue 能力残缺。

Issue 应达到与 GitHub Issues 同等级别的核心能力，包括：

- Issue；
- Comment；
- Reaction；
- Label；
- Assignee；
- Milestone；
- Issue Type；
- Issue Form；
- Issue Template；
- Sub-issue；
- Dependency；
- Duplicate；
- Related Issue；
- Timeline；
- Search；
- Filter；
- Subscription。

---

## 2.3 Lightweight Core

Core 只提供几乎所有部署都需要的通用能力。

非普适能力优先通过插件实现。

Core 不应不断吸收：

- 企业专有流程；
- 特定代码托管服务；
- CAPTCHA 厂商；
- 特定 SSO；
- 特定消息平台；
- 特定云服务；
- AI 服务。

---

## 2.4 Plugin-first Extensibility

插件体系是一等公民。

插件机制不是后期添加的 Hook 集合，而是 Core 在设计数据模型、事件模型、API、UI 和权限边界时需要共同考虑的正式扩展协议。

官方扩展也应尽可能使用公开 Plugin API。

---

## 2.5 API-first

官方 Web 前端只是平台公共 API 的一个客户端。

同一 API 应能够服务：

- Web；
- CLI；
- Mobile Client；
- Bot；
- Plugin；
- External Integration。

---

## 2.6 Static Frontend

官方前端是完全独立的静态 Web Application。

它不依赖后端 Node Server、SSR Runtime、Pages Functions 或其他特定静态托管平台的动态能力。

---

## 2.7 Secure by Default

核心安全属性必须由 Core 保证。

部署者不应通过“正确安装某个插件”才能获得基本安全性。

插件可以提供安全机制，但不得取消 Core 的最低安全策略。

---

## 2.8 Open and Reusable

平台应适用于不同类型的公开项目，例如：

- 开源软件；
- 商业软件公众反馈；
- Wiki；
- 游戏；
- 社区；
- 文档项目；
- 公共服务；
- 内容项目。

不得为了单一部署环境把 Core 与某个组织、产品或基础设施绑定。

---

# 3. 用户模型

平台区分两类主要身份。

## 3.1 Public User

普通公众用户。

典型能力：

- 浏览公开内容；
- 搜索 Issue；
- 创建 Issue；
- 评论；
- Reaction；
- 上传允许的附件；
- 订阅 Issue；
- 编辑自己的内容；
- 管理个人账户。

Public User 使用平台普通账号系统。

---

## 3.2 Staff

项目内部工作人员。

典型角色包括：

- Triage；
- Maintainer；
- Administrator。

典型能力：

- 分类 Issue；
- 添加或移除 Label；
- 修改 Issue Type；
- 分配负责人；
- 管理 Milestone；
- 建立 Issue Relation；
- 管理 Sub-issue；
- 标记 Duplicate；
- Close / Reopen；
- 执行 Moderation；
- 配置项目；
- 管理权限；
- 管理插件。

---

# 4. Public User 与 Staff 分离

Public User 和 Staff 是两个不同的身份域。

统一抽象：

```text
Principal
├── User
└── Staff
```

业务逻辑围绕 Principal 进行认证和授权：

```text
request
↓
authenticate
↓
Principal
↓
authorize
↓
operation
```

Public User 与 Staff 不因 Email 相同而自动合并。

不得通过：

```text
publicUser.email === staff.email
```

自动赋予 Staff 权限。

如果未来需要关联两种身份，应采用显式、可审计的关联机制。

---

# 5. Internal SSO

Staff 可以通过插件接入部署方自有 SSO。

Core 不绑定任何内部身份提供商。

推荐协议：

- OpenID Connect；
- OAuth 2.0；
- SAML（可选）。

SSO 负责 Authentication。

平台本地系统负责 Authorization。

外部身份应至少通过：

```text
issuer + subject
```

建立稳定 Staff Identity。

外部 Group / Role 可以用于本地角色映射，但不应成为绕过本地权限系统的直接授权机制。

---

# 6. Project

Project 是 Issue 的主要组织边界。

一个部署可以包含一个或多个 Project。

Project 可以包含：

- Issues；
- Labels；
- Issue Types；
- Milestones；
- Issue Forms；
- Issue Templates；
- Staff permissions；
- Project settings。

Project 不等价于 Git Repository。

Git Repository 可以由插件关联，但不是 Project 的必要组成部分。

---

# 7. Issue

Issue 是平台最核心的领域实体。

基本字段包括：

```text
id
number
project
title
body
state
state reason
type
author
assignees
labels
milestone
parent
created at
updated at
closed at
```

内部 ID 与用户可见 Number 应分离。

用户交互以：

```text
#123
```

作为主要引用形式。

跨项目环境可以附带 Project 标识：

```text
PROJECT-123
```

---

# 8. Issue State

Core 保持简单状态模型：

```text
Open
Closed
```

Closed 可以具有 Reason，例如：

```text
Completed
Not Planned
Duplicate
Invalid
Cannot Reproduce
```

Core 不提供任意复杂 Workflow Designer。

如果部署方需要更复杂状态机，应通过插件扩展。

---

# 9. Issue Type

Core 支持 Issue Type。

默认可以包括：

```text
Bug
Feature
Task
Question
```

Project 可以配置：

- 名称；
- 描述；
- Icon；
- Color；
- 顺序；
- 是否可用。

Issue Type 不发展成复杂的企业级工作项层次系统。

---

# 10. Labels

Label 是 Core 的主要轻量分类系统。

例如：

```text
bug
enhancement
documentation
duplicate
help wanted
good first issue

priority:p0
priority:p1

platform:windows
platform:android

severity:critical
```

Core 默认不建立复杂独立 Priority / Severity 系统。

确有需求时可以由 Plugin 扩展。

---

# 11. Milestone

Milestone 支持：

- Title；
- Description；
- State；
- Due Date；
- Open Issue count；
- Closed Issue count；
- Completion percentage。

典型用途：

```text
v2.0
Public Beta
2027 Q1
Launch
```

Milestone 不演变为完整 Roadmap 或项目规划系统。

---

# 12. Sub-issues

Sub-issue 是 Core 能力。

支持：

- Parent Issue；
- Child Issues；
- 多级层次；
- 创建 Child；
- 关联已有 Issue；
- 完成进度。

示例：

```text
#100 Authentication
├── #101 OAuth
├── #102 Passkey
│   ├── #105 Android
│   └── #106 iOS
└── #103 Session Management
```

Sub-issue 与 Markdown Task List 是两个不同的数据模型。

---

# 13. Issue Relations

Core 至少支持：

```text
Parent / Child
Blocks / Blocked By
Duplicate
Related
```

关系应结构化存储。

例如仅存：

```text
A BLOCKS B
```

由读取层推导：

```text
B BLOCKED_BY A
```

---

# 14. Comment

Issue 支持 Threaded Discussion 所需的基础 Comment 能力。

Comment 包括：

- Author；
- Markdown Body；
- Created At；
- Updated At；
- Edit history；
- Reactions；
- Permalink。

删除策略、Moderation 和审计要求由安全规范进一步定义。

---

# 15. Timeline

Issue Detail 使用统一 Timeline。

Timeline 合并：

- Comments；
- Issue Events。

事件至少包括：

```text
Issue Opened
Issue Closed
Issue Reopened

Title Changed
Body Changed

Label Added
Label Removed

Assignee Added
Assignee Removed

Milestone Changed
Type Changed

Parent Changed

Relation Added
Relation Removed
```

关键状态变更必须可审计。

---

# 16. Reactions

Issue 与 Comment 支持轻量 Reaction。

Reaction 用于低成本反馈，不替代 Comment。

---

# 17. Markdown

平台采用 GitHub Flavored Markdown 作为主要内容格式。

允许经过严格 Sanitization 的有限 Raw HTML。

HTML Allowlist 的设计原则和能力范围参考 GitHub Markdown。

项目维护自己的：

```text
Markdown Sanitization Policy
```

并进行版本化。

原始 Markdown 是数据库中的 canonical representation。

不得仅保存最终渲染 HTML。

---

# 18. Issue Templates

支持普通 Markdown Issue Template。

适用于偏技术用户或自由度较高的反馈入口。

---

# 19. Issue Forms

Structured Issue Forms 属于核心公众反馈能力。

支持字段至少包括：

```text
Text
Textarea
Select
Multi-select
Checkbox
Boolean
Attachment
Markdown Notice
```

例如：

```text
Bug Report

Title
Affected Version
Operating System
Description
Expected Behavior
Steps to Reproduce
Attachments

[ ] I searched existing issues.
```

Issue Form 可以生成 Markdown Body，同时保留必要的结构化字段值。

---

# 20. Search

Issue Search 是 Core 一级功能。

支持：

- Full-text search；
- Filter；
- Sort；
- Query syntax。

高级查询可以采用 GitHub 风格：

```text
is:open
label:bug
assignee:me
milestone:v2
type:bug
author:alice
```

例如：

```text
is:open label:bug -label:duplicate assignee:me
```

查询协议内部应转换为结构化 Query AST，而不是把 UI 与特定数据库查询语法绑定。

---

# 21. Saved Views

平台可以提供轻量 Saved View。

保存：

- Query；
- Filters；
- Sort；
- Columns；
- Grouping；
- Density。

例如：

```text
My Open Issues
Untriaged
P0 / P1
Android Bugs
v2.0
```

Saved View 不发展成完整 Project Board 产品。

---

# 22. Attachment

Issue 和 Comment 可以包含附件。

附件属于平台 Core 能力。

文件：

- 元数据存数据库；
- 二进制存对象存储。

附件必须经过 Core 安全策略处理。

---

# 23. Notification

Core 提供通知事件和订阅模型。

具体通知渠道可以插件化。

例如：

```text
Email
Discord
Slack
Webhook
Custom Provider
```

Core 不要求所有部署都启用 Email。

---

# 24. CAPTCHA 与 Anti-abuse

Anti-abuse 属于 Core。

至少包括：

- Rate Limiting；
- Abuse throttling；
- 内容大小限制；
- Mention 限制；
- Attachment quota；
- Notification fan-out protection；
- Account-level controls。

CAPTCHA Provider 属于插件。

官方或社区插件可以实现：

```text
reCAPTCHA
hCaptcha
Cloudflare Turnstile
```

未安装 CAPTCHA 插件时，Core 的其他 Anti-abuse 能力仍必须有效。

---

# 25. Plugin System

插件能力是一等公民。

插件可以扩展：

- Authentication；
- Internal SSO；
- CAPTCHA；
- Notification；
- Issue actions；
- Issue metadata；
- Integrations；
- Import / Export；
- Search；
- Admin settings；
- Project settings；
- 受控 UI Extension Points。

Plugin API 独立版本化。

Core Version 与 Plugin API Version 不一一绑定。

---

# 26. Core 与 Plugin 的安全边界

长期原则：

> Core defines policy; plugins provide mechanisms.

例如 Plugin 可以决定：

```text
使用 hCaptcha 还是 reCAPTCHA
使用哪个 SSO
使用哪个 Notification Provider
使用哪个 KMS
```

但不能决定是否执行：

```text
Authorization
Markdown Sanitization
Minimum Encryption Policy
Rate Limiting
Audit
CORS Policy
Input Validation
```

这些属于 Core。

---

# 27. 非核心产品能力

以下能力明确不进入基础产品定位：

- Git hosting；
- Pull Request；
- Code Review；
- CI/CD；
- Scrum；
- Sprint；
- Full Kanban；
- Timesheet；
- Budget；
- CRM；
- ERP；
- CMDB；
- Full ITSM；
- Heavy SLA；
- Enterprise approval workflow。

---

# 28. 可通过插件扩展但非 Core 的能力

包括但不限于：

```text
GitHub integration
GitLab integration
Forgejo integration

Internal SSO
SAML
LDAP

reCAPTCHA
hCaptcha
Turnstile

Email
Discord
Slack

Custom fields
Structured priority
Additional workflow

Analytics
AI assistance
Duplicate detection

Importers
Exporters
```

---

# 29. MVP

第一阶段必须形成完整主路径：

```text
Project
↓
Issue List
↓
Search
↓
Create Issue
↓
Issue Form
↓
Issue Detail
↓
Comment
↓
Reaction
↓
Label
↓
Assignee
↓
Type
↓
Milestone
↓
Close / Reopen
↓
Timeline
```

并具备基础：

```text
Authentication
Authorization
Markdown
Attachments
Audit
Anti-abuse
Public API
Plugin Runtime foundation
```

---

# 30. 后续核心能力

MVP 后优先补充：

```text
Sub-issues
Dependencies
Duplicate relations
Saved Views
Bulk operations
Notifications
Webhooks
Import / Export
```

以及官方可选插件：

```text
Internal SSO
reCAPTCHA
hCaptcha
Turnstile
GitHub integration
```

---

# 31. 明确延后

这些能力不得阻塞核心版本发布：

```text
AI
Vector Search
Realtime Collaborative Editing
Full Project Board
Roadmap
SLA
Knowledge Base
SCIM
Arbitrary Workflow Designer
Untrusted third-party runtime code
```

---

# 32. 成功标准

项目不追求成为功能最多的问题管理平台。

产品成功的标准是：

- 普通用户能快速提交高质量反馈；
- 用户能轻松找到已有问题；
- 维护者能高效完成 Triage 和处理；
- Issue 功能完整而不过度复杂；
- 默认部署成本和运维成本较低；
- 不依赖单一前端托管平台；
- 插件能够覆盖组织差异化需求；
- 自托管部署具备合理默认安全性；
- 项目可以被其他组织真正复用，而非只能 Fork 后深度修改。