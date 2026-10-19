# 分诊与管理项目

[文档首页](../index.md)

**适用读者：** 分诊人员、维护者和管理员。  
**目标：** 在所获权限内组织反馈。

## 检查角色

使用项目 ID 打开项目。Staff 可见 **Manage project**；服务器仍逐项检查操作权限。Triage 可组织问题并关闭或重新打开。Maintainer 还可管理分类、表单/模板以及审核和编辑历史。Administrator 管理设置、Staff 成员资格和项目审计访问。敏感管理要求最近经过验证的通行密钥登录，仅密码登录不足。参阅[账号说明](accounts.md)。

## 分诊新反馈

打开问题，展开 **Triage issue**。可用标签、类型和里程碑会显示 ID。以逗号分隔填写标签或 Staff 指派人 ID，类型/里程碑填写单个 ID。留空会清除选择。只能指派符合条件的现有 Staff 主体。关闭时选择适当原因并确认；重新打开需单独确认。时间线记录历史操作，问题标题区域显示当前状态。

编辑使用表单打开时的修订号。发生其他修改或冲突后，选择 **Discard triage edits and reload latest values**，再检查并提交。这会丢弃未保存的分诊值。

## 配置项目

在 **Manage project** 展开相应部分。Maintainer 可创建、编辑或删除标签、类型和里程碑，包括标签颜色、类型说明/图标/颜色/顺序，以及里程碑说明/截止日期。表单接受受支持的 GitHub YAML 子集；替换操作创建不可变版本。模板包含 Markdown。参与者提交反馈时可请求服务器生成的预览。表单过期时必须重新加载并检查当前定义。

Administrator 可确认项目名称/可见性修改或归档项目。设置冲突后，先选择 **Discard draft settings and reload latest values** 再重试。归档和可见性变化会影响其他参与者，请仔细检查确认内容。

## 管理成员与审核内容

Administrator 可为现有 Staff 主体 ID 授予项目角色或移除成员资格。Public User 身份不能获得 Staff 权限。策略指定时必须进行近期身份验证。

评论操作为 Maintainer 提供受限编辑历史和需确认的审核状态修改。隐藏、遮蔽和删除状态会替代普通内容。自己的编辑保留最初修订号，并在冲突后提供明确的丢弃/重新加载方式。不要认为历史内容是公开的。

Administrator 可选择 **Browse project audit trail**。有界分页显示操作、结果、时间和标识符；省略私有审计元数据和请求 ID。该视图不能修改或删除审计记录。

## 管理可信插件

在 **Account → Instance plugins** 中，最近通过通行密钥认证的实例 Administrator 可加载设置并启用/停用已注册插件。公开值使用 JSON 标量。秘密字段只写：读取仅显示是否存在，保存成功后清空输入。再次加载设置可刷新脱敏显示。

原生插件代码以应用权限运行并受到信任；声明权限不是沙箱。页面显示信任/CSP 要求。启用后端插件不会加载远程 JavaScript，也不会改写前端 CSP。停用的插件不提供其可选能力。安装/移除和部署变化遵循运营者流程；此屏幕不安装任意代码。

## 验证范围

各后端配置的本地浏览器流程、上传及失败场景、自动无障碍检查和已报告的手动无障碍矩阵已在记录范围内通过。托管提供商、后端验收及发布门禁仍需单独验证；能力说明必须与运行实例一致。

## 来源

[权限](https://github.com/EIHRTeam/HyperBug/blob/main/docs/API-OPERATIONS.md)；[工作人员流程](https://github.com/EIHRTeam/HyperBug/blob/main/docs/plan/modules/12-web-product-workflows.md)。
