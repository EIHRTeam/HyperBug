[**English**](README.md) | **简体中文**

# HyperBug

[![License: Apache 2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg?style=flat-square)](LICENSE)
<!-- [![Status: stable](https://img.shields.io/badge/status-stable-brightgreen.svg?style=flat-square)](docs/plan/PROGRESS.md) -->
[![Node.js 24 LTS](https://img.shields.io/badge/node-24%20LTS-339933.svg?style=flat-square)](.node-version)
<!-- [![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](CONTRIBUTING.md) -->

> [!IMPORTANT]
> 本项目尚处早期开发阶段，可能包含重大缺陷或破坏性更改，请勿用于生产环境

现代化、轻量化、云原生、Serverless 优先的类 GitHub Issue 问题跟踪平台解决方案

## 亮点

## 快速开始

### 部署

#### 后端

| Profile | 运行时 | 数据库 | 对象存储 | 队列与工作流 |
| --- | --- | --- | --- | --- |
| A — Cloudflare | Cloudflare Workers | D1 | R2 | Queues、Workflows |
| B — 自托管 | Node.js 24 LTS | PostgreSQL 18.x | S3 兼容 | Graphile Worker |

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

### 其他

#### 隐私
