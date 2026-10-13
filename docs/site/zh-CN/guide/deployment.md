# 规划安装部署

[文档首页](../index.md)

> 状态：仅为提纲。产品操作步骤和示例有待实现与验证。

**适用读者：** 部署运维人员。  
**目标：** 选择后端配置，并了解独立托管的前端。

## 选择后端配置

待补充：说明两种必需配置：Workers/D1/R2/Queues/Workflows，以及 Node 24/PostgreSQL 18.x/S3 兼容存储/Graphile Worker。这些是架构目标，并非生产兼容性证明。

## 规划域名与配置

待补充：编写前端、API、授权服务和媒体域名、TLS、精确来源白名单、密钥及公开运行时配置的说明。

## 安装与初始化

待补充：链接两种配置的提纲，预留经过验证的版本选择、数据库迁移、初始管理员设置和冒烟检查。

## 检查兼容性与就绪状态

待补充：预留经测试的服务商、版本和功能矩阵，以及发布产物、资源配额和已知限制。Workers 搭配 PostgreSQL/Hyperdrive 不在保证支持的配置之内。

## 完成条件

两种配置均完成全新安装验证，配置、初始化和所用服务商版本均有记录。

## 参考依据

[发布检查清单](https://github.com/EIHRTeam/HyperBug/blob/main/docs/plan/modules/13-mvp-release-and-operations.md); [运行时决策](https://github.com/EIHRTeam/HyperBug/blob/main/docs/decisions/0001-runtime-foundation.md).
