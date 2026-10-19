# 安装自托管配置

[文档首页](../index.md) · [兼容矩阵](deployment.md) · [运维](operations.md)

已测本地组合为 Node 24.21.0、PostgreSQL 18.6、SeaweedFS 4.48 与锁文件中的精确 Graphile Worker 依赖。这是未发布的准备包；生产 TLS/代理及部署验收仍独立进行。

## 准备冻结产物

在仓库根运行 `corepack pnpm install --frozen-lockfile`，然后 `corepack pnpm build`。运行 `node dist/node/index.mjs`，同时保留固定的工作区依赖和静态资源。单个 JS 文件不是完整发行包。输入映射见 `deploy/node/README.md`；不需要 Redis、RabbitMQ 或独立 worker CLI。

显式设置 `HYPERBUG_ENV` 与精确 HTTPS `ALLOWED_ORIGINS`。使用 `node tooling/check-deployment.ts node deploy/node/public-policy.example.json` 检查公开模板。JSON 示例是公开策略，不会自动载入环境；通过进程管理器注入并替换示例域名。无效策略拒绝启动；离线检查不能证明密钥或提供方就绪。

## 数据库、密钥与管理员

使用验证 TLS 的 `HYPERBUG_DATABASE_URL`，或绝对路径 `HYPERBUG_DATABASE_SOCKET_DIR` 配合 `HYPERBUG_DATABASE_NAME`、`HYPERBUG_DATABASE_USER`。单独提供迁移所有者 `HYPERBUG_MIGRATION_DATABASE_URL` 后，可运行 `node tooling/migrate-postgres.ts --status` 与 `--apply`。连接凭据不得进入参数或 Git。已应用历史不可改；失败迁移的语句与历史一起回滚。

运行 `node tooling/provision-operator-files.ts /absolute/new/private/directory` 生成私有文件。将归属当前用户、权限 0400/0600 的文件挂载为 `HYPERBUG_KEY_FILE`、`HYPERBUG_ABUSE_KEY_FILE` 及初始 `HYPERBUG_BOOTSTRAP_FILE`。按[运维](operations.md)中的审计注册表命令激活公开引用，再使用第一方初始化注册接口。生成工具不打印机密。注册通行密钥、离线保存恢复码，成功后移除初始化挂载。仅密码登录不能进行敏感实例管理。

注册公开客户端 `hyperbug-web`，精确回调为前端 `/oauth/callback`，作用域为 `public-api`。完整配置 `PASSKEY_RP_ID`、`PASSKEY_RP_NAME`、`PASSKEY_ORIGIN`。没有客户端机密。原生插件是受信任后端代码，必须审核；不得削弱 Core 策略或向 SPA 注入任意运行时代码。

## 存储与网络边界

可选挂载 `HYPERBUG_UPLOAD_STORAGE_FILE`，包含仅后端可见的 endpoint、bucket、region、`forcePathStyle` 与凭据。非本地存储使用 HTTPS。已测 S3 实现是 SeaweedFS 4.48，不能推断其他提供方或版本。放行文件前配置精确上传 CORS、隔离 `HYPERBUG_MEDIA_ORIGIN` 与受信任扫描。未使用上传时省略挂载；部分或无效配置失败关闭。

用显式 `HOST`/`PORT` 将 Node 绑定回环，置于验证的 TLS 终结器后，或配置现有私有 `HYPERBUG_TLS_FILE` 原生 TLS。即使有代理，当前远程媒体仍要求 Node 原生 TLS。检查所选终结器的证书/主机名、HSTS、直连监听隔离、正文/时间限制与客户端 IP 来源。Node 使用原生对端并忽略不可信转发头；有代理不等于已验证真实客户端准入。本地证据没有认证生产反向代理包。

## 进程、关闭与恢复

API 与 Graphile 任务同进程运行，使用所选连接池初始化 Graphile schema；独立最小权限 worker 角色部署尚未认证。SIGTERM/SIGINT 关闭上传与 HTTP，等待活动派发，停止 Graphile runner、释放工具并结束连接池。强杀前提供按实际测量设置的宽限。重启后协调持久待办与检查点；外部副作用仍需幂等。

检查 `/health/live`、`/health/ready`；就绪只验证前提，还须验证真实授权允许/拒绝、问题读取、outbox 副作用及附件状态。缺失密钥、主库/审计失败或完整性不符即停止。[运维](operations.md)区分兼容应用回退与前向迁移/恢复，协调数据库、对象、配置与密钥版本，记录本地恢复测量限制。前端主机不得暴露私有归档、源码映射、密钥或运营工具。
