# 发布说明与兼容性

[文档首页](../index.md) · [安装矩阵](deployment.md) · [运维](operations.md)

## 准备中的候选版本 — 2026-10-19

**已准备但未发布。** 本工作没有创建公开发行/tag、注册表包、生产部署或文档发布。私有工作区版本仍为 `0.0.0`。后端 G1 未通过，模块10为 Blocked，全局 G2 未通过，真实 Free 的13.G6仍开放。

产品源码基线为 `9b78e06`。发布准备增加部署输入映射、私有材料生成/公开策略检查、审计运营密钥集成、协调恢复夹具，以及完整双语读者内容。[发布清单摘要](https://github.com/EIHRTeam/HyperBug/blob/feat/v1/docs/plan/evidence/13-release-manifest.json)保留精确源码输入、锁文件/运行时元数据及产物哈希。它是未签名本地元数据，不是受信任签名或托管来源证明。

## 候选版本可用行为

本地流程覆盖公开项目/问题读取、有界结构搜索、模板与 Issue Forms、安全 Markdown 预览/渲染、直传/分片上传、处理/放行状态、讨论/回应、指派/分类、关闭/重开及时间线分页。工作人员可管理项目设置/表单/模板/角色、浏览脱敏审计、管理账号会话及审核的插件配置/生命周期。敏感操作要求当前角色及最近验证的通行密钥；浏览器令牌/草稿仅驻留内存。

这些功能在本地 Node/PostgreSQL 与原生 workerd/D1 配置、静态前端上通过记录范围的验证。[最终候选证据](https://github.com/EIHRTeam/HyperBug/blob/feat/v1/docs/plan/evidence/13-release-readiness.md)区分每条通过、失败、跳过或未运行的检查。此前人工无障碍验收保留原设备/辅助技术范围，不宣称全面 WCAG 或设备认证。

## Minimum 披露与兼容变更

Minimum 须显式选择 `cloudflare-minimum` / `minimum-v2`，从不自动回退。差异为：FREE-01较弱的带 pepper PBKDF2 密码；FREE-02按位置近似削峰加权威 D1 控制；FREE-03有界 D1/Cron 持久性；FREE-04较短日志且无导出；FREE-05容量限制及仅标题搜索；FREE-06需要运营 SMTP，但当前适配器不可用；FREE-07七天 D1 恢复窗口且完整恢复目标尚未独立验证；FREE-08批量/长任务禁用或限额。

实际新密码策略为 PBKDF2-HMAC-SHA256，必需版本化 pepper、每用户16字节随机盐，新记录50,000次、已存最高100,000次。新密码至少12个Unicode码点、最多1,024UTF-8字节并拒绝内置常见密码；范围内较强记录不降低。其离线保护弱于 Argon2id；在线控制无法抵消数据库与 pepper 同时泄露。建议通行密钥。Standard 验证 PBKDF2 登录后升级为 Argon2id；降级无法验证 Argon2id，须先验证恢复准备。

对象授权、完整必需审计、失败关闭验证、净化器/CSP、TLS/HSTS、带密钥凭据摘要、AES-256-GCM 信封加密及仅内存浏览器令牌不可削弱。参见[完整能力/降级矩阵](deployment.md)及 [Free 运维](deploy-cloudflare.md)。今后变更降级清单、密码策略或实际能力时，必须同步更新双语指南与本说明。

搜索模式切换须停止旧派发器并有界重建；旧策略的 Minimum 仅标题游标失效，须重新搜索。现有 SQL 历史不可变（36条D1/33条PostgreSQL），模块13没有新迁移。先前凭据保证等级升级会回填 assurance1，敏感管理须重新验证通行密钥；上线前检查目标历史及升级角色接收者。

## 已知限制与发布阻塞

付费托管 Cloudflare Standard 尚未测量；Minimum 完整 CPU/配额/容量/恢复归因不完整，先前托管实例403原因未明。微型 D1 书签恢复1,423ms、三字节 R2 恢复1,068ms不能证明实例容量、密码适配或生产 RPO/RTO。账单访问不可用，Free 计划为用户声明。staging 负载、生产代理/客户端IP/扫描隔离/桥接/更新验证及发布需要各自获授权环境或操作。

依赖审核保留 Drizzle 嵌套 esbuild0.18.20 中一项中危开发工具公告（`GHSA-67mh-4wv8-2f99`），不得暴露受影响的开发服务器能力。当前审计没有高危/严重公告。这是记录的发现，不是忽略规则，也不表示依赖已修补。发布证据记录范围与处理判断。

已测本地兼容 S3 提供方为 SeaweedFS4.48；其他 S3 服务/版本及 Workers+PostgreSQL/Hyperdrive 不作保证。SMTP/SSO/具体集成、关联、保存视图、订阅、通知、批量/导入导出仍属于后续模块。原生插件是受信任代码，不是沙箱扩展。不承诺邮件投递、生产吞吐量或可用性。

## 升级与发布决策

遵循[运维](operations.md)及[具体发布检查表](https://github.com/EIHRTeam/HyperBug/blob/feat/v1/docs/RELEASE-CHECKLIST.md)：验证精确产物/环境/迁移/备份/密钥，区分应用回退与 schema 恢复，保留当前撤销并执行真实认证冒烟。前端配置与生成头策略一起发布；预览配对隔离 staging。生产及 GitHub Pages 在单独获授权前保持未发布；本地站点构建成功不等于发布。
