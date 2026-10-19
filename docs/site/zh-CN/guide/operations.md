# 升级、备份与恢复

[文档首页](../index.md) · [安装](deployment.md) · [安全](security.md)

这些流程已在一次性本地服务的记录范围内准备并演练，不是生产恢复目标。准备包未发布，G1/G2 未通过，真实 Free 验收仍开放。

## 准备维护窗口

记录源码/产物摘要、运行时与提供方版本、公开配置、已应用迁移前缀和必需密钥引用。排空写入、全部派发器及原生插件副作用，确定跨资源一致性点。另存当前撤销记录以及旧的兼容应用、配置与头策略。预览前端不得自动连接生产。

使用 `node tooling/check-deployment.ts node deploy/node/public-policy.example.json` 验证公开策略；Cloudflare 运行时改用 `cloudflare`。启动及实时就绪检查仍需单独验证绑定、私有材料及主库可用性。健康状态不是认证后的冒烟检查。

## 安全升级与回退

PostgreSQL 运营者通过私有环境显式提供 `HYPERBUG_MIGRATION_DATABASE_URL`，运行 `node tooling/migrate-postgres.ts --status` 检查不可变迁移历史；仅在获授权窗口执行 `--apply`。D1 必须选定精确私有配置/数据库，再用已安装 Wrangler 列出/应用迁移；本地演练使用 `--local`。不得将本地占位 ID 用于远程。

兼容的增量变更先迁移数据库，检查旧读写程序，再替换后端/worker，最后独立发布前端及生成的 CSP/缓存策略。不兼容变更须停止旧写入并采用审核的维护顺序。失败后先检查状态/历史再重试。未提交迁移可回滚；已提交不可逆变更需要前向修复或协调恢复。应用回退只恢复兼容产物/配置，不会撤销数据迁移。搜索模式切换还须停止旧派发器并重建所选索引。

## 协调捕获与恢复

捕获前通过现有审计注册表的 `begin-backup` 固定保留密钥版本，完成后调用 `finish-backup`。保留数据库记录、引用的不可变/暂存对象字节及身份、公开配置，以及独立可恢复的机密版本。备份过期不自动解除密钥固定；须满足保留期并确认全部副本销毁。数据库快照不包含对象存储或机密管理器材料。

PostgreSQL 18 自定义归档使用 `pg_dump --format=custom --file=<private-archive> <database>`；在隔离空库用 `pg_restore --exit-on-error --no-owner --no-privileges --dbname=<isolated-database> <private-archive>` 恢复。私有连接通过环境提供。数据库转储不含集群角色/表空间，须单独保留审核的配置清单。托管 D1 使用导出或 Time Travel；Free 仅保留七天，不克隆数据库，也不恢复对象、配置或密钥。

本地演练在物理 SQLite 备份/恢复前停止模拟器。Miniflare 5 使用 `resourcePersistencePath`；旧的 `d1Persist` 输入会被丢弃。替换快照前，仅对停止且自有的一次性数据库移除旧 WAL/SHM，否则较新页面可能继续生效。这是本地文件系统流程，不是托管 D1 恢复命令。

隔离恢复后验证全部捕获行、schema/历史/外键、问题/时间线/outbox/回执关联、附件大小/SHA-256/内容、公开配置摘要、备份密钥固定及加密读取。对外服务前重新协调捕获后的全部撤销。验证期间禁用外部投递。明确计算捕获后的写入损失，不能宣称零丢失。

## 运营恢复与监控

密钥配置、计划轮换与紧急撤销使用受信任的审计 KeyRegistry 集成，不通过公开 HTTP 维护接口。私下生成文件，账号启用前激活引用。轮换时保留 current/previous/required 版本，按预期修订重新封装或迁移，再移除无引用版本。泄露时立即撤销，并验证下一次请求被拒绝；旧库恢复后也一样。按策略隔离保留备份密钥，不得让已撤销密钥重新可读。

敏感管理须检查当前权限与最近验证的通行密钥。经现有审计管理 API 撤销项目角色或暂停主体，主库下次验证即拒绝旧凭据。恢复码仅兑换一次；没有强制密码设置或实例角色管理 API。不满足初始化前提时，不得删除 Staff 或历史强行重新初始化。

失败投递使用受信任 `replayFailedTask`，携带新的运营授权与精确来源/投递身份。重置前验证提供方恢复、当前项目/主体/插件状态及幂等性；待处理工作自动协调。搜索重建使用敏感 `reindexSearch` 并跟随游标，Standard 每页 25 条、Minimum 10 条。读取不会自行重建或绕过不完整索引扫描。计划清理保留活动附件、重试、历史及必需计账；物理缺失确认必须先于配额释放。

使用安全 HTTP 请求 ID、状态、错误码、`component: async` 摘要、最老积压年龄、失败/重试计数及 `deploy/operator-queries.sql` 中的有界主库查询。1001 饱和计数是下界。立即调查授权/密钥/审计失败、连续两个相应阶段周期增长的积压、终止失败及接近分配配额的使用量。这些是告警触发条件，不是测得的 SLO。生产诊断头采样率为 0.1，必需持久审计保持完整。Minimum 每阶段间隔 25 分钟，日志保留三天，不启用 Logpush/OTLP 导出。

队列/提供方中断时保留规范 outbox，执行有界重试/协调；密钥、认证、主库或 CAPTCHA 失败时拒绝依赖操作。存储/扫描失败保留隔离与配额。不得通过禁用 TLS 验证、限流、权限或必需审计恢复可用性。

## 复现本地演练

使用经过校验的 SeaweedFS 4.48 程序。命令创建独立 PostgreSQL 18 集群及 S3 服务，不连接已有数据库：

```sh
HYPERBUG_TEST_SEAWEED=/absolute/path/to/verified/weed \
  node tooling/postgres-test-cluster.mjs node node_modules/vitest/vitest.mjs \
  run --project postgres tests/postgres/operations.test.ts
corepack pnpm exec vitest run --project workerd tests/workerd/operations-rollback.test.ts
```

夹具覆盖带数据的 `0000_foundation` 升级、故意约束失败/修复、冻结旧写入兼容、真实审计密钥激活、数据库/对象/配置/密钥协调备份恢复、故意丢失的捕获后更新及撤销重协调。附件 clean 结果是合成夹具；恢复测试不认证扫描。其他套件验证重放、保留清理、角色撤销、搜索及提供方故障。生产 Node SIGTERM 排空及原生本地 Worker 产物恢复与 schema 恢复分开测量。

[演练证据](https://github.com/EIHRTeam/HyperBug/blob/feat/v1/docs/plan/evidence/13-maintenance-rehearsal.md)记录夹具大小、精确版本、观察到的恢复/关闭时间及失败经验。这些小型本地夹具是可复现基线，不是生产 RPO/RTO、容量承诺或付费 Standard 证据。Minimum 的真实 Free 恢复限制须独立验证。
