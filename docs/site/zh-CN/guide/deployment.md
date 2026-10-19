# 规划安装

[文档首页](../index.md) · [Cloudflare](deploy-cloudflare.md) · [自托管](deploy-self-hosted.md) · [前端](deploy-frontend.md)

本文对应 2026-10-19 的未发布准备包。本地工作流已有验证；后端 G1、MVP G2 和真实 Free 计划的 13.G6 仍未通过。准备包不代表生产验收。

## 选择配置

| 配置 | 运行时、数据与任务 | 验证范围 |
| --- | --- | --- |
| Cloudflare Standard | Workers、D1、R2、Queues、Workflows | 原生本地 workerd/D1/R2 与历史托管组件片段；付费 Standard 尚未测量 |
| 自托管 | Node 24.21.0、PostgreSQL 18.6、S3、Graphile Worker | 真实一次性本地 PostgreSQL/S3 与浏览器夹具；没有生产代理认证 |
| Cloudflare Minimum | 显式 `cloudflare-minimum` / `minimum-v2`，D1/R2 与有界 Cron | 本地完整流程及有限真实 Free 账号观察；实例上限与完整验收未验证 |

Workers + PostgreSQL/Hyperdrive 不在保证范围内。“兼容 S3”本身不是支持承诺。

## 已测存储矩阵

| 提供方与版本 | 已测特性 | 限制 |
| --- | --- | --- |
| SeaweedFS 4.48，官方发行归档 SHA-256 `faa194e72a346755dc4404288b0561eb3c260351702901d8363024d5099bdd7d` | PUT/GET/HEAD/DELETE、元数据与类型、条件创建、签名 PUT/GET/分片、校验和拒绝、分片完成/中止/发现、有界流式传输、隔离旧对象恢复 | 真实本地服务；显式选择仅 upload-ID 的分页兼容模式。不推断其他版本或提供方 |
| Cloudflare R2 托管服务（没有可固定的服务端版本） | 历史证据中的真实绑定/S3 签名、CRUD/分片/发现、精确 CORS 协议及自有夹具恢复 | 当前产品的生产扫描器、桥接、CORS 安装及付费托管集成仍需单独验收 |
| 本地 R2/S3 模拟 | 原生夹具绑定与产品浏览器生命周期 | 仅模拟器证据，不是提供方认证 |
| 其他 S3 服务或版本 | 未测 | 列入支持前须运行兼容套件 |

## 能力与降级矩阵

| 能力 | Standard / 自托管 | Minimum |
| --- | --- | --- |
| 密码 | Argon2id，源码最低参数 19 MiB / 2 次 / 1 通道 | FREE-01：带 pepper 的 PBKDF2-HMAC-SHA256，新记录 50,000 次 / 已存最高 100,000 次；离线保护较弱 |
| 准入 | 主库身份检查与近似削峰 | FREE-02：按位置近似削峰，加上必需的 D1 计数与锁定 |
| 后台任务 | Queues/Workflows 或 Graphile/PostgreSQL | FREE-03：D1/Cron、有界重试与检查点；不承诺超过 24 小时的队列持久性 |
| 日志与审计 | 必需审计完整，诊断独立 | FREE-04：保留较短；Workers Logs 3 天，无 Logpush/OTLP 导出 |
| 容量与搜索 | 有界标题加正文搜索 | FREE-05：仅标题搜索及配额上限；实例容量未验证 |
| 邮件 | 提供方插件，当前 Core 不提供投递 | FREE-06：任意收件人需要运营者的 TLS SMTP 中继；模块 16 实现尚不可用 |
| 恢复 | 目标须按部署测量 | FREE-07：D1 Time Travel 7 天，无日志导出；须有独立测量目标 |
| 批量与任务 | 仅已实现能力合约；后续产品功能仍延后 | FREE-08：批量、导入/导出与长任务禁用或限额 |

升级 Workers Paid 不会自动切换配置。须显式选择 Standard、移除确认、配齐绑定并重建标题与正文索引。PBKDF2 验证成功后登录时升级为 Argon2id。降级前盘点 Argon2id 凭据，准备通行密钥、恢复码或符合条件的重置；Minimum 无法验证 Argon2id。不得降低已有成本以强行迁移。

所有配置都必须保留对象授权、失败关闭验证、完整必需审计、内容净化/CSP、TLS/HSTS、带密钥凭据摘要、AES-256-GCM 信封加密及仅内存浏览器令牌。数据库与 pepper 同时泄露后的离线猜测风险无法由在线控制抵消。

## 域名、配额与发布配对

规划独立前端、API/授权与隔离媒体/存储来源；设置精确回调、CORS 及完整通行密钥 RP。机密仅放后端私有挂载或绑定。前端资源、配置与生成的 CSP 一起发布；预览必须显式配对隔离 staging API，本准备包不会创建 staging。

2026-10-19 复核的提供方事实：Free CPU 每次 10 ms、每日请求 100,000，D1 每日读取 500 万行/写入 100,000 行、每库 500 MB，Queues 每日 10,000 操作且保留 24 小时，Workers Logs 每日 200,000 事件且保留 3 天，D1 Time Travel 7 天。它们是账号上限，不是应用容量承诺。为诊断、其他服务及来源不明流量留出余量。参见 [Cloudflare 运维](deploy-cloudflare.md) 与 [恢复](operations.md)。

[当前发布证据](https://github.com/EIHRTeam/HyperBug/blob/feat/v1/docs/plan/evidence/13-release-readiness.md)区分准备产物、本地演练及缺失的部署验收。
