# 托管静态前端

[文档首页](../index.md)

**适用读者：** 评估静态前端基础的运维人员。
**目标：** 独立于 API 托管同一构建，并在不重新构建的情况下替换公开配置。

当前基础提供概览页和实例能力页。登录和议题工作流属于后续增量。通用托管和临时 Pages 预览已连接本地 Node 公开端点验证。后端验收 G1 和发布验收仍未完成；这不是生产发布，也不是完整的后端兼容性矩阵。

## 构建与检查

在仓库根目录使用锁定的 Node 24 和 pnpm 11 版本：

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm --filter @hyperbug/web typecheck
corepack pnpm --filter @hyperbug/web lint
corepack pnpm --filter @hyperbug/web format:check
corepack pnpm --filter @hyperbug/web build
```

产物位于 `apps/web/dist/`：静态 HTML、外部 CSS/JavaScript、懒加载路由和带哈希的资源。React Compiler 在构建时运行。Oxlint 检查 React Hooks 和 JSX 可访问性；执行 `corepack pnpm --filter @hyperbug/web format` 可使用 oxfmt。

无需 SSR、Pages Functions 或 API 代理。若工作站使用 pnpm 常规虚拟存储布局，在 `pnpm` 后添加 `--config.enable-global-virtual-store=false`；不要为解决本地布局不匹配而修改全局设置。

## 提供公开运行时配置

创建部署专用文件，例如 `frontend-config.json`：

```json
{
  "schemaVersion": 1,
  "applicationName": "My HyperBug",
  "apiBaseUrl": "https://api.example.net",
  "authBaseUrl": "https://auth.example.org",
  "mediaOrigins": ["https://media.example.com"]
}
```

所有值均为公开信息。不得包含凭据、令牌、密钥或可执行插件配置。来源须使用 HTTPS，不能包含凭据、路径、查询参数或片段；本地开发允许回环地址 HTTP。名称须非空且最多 100 个字符；最多接受 16 个互不重复的媒体来源。未知字段和超过 16 KiB 的响应会被拒绝。

```sh
corepack pnpm --filter @hyperbug/web prepare:deployment --config=/absolute/path/frontend-config.json
```

此命令替换 `dist/config.json`，生成与托管平台无关的 `hosting.json` 及 Pages `_headers`/`_redirects`，不会重新构建资源。入口先获取配置，再创建 API 客户端；配置缺失或无效时显示安全的启动错误。

更改来源时，应重新生成并同时发布响应头与配置。只替换配置会保留旧 CSP 权限。后端精确 CORS 允许列表必须包含前端来源。源码默认配置使用 example.net 占位来源；请替换为实际部署配置。

## 通用静态托管

```sh
corepack pnpm --filter @hyperbug/web serve --port=4173
```

打开 `http://127.0.0.1:4173/instance?section=limits`。此回环地址服务器演示托管策略，不是加固的生产服务器。使用其他静态托管时，将 `hosting.json` 应用为 HTTP 响应策略，设置正确 MIME 类型，并将应用路由回退到 `/index.html`。隐藏托管元数据和 `.vite/manifest.json`。

| 资源 | Cache-Control |
| --- | --- |
| HTML 及其他未版本化文件 | `no-cache` |
| `/config.json` | `no-store` |
| 带哈希的 `/assets/*` | `public, max-age=31536000, immutable` |

CSP 允许应用脚本、样式及配置中精确指定的 API、认证和媒体来源；插件来源须经构建时审查。没有 unsafe-inline/eval。其他响应头禁止框架嵌入和 MIME 嗅探，设置引用来源策略，并限制相机、麦克风和定位。在托管边界配置 TLS。

## Cloudflare Pages 预览

使用明确授权的预览项目。准备配置后，将同一目录部署到与项目生产分支不同的分支：

```sh
corepack pnpm exec wrangler pages deploy apps/web/dist --project-name=YOUR_PREVIEW_PROJECT --branch=foundation
```

Pages 使用生成的响应头和重定向；没有 Functions 目录。请保留 `! Cache-Control`：它先解除重叠的默认值，再设置配置和资源覆盖值。测试精确预览来源的 CORS。使用一次性项目，并在评估后清除其全部自有资源。

## 验证与回滚

在两个托管环境打开 `/`，并直接刷新 `/instance?section=limits`。确认名称和能力来自选定 API，配置先于首次 API 请求完成，不可用能力保持不可用。替换配置并重新生成响应头后刷新，确认名称与 API 来源更新、资源哈希不变。检查 HTML、配置和资源的实际响应头。

当前基础不存储浏览器凭据。登录、过期和注销、用户缓存隔离，以及完整的键盘、屏幕阅读器、触摸和浏览器验收仍待完成。回滚时一起恢复匹配的构建、公开配置和托管策略；保留已打开页面所需的带哈希资源。

## 参考依据

[静态 Web 计划](https://github.com/EIHRTeam/HyperBug/blob/main/docs/plan/modules/11-static-web-foundation.md)；[P1 证据](https://github.com/EIHRTeam/HyperBug/blob/main/docs/plan/evidence/11-p1-foundation.md)；[发布检查清单](https://github.com/EIHRTeam/HyperBug/blob/main/docs/plan/modules/13-mvp-release-and-operations.md)。
