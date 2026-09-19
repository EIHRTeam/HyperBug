**English** | [**简体中文**](README_zh-CN.md)

# HyperBug

[![License: Apache 2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg?style=flat-square&label=License)](LICENSE)
[![Version](https://img.shields.io/github/v/release/EIHRTeam/HyperBug?style=flat-square&label=Version&color=blue)](https://github.com/EIHRTeam/HyperBug/releases/latest)<br>
[![CodeQL](https://github.com/EIHRTeam/HyperBug/actions/workflows/codeql.yml/badge.svg)](https://github.com/EIHRTeam/HyperBug/actions/workflows/codeql.yml)
[![Backend Tests](https://github.com/EIHRTeam/HyperBug/actions/workflows/backend.yml/badge.svg)](https://github.com/EIHRTeam/HyperBug/actions/workflows/backend.yml)
<br>
[![TypeScript 7](https://img.shields.io/badge/TypeScript-7-blue.svg?logo=typescript&style=flat-square&logoColor=white)](https://www.typescriptlang.org/)
[![Elysia 1.4](docs/assets/Elysia-1.4-E34798.svg)](https://elysiajs.com/)
[![Node.js 24 LTS](https://img.shields.io/badge/Node.js-24%20LTS-339933.svg?style=flat-square&logo=node.js&logoColor=white)](.node-version)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-yellow.svg?style=flat-square&logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![PostgreSQL 18](https://img.shields.io/badge/PostgreSQL-18.x-blue.svg?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org/)

> [!IMPORTANT]
> This project is still in early development stage and may contain major defects or breaking changes. Do not use it in production.

A modern, lightweight, cloud-native, serverless-first, GitHub Issues-style issue-tracking platform.

## Documentation

Read the [English documentation](docs/site/index.md) or [简体中文文档](docs/site/zh-CN/index.md). The guides are still outlines. The [VitePress site workflow](docs/development/DOCUMENTATION.md) covers local preview and GitHub Pages deployment. For the current backend workspace, see [backend development](docs/development/README.md).

## Highlights

## Quick Start

### Deployment

#### Backend

| Profile         | Runtime            | Database        | Object storage | Queue and workflow |
| --------------- | ------------------ | --------------- | -------------- | ------------------ |
| A — Cloudflare  | Cloudflare Workers | D1              | R2             | Queues, Workflows  |
| B — Self-hosted | Node.js 24 LTS     | PostgreSQL 18.x | S3-compatible  | Graphile Worker    |

#### Frontend

### Development

```sh
git clone git@github.com:EIHRTeam/HyperBug.git
cd HyperBug
pnpm install --frozen-lockfile
pnpm dev            # Run the API and static frontend locally
pnpm test           # Unit, contract, and integration tests
pnpm lint           # Lint and formatting checks
pnpm typecheck      # Strict type checking across the workspace
pnpm build          # Build API and static frontend artifacts
```

Run `pnpm run` to view the complete script list, including formatting, migration, and profile-specific integration test commands. Migrations are applied through the workspace migration command for the selected profile, delegating to the D1 migration adapter or PostgreSQL migration set. All dependencies are pinned by the committed lockfile, and lifecycle install scripts are restricted by policy.

```text
repo/
├── apps/
│   ├── web/              # Static SPA, independently deployed
│   ├── api-cloudflare/   # Workers entry point
│   └── api-node/         # Node 24 entry point
├── packages/
│   ├── contracts/        # Public DTOs, REST/OpenAPI docs, generated API client
│   ├── domain/           # Entities, invariants, policies
│   ├── application/      # Use cases and application services
│   ├── server/           # Shared Elysia routes and middleware
│   ├── security/         # Cryptography, tokens, sanitization, audit, abuse controls
│   ├── database/         # Contracts plus D1 and PostgreSQL adapters
│   ├── blob/             # Contracts plus R2 and S3 adapters
│   ├── queue/            # Contracts plus Cloudflare and Graphile adapters
│   ├── workflow/, search/, plugin-api/, observability/
└── tooling/
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## Legal

### Copyright

Copyright © 2026 Endfield Industries Human Resource Team, licensed under the [Apache License Version 2.0](LICENSE).

### Other

#### Privacy
