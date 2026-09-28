[**English**](README.md) | **简体中文**

# HyperBug

[![License: Apache 2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg?style=flat-square&label=License)](LICENSE)
[![Version](https://img.shields.io/github/v/release/EIHRTeam/HyperBug?style=flat-square&label=Version&color=blue)](https://github.com/EIHRTeam/HyperBug/releases/latest)<br>
[![CodeQL](https://github.com/EIHRTeam/HyperBug/actions/workflows/codeql.yml/badge.svg)](https://github.com/EIHRTeam/HyperBug/actions/workflows/codeql.yml)
[![Backend Tests](https://github.com/EIHRTeam/HyperBug/actions/workflows/backend.yml/badge.svg)](https://github.com/EIHRTeam/HyperBug/actions/workflows/backend.yml)
<br>
[![TypeScript 7](https://img.shields.io/badge/TypeScript-7-blue.svg?logo=typescript&style=flat-square&logoColor=white)](https://www.typescriptlang.org/)
[![Elysia 1.4](docs/assets/Elysia-1.4-E34798.svg)](https://elysiajs.com/)
[![Node.js 24](https://img.shields.io/badge/Node.js-24-339933.svg?style=flat-square&logo=node.js&logoColor=white)](.node-version)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-yellow.svg?style=flat-square&logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![PostgreSQL 18](https://img.shields.io/badge/PostgreSQL-18-blue.svg?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org/)

> [!IMPORTANT]
> 本项目尚处早期开发阶段，可能包含重大缺陷或破坏性更改，请勿用于生产环境

现代化、轻量化、云原生、Serverless 优先的类 GitHub Issue 问题跟踪平台解决方案

## 文档

阅读[简体中文文档](docs/site/zh-CN/index.md)或 [English documentation](docs/site/index.md)。指南目前仍为提纲；[VitePress 站点维护说明](docs/development/DOCUMENTATION.md)介绍本地预览与 GitHub Pages 部署。现有后端工作区请参阅[后端开发指南](docs/development/README.md)。

## 亮点

## 快速开始

### 部署

#### 后端

| Profile        | 运行时             | 数据库          | 对象存储 | 队列与工作流      |
| -------------- | ------------------ | --------------- | -------- | ----------------- |
| A — Cloudflare | Cloudflare Workers | D1              | R2       | Queues、Workflows |
| B — 自托管     | Node.js 24         | PostgreSQL 18.x | S3 兼容  | Graphile Worker   |

#### 前端

### 开发

```sh
git clone git@github.com:EIHRTeam/HyperBug.git
cd HyperBug
pnpm install --frozen-lockfile
pnpm dev            # 本地运行 API 与静态前端
pnpm test           # 单元、契约与集成测试
pnpm lint           # Lint 与格式检查
pnpm typecheck      # 全工作区严格类型检查
pnpm build          # 构建 API 产物与静态前端产物
```

运行 `pnpm run` 可查看完整脚本列表，其中包含格式化、迁移与按 Profile 划分的集成测试命令；迁移通过所选 Profile 对应的工作区迁移命令执行，分别委托给 D1 迁移适配器或 PostgreSQL 迁移集。所有依赖都由已提交的 lockfile 固定，生命周期安装脚本受策略限制。

```text
repo/
├── apps/
│   ├── web/              # 静态 SPA，独立部署
│   ├── api-cloudflare/   # Workers 入口
│   └── api-node/         # Node 24 入口
├── packages/
│   ├── contracts/        # 公开 DTO、REST/OpenAPI 文档、生成的 API 客户端
│   ├── domain/           # 实体、不变量、策略
│   ├── application/      # 用例与应用服务
│   ├── server/           # 共享 Elysia 路由与中间件
│   ├── security/         # 密码学、令牌、清洗、审计、滥用防护
│   ├── database/         # contracts + d1 与 postgres 适配器
│   ├── blob/             # contracts + r2 与 s3 适配器
│   ├── queue/            # contracts + cloudflare 与 graphile 适配器
│   ├── workflow/, search/, plugin-api/, observability/
└── tooling/
```

详请参见 [CONTRIBUTING.md](CONTRIBUTING.md)

## 法律

### 版权

Copyright © 2026 Endfield Industries Human Resource Team, licensed under [Apache License, Version 2.0.](LICENSE)

### 免责声明

本项目及终末地工业人事部与上海市鹰角网络科技有限公司、Gryph Frontier Pte. Ltd.，及其各自的关联实体之间没有任何组织或资金上的联系。

### 其他

#### 隐私
