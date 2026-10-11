# 使用公共 API

[文档首页](../index.md)

后端提供版本化 JSON API 和独立于框架的 TypeScript 客户端。契约和客户端已在仓库中提供，但软件包尚未发布到包注册表。后端验收仍未完成，包括尚未测量的 Cloudflare Standard 配置。

## 配置客户端

在工作区中使用 `@hyperbug/api-client`，将 `baseUrl` 设置为独立托管的 HTTPS API 源。通过已注册的 Authorization Code + S256 PKCE 流程取得不透明 Bearer 令牌；浏览器令牌仅保存在内存中。客户端不发送账户会话 Cookie，也不需要前端主机代理。

```ts
import { createApiClient } from '@hyperbug/api-client';
let token: string | null = null;
const api = createApiClient({
  baseUrl: 'https://api.example.com', getToken: () => token,
});
const instance = await api.request('GET /api/v1/instance');
console.log(instance.tier, instance.search.textScope);
```

Minimum 的 `search.textScope` 为 `title`，Standard 为 `title-and-body`。能力文档反映实际层级、密码和降级行为，并不授予权限。

## 分页、写入与错误

使用各操作的类型化 params/body/query。原样传递不透明分页游标；更新时包含当前预期修订号。私有项目和 Staff 操作仍需要服务端授权的成员身份与认证等级。安全读取可有限重试；Issue 提交默认只发送一次，只有显式启用文档所述幂等回执、并使用同一个键和完全相同的请求内容时才允许重试。结果不确定时，先核对已有提交再发送新请求。

用 `signal` 取消请求，用 `timeoutMs` 设置整个操作的期限。`ApiClientError` 提供稳定错误码、状态、关联 ID 和结果不确定标志，不复制私有提供商文本。修订冲突时重新读取资源。

直接使用短期存储能力及其签名请求头上传文件，不携带 API Bearer 或 Cookie。随后通过 API 确认上传；上传成功不代表已扫描或放行。在隔离媒体源上按当前授权获取已放行文件。

## 契约与示例

[OpenAPI 产物](https://github.com/EIHRTeam/HyperBug/blob/feat/v1/packages/contracts/openapi.json)、[客户端源码](https://github.com/EIHRTeam/HyperBug/tree/feat/v1/packages/api-client)及[非浏览器示例与重试规则](https://github.com/EIHRTeam/HyperBug/blob/feat/v1/docs/API-CLIENT.md)说明当前仓库契约。运行 `corepack pnpm api:check` 检测源码漂移。响应使用方需容忍新增属性；破坏性协议变化需要版本化契约决策。
