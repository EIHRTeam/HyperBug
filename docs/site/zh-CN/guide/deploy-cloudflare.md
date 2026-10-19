# 安装 Cloudflare 配置

[文档首页](../index.md) · [提供方与配置矩阵](deployment.md) · [运维](operations.md)

这是未发布的部署准备指南。付费账号上的 Standard 尚未测量；本地与 Free 结果不能替代其验收。

## 准备资源与绑定

使用 `apps/api-cloudflare/wrangler.jsonc`、`wrangler-ingress.jsonc` 源模板及 `deploy/cloudflare/README.md` 绑定映射。在忽略的运营目录复制，解析入口/迁移的绝对路径，选择独立资源名/ID 与精确来源。API 保持私有，关闭 workers.dev 与预览；仅暴露受控入口，其 `API` 服务绑定连接后端，两端使用同一 256 位 base64url `HYPERBUG_INGRESS_KEY`。

Standard 需要 D1 `DB`；选择上传时配对 R2 `HYPERBUG_UPLOAD_BLOB` 与后端签名机密；还需要 `ASYNC_TASKS` Queue 生产者/消费者、`ASYNC_WORKFLOW`（`HyperBugWorkflow`）。保留五分钟 Cron、兼容标志及 `ABUSE_VOLUMETRIC`。Minimum 使用独立 `src/minimum.ts`，显式设置 `HYPERBUG_DEPLOYMENT_TIER=cloudflare-minimum`、`HYPERBUG_DEGRADATION_ACK=minimum-v2`，移除 Queue/Workflow 绑定，遵守 D1/Cron 限制。命名环境须重复不可继承的绑定。

## 配置与验证

运行 `node tooling/provision-operator-files.ts /absolute/new/private/directory` 生成私有运营文件。将密钥/滥用密钥内容通过 Worker Secrets 提供给 `HYPERBUG_KEY_RING` / `HYPERBUG_ABUSE_KEY_RING`。启用账号前，经现有受信任 KeyRegistry 集成审计激活公开密钥引用。初始化使用机密 `HYPERBUG_BOOTSTRAP_ENROLLMENT`，不是普通变量。不得复制夹具测试材料。配置 Turnstile 时必须完整提供机密、站点密钥及主机名；公开测试密钥仅限本地。

用 `node tooling/check-deployment.ts cloudflare deploy/node/public-policy.example.json` 检查公开策略。获授权上线前，用已安装 Wrangler 对精确私有配置执行 dry-run。使用 `corepack pnpm exec wrangler d1 migrations list <selected-db> --remote --config <private-config>` 检查；对应 `migrations apply` 仅在获授权上线时运行。本地演练始终使用 `--local` 和独立持久化目录。本准备过程不执行生产/staging 远程迁移。

Worker Secrets 可通过已安装的 `wrangler secret put <binding> --config <private-config>` 私有提示或文件输入提供；不得打印值或放入进程参数。仅在单独获授权后先部署私有 API，再部署入口。验证精确主机名证书、就绪状态、第一方初始化/通行密钥、注册的 `hyperbug-web` 回调及真实 bearer 权限。无法唯一归因原生事件的 403 必须停止，不应重试或改动边缘策略。

## 前端、媒体与恢复

将[静态构建](deploy-frontend.md)独立托管到 Pages 或通用静态服务器。精确 CORS 必须包含实际前端；上传 CORS 只允许审核的方法/请求头并暴露 ETag。媒体使用隔离来源、当前授权与安全下载头。存储凭据不得进入公开配置；上传成功不代表扫描或放行。生产扫描桥接、隔离及更新仍需单独验收。

上线前记录资源 ID、版本、公开配置及必需历史密钥的访问。区分本地、真实 Free 与付费证据。遵循[恢复流程](operations.md)，完整性、授权、审计或 CPU 失败即停止；评估结束后删除所有自有临时资源。本任务不部署 staging，不发布 Pages 或生产。

## 后台能力限制

Minimum 异步基础的失败记录、重放、保留策略、检查点和能力上限机制已通过验证。新的原生 Cron 测试调用完整调度方法：已提交检查点后的中断测得 9 毫秒 CPU，重新部署后的恢复测得 6 毫秒，最大长度规范 Issue 的分发测得 9 毫秒。已提交步骤没有重复执行，待处理事件在恢复期间得以保留。此前测试中的原生配额拒绝和恢复分别测得 2 和 4 毫秒。清理保留了原有数据和资源，并移除了所有本次创建的工作与资源。这些针对性测量符合保持不变的 10 毫秒目标，但不能证明完整生产部署的持续性能；Workers Free 方案由用户确认，计费归属仍无法独立验证。

实例能力文档会报告后台模式、分发批量和任务步骤上限。Minimum 使用带检查点的 D1/Cron 执行器：在对应阶段处理一个事件或一个任务步骤，每个任务最多四步，检查点最多 1,024 字节。现有的五分钟 Cron 轮换五个阶段，因此每个阶段每 25 分钟运行一次。批量操作、导入/导出和长时间任务仍不可用。Minimum 不需要 Queue 或 Workflow 绑定。

异步工作每天预留独立的 D1 配额：150 万次行读取和 30,000 次行写入。预留被拒绝时保留待处理工作，并报告积压时长。每次调用最多执行 45 条 SQL 或合计子请求，其中包含诊断余量。这些配额不代表整个账户的用量，也不保证符合 Free CPU 验收要求。

`ASYNC_ORPHAN_RETENTION_SECONDS` 默认为上传意图到期后 86,400 秒（范围 3,600–31,536,000）。`ASYNC_TERMINAL_RETENTION_SECONDS` 默认为 2,592,000 秒（范围 86,400–31,536,000）。失败事件在终态保留窗口内可重放；到期时以原子操作终止其源事件并删除失败元数据。待重试的事件会保留。授权重放与恢复请参阅内部异步处理运行手册。独立的 Minimum 发布验收门禁仍未通过。

## 搜索容量

Cloudflare Minimum 仅搜索 Issue 标题。Cloudflare Standard 搜索标题和规范的纯文本正文。结构化筛选仍可用；Issue 正文和评论保留现有内容长度限制。实例能力文档中的 `search.textScope` 为 `title` 或 `title-and-body`。

切换配置时，先停止使用旧搜索模式的调度器，再通过现有的授权管理员服务逐页重建派生索引。按返回的游标继续；Minimum 每页最多处理十个文档。重建完成前，搜索返回 `SEARCH_INDEX_INCOMPLETE`。回滚时也须重新重建。旧 Minimum 搜索游标返回 `CURSOR_STALE`，应重新开始搜索。这项容量缩减已通过本地语义检查和针对性原生异步 CPU 与恢复验证；整个配置的性能与发布验收仍未完成。Free 提供商的 10 ms 上限和独立发布验收门槛保持不变。
