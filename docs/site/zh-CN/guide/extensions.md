# 开发与管理扩展

[文档首页](../index.md) · [公共 API](api.md) · [安全](security.md)

原生插件是受信任的应用代码，拥有进程的实际权限。清单权限描述审核意图，并不是沙箱。插件提供机制，不能削弱 Core 授权、验证、限流、必需审计、加密、内容净化或 CORS。任意不可信代码托管仍延后。

## 面向公开 SDK 编写

使用工作区 `@hyperbug/plugin-sdk`，其版本独立于 Core 与 Plugin API。它导出 `definePlugin`、清单/设置 schema、生命周期判断、hook 信封、签名事件/能力合约及 CSP 描述。该包尚未发布到注册表。插件不得导入宿主运行时或服务器内部实现。

真实[最小示例](https://github.com/EIHRTeam/HyperBug/blob/feat/v1/tests/fixtures/plugins/example-notifier.ts)定义 `@hyperbug/example-notifier`、版本 `1.0.0`、信任级别 `trusted-native`、API 范围 `^1.0.0`、`notifications:deliver` 与 `events:publish`。`definePlugin` 在编写/构建时拒绝无效清单。该测试示例只回显接受的信封，不代表已安装邮件通知器或消息已投递。

精确字段与协议限制见[作者入门](https://github.com/EIHRTeam/HyperBug/blob/feat/v1/docs/EXTENDING-PLUGINS.md)及[版本化规范](https://github.com/EIHRTeam/HyperBug/blob/feat/v1/docs/PLUGIN-SPEC.md)。仓库插件单元/合约及双运行时持久化/hook 套件验证生命周期、权限、设置、信封与失败路径。

## 配置与管理

实例管理员需要当前权限及最近验证的通行密钥。先注册兼容清单；注册本身不运行插件代码。填写公开值与只写机密，必需配置完整后才能启用。读取仅返回机密是否存在，不返回值；管理 UI 提交后清空机密。集成进后端前审核原生代码及构建来源。

升级前停用，保留 ID 并提高版本。停用保留配置/数据并阻止新调用。卸载必须显式选择保留或删除插件命名空间数据。检查保留任务、机密及备份；不要以为卸载能撤销外部副作用或删除 Core 历史。

## 安全处理任务与 UI

同步安全 hook 有正文、期限与并发上限，且失败关闭。延后事件仅携带引用，通过 outbox 至少一次投递，检查当前注册/权限并使用稳定投递身份。下游应支持幂等；若提供方缺少幂等 API，副作用发生后崩溃可能产生重复。重放必须通过受信任授权运营集成，不能任意修改队列。

外部服务使用有作用域的签名合约及新鲜度/重放检查，不获得任意 Core SQL。UI 插件是审核的构建时描述，CSP 来源精确声明。公开运行时配置不能加载代码或脚本；远程脚本 URL 不是运行时安装机制。

SMTP/邮件、SSO 提供方、代码托管连接器及其他具体集成仍属于模块 16。清单词汇或示例存在不代表已安装。Core 无需邮件插件即可使用已实现的通行密钥/恢复码账号恢复路径。
