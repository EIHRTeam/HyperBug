# HyperBug 文档

[English](../index.md) | **简体中文**

HyperBug 是一个面向公众反馈与项目分诊的开源问题跟踪平台。请从你想完成的任务开始阅读。

> 这些读者指南目前只是初步骨架，并非已发布产品的完整手册。仓库现已具备后端和持久化基础；产品流程、完整 API 和静态 Web 应用仍在规划中。请查看[当前实现进度](https://github.com/EIHRTeam/HyperBug/blob/main/docs/plan/PROGRESS.md)。本文档尚未验证完整产品的生产安装流程。

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
| 查看发布变更与兼容性 | [发布说明提纲](guide/releases.md) |

## 参与当前开发

对于现有后端工作区，请阅读[后端开发](https://github.com/EIHRTeam/HyperBug/blob/main/docs/development/README.md)、[工具链证据](https://github.com/EIHRTeam/HyperBug/blob/main/docs/development/TOOLCHAIN.md)和[开发迁移](https://github.com/EIHRTeam/HyperBug/blob/main/docs/development/MIGRATIONS.md)。这些工程资料描述当前基础设施，不是完整产品部署指南。另请参阅[贡献指南](https://github.com/EIHRTeam/HyperBug/blob/main/CONTRIBUTING.md)。工程资料保留英文。

## 了解设计与路线图

- [API 约定](https://github.com/EIHRTeam/HyperBug/blob/main/docs/API-CONVENTIONS.md)、[资源与权限清单](https://github.com/EIHRTeam/HyperBug/blob/main/docs/API-OPERATIONS.md)、[数据模型](https://github.com/EIHRTeam/HyperBug/blob/main/docs/DATA-MODEL.md)和 [Markdown 策略](https://github.com/EIHRTeam/HyperBug/blob/main/docs/MARKDOWN-POLICY.md)属于规范，不代表描述的所有操作都已可用。
- [实现计划](https://github.com/EIHRTeam/HyperBug/blob/main/docs/plan/README.md)、[总体进度](https://github.com/EIHRTeam/HyperBug/blob/main/docs/plan/PROGRESS.md)和[来源决策](https://github.com/EIHRTeam/HyperBug/blob/main/docs/plan/SOURCES.md)记录范围、证据与门禁。
- MVP 涵盖公众反馈、讨论、分诊、表单、附件、搜索和扩展基础。问题关联、保存视图、订阅、通知、批量与数据任务及具体服务商集成属于后续增量。AI 和实时协同编辑仍暂缓实现。

## 完善这些指南

`guide/` 下所有页面目前均标记为“仅为提纲”。标题定义预期阅读顺序，“待补充”文字说明后续需要撰写的内容。每篇都记录了读者、目标、依据和完成条件。

只有在行为实现并验证后，才能用操作步骤替换提纲。完整指南应包含前置条件与权限、编号操作步骤和预期结果、常见失败的恢复方法、相关资料，以及验证所用版本和环境。使用实际界面名称和安全示例；截图必须来自已实现的产品。

实现与安全策略仍由权威规范维护，这里解释用户可见的影响。发布前核实命令、API 示例、配置字段、支持联系方式、服务商兼容性和链接，不用假设的命令或截图填补空白。读者文档同时维护英文和简体中文版本，页面路径和范围保持对应，修改时同步更新。工程规范、计划和会话记录仍使用英文；产品本身的本地化是独立事项。

文档准备工作归属[模块 13.3d](https://github.com/EIHRTeam/HyperBug/blob/main/docs/plan/modules/13-mvp-release-and-operations.md)，详见[会话记录](https://github.com/EIHRTeam/HyperBug/blob/main/docs/plan/progress/13-mvp-release-and-operations.md)。本骨架不代表任何发布检查项完成，也不开放任何实现门禁。
