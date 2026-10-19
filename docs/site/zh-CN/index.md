# HyperBug 文档

[English](../index.md) | **简体中文**

HyperBug 是一个面向公众反馈与项目分诊的开源问题跟踪平台。请从你想完成的任务开始阅读。

> 这是2026-10-19已准备但未发布的候选手册。产品工作流与本地安装/恢复已有证据；托管后端G1、MVP G2与真实Free的13.G6仍未通过。不宣称生产或GitHub Pages已发布。

## 找到适合你的指南

| 我想要…… | 从这里开始 |
| --- | --- |
| 了解 HyperBug 并找到项目 | [快速入门](guide/getting-started.md) |
| 查找、提交或讨论问题 | [问题指南](guide/issues.md) |
| 了解登录、访问权限与隐私 | [账号与权限](guide/accounts.md) |
| 分诊反馈或管理项目 | [项目管理](guide/project-management.md) |
| 选择安装配置 | [安装概览](guide/deployment.md) |
| 安装 Cloudflare 后端 | [Cloudflare 安装](guide/deploy-cloudflare.md) |
| 安装 Node/PostgreSQL 后端 | [自托管安装](guide/deploy-self-hosted.md) |
| 托管独立静态前端 | [前端托管](guide/deploy-frontend.md) |
| 升级、备份或恢复实例 | [运维指南](guide/operations.md) |
| 开发 API 客户端 | [公共 API 指南](guide/api.md) |
| 开发或管理插件 | [扩展指南](guide/extensions.md) |
| 诊断问题或了解报告方式 | [故障排查与帮助](guide/troubleshooting.md) |
| 查看发布变更与兼容性 | [发布说明](guide/releases.md) |

## 参与当前开发

对于现有后端工作区，请阅读[后端开发](https://github.com/EIHRTeam/HyperBug/blob/main/docs/development/README.md)、[工具链证据](https://github.com/EIHRTeam/HyperBug/blob/main/docs/development/TOOLCHAIN.md)和[开发迁移](https://github.com/EIHRTeam/HyperBug/blob/main/docs/development/MIGRATIONS.md)。这些工程资料描述当前基础设施，不是完整产品部署指南。另请参阅[贡献指南](https://github.com/EIHRTeam/HyperBug/blob/main/CONTRIBUTING.md)。工程资料保留英文。

## 了解设计与路线图

- [API 约定](https://github.com/EIHRTeam/HyperBug/blob/main/docs/API-CONVENTIONS.md)、[资源与权限清单](https://github.com/EIHRTeam/HyperBug/blob/main/docs/API-OPERATIONS.md)、[数据模型](https://github.com/EIHRTeam/HyperBug/blob/main/docs/DATA-MODEL.md)和 [Markdown 策略](https://github.com/EIHRTeam/HyperBug/blob/main/docs/MARKDOWN-POLICY.md)属于规范，不代表描述的所有操作都已可用。
- [实现计划](https://github.com/EIHRTeam/HyperBug/blob/main/docs/plan/README.md)、[总体进度](https://github.com/EIHRTeam/HyperBug/blob/main/docs/plan/PROGRESS.md)和[来源决策](https://github.com/EIHRTeam/HyperBug/blob/main/docs/plan/SOURCES.md)记录范围、证据与门禁。
- MVP 涵盖公众反馈、讨论、分诊、表单、附件、搜索和扩展基础。问题关联、保存视图、订阅、通知、批量与数据任务及具体服务商集成属于后续增量。AI 和实时协同编辑仍暂缓实现。

## 验证与发布范围

全部14条指南路径均有对应英文/简体中文内容。公共API/客户端及插件SDK是工作区产物，未发布到注册表。安装、运营恢复、提供方限制、私密安全报告及发布决策均注明实际验证范围。部署前阅读[发布说明](guide/releases.md)与[运维](guide/operations.md)。

VitePress仅构建此读者目录；工程计划/证据通过仓库链接访问。本地构建不会发布站点。更新时保持语言路径与内容同步；产品本地化是独立事项。生产/staging决策及未通过的后端/Minimum门禁见[当前进度](https://github.com/EIHRTeam/HyperBug/blob/feat/v1/docs/plan/PROGRESS.md)。
