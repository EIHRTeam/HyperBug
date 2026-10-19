# Host the static frontend

[Documentation home](../index.md)

**For:** Operators evaluating the static frontend foundation.
**Goal:** Host the same build independently of the API and replace public configuration without rebuilding.

The foundation provides overview, account and instance-capability pages, with sign-in through the authorization service. Module 12 issue and staff workflows are implemented and pass local browser verification across Node/PostgreSQL and both Workers tiers. Generic hosting and a temporary Pages preview were verified against a local Node public endpoint. Backend acceptance G1 and release acceptance remain incomplete; this is not a production release or a complete backend compatibility matrix.

## Build and check

Use the pinned Node 24 and pnpm 11 versions from the repository root:

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm --filter @hyperbug/web typecheck
corepack pnpm --filter @hyperbug/web lint
corepack pnpm --filter @hyperbug/web format:check
corepack pnpm --filter @hyperbug/web build
```

Output is `apps/web/dist/`: static HTML, external CSS/JavaScript, lazy routes and hashed assets. React Compiler runs at build time. Oxlint checks React hooks and JSX accessibility; run `corepack pnpm --filter @hyperbug/web format` for oxfmt.

No SSR, Pages Functions or API proxy is required. On a workstation using pnpm's conventional virtual-store layout, add `--config.enable-global-virtual-store=false` after `pnpm`; do not change global settings to fix a local layout mismatch.

## Supply public runtime configuration

Create a deployment-specific file such as `frontend-config.json`:

```json
{
  "schemaVersion": 1,
  "applicationName": "My HyperBug",
  "apiBaseUrl": "https://api.example.net",
  "authBaseUrl": "https://auth.example.org",
  "mediaOrigins": ["https://media.example.com"],
  "uploadOrigins": ["https://uploads.example.net"]
}
```

All values are public. Never include credentials, tokens, keys or executable plugin configuration. Origins require HTTPS and cannot contain credentials, paths, query or fragments; loopback HTTP is allowed for local development. The name must be nonempty and at most 100 characters; at most 16 distinct media origins are accepted. Unknown fields and responses over 16 KiB are rejected.

```sh
corepack pnpm --filter @hyperbug/web prepare:deployment --config=/absolute/path/frontend-config.json
```

This replaces `dist/config.json` and generates host-neutral `hosting.json` plus Pages `_headers`/`_redirects`, without rebuilding assets. Config is fetched before API clients are created; missing/invalid config shows a safe startup error.

When origins change, regenerate and publish headers together with config. Config replacement alone leaves old CSP permissions. The backend's exact CORS allowlist must include the frontend origin. The source default config uses placeholder example.net origins; replace it with your deployment configuration.

## Register sign-in and use the account page

On the authorization service, register public client `hyperbug-web`, the exact frontend callback URI `https://YOUR_FRONTEND/oauth/callback`, and scope `public-api`. The client has no secret. Include the exact frontend origin in the backend CORS allowlist. Registration and headers must match the selected deployment origins.

Open Account and choose **Sign in**. Credential entry and consent happen on the authorization service at the top level, so third-party cookies are unnecessary. A reload loses this app’s token; choose Sign in again to recover through the authorization service’s first-party session. Failed or expired callbacks require a fresh attempt. Unavailable capabilities are explained before a dependent action is offered.

**Sign out of this app** asks for confirmation, clears local private state and revokes the app’s bearer token. The authorization service’s first-party session is separate and can remain active. If revocation cannot be confirmed, the app tells you; local state is still cleared and the prior token expires within 15 minutes.

## Generic static hosting

```sh
corepack pnpm --filter @hyperbug/web serve --port=4173
```

Open `http://127.0.0.1:4173/instance?section=limits`. This loopback server demonstrates the policy and is not a hardened production host. On another static host, apply `hosting.json` as HTTP response policy, set correct MIME types and fall back to `/index.html` for application routes. Hide hosting metadata and `.vite/manifest.json`.

| Resource | Cache-Control |
| --- | --- |
| HTML and other unversioned files | `no-cache` |
| `/config.json` | `no-store` |
| Hashed `/assets/*` | `public, max-age=31536000, immutable` |

CSP permits app scripts/styles and exact configured API/auth/media origins; plugin origins require reviewed build-time declarations. There is no unsafe-inline/eval. Other headers block framing and MIME sniffing, set referrer policy and restrict camera/microphone/geolocation. Configure TLS at the hosting boundary.

## Cloudflare Pages preview

Use an explicitly authorized preview project. Prepare config, then deploy the same directory to a branch distinct from the project's production branch:

```sh
corepack pnpm exec wrangler pages deploy apps/web/dist --project-name=YOUR_PREVIEW_PROJECT --branch=foundation
```

Pages consumes the generated headers/redirects; no Functions directory exists. Preserve `! Cache-Control`: it detaches overlapping defaults before setting config/asset overrides. Test exact preview-origin CORS. Use a disposable project and clean all its owned resources after evaluation.

## Verify and roll back

Open `/` and directly refresh `/instance?section=limits` on both hosts. Confirm the name/capabilities come from the selected API, config finishes before the first API request and unavailable capabilities remain unavailable. Replace config and regenerate headers, reload, then confirm the new name/API origin with unchanged asset hashes. Inspect actual HTML/config/asset response headers.

Access tokens stay in memory. Reloading requires a new top-level sign-in; expiry, denied access and app sign-out clear private cached data and unsaved drafts. Keyboard, VoiceOver, zoom and Safari navigation have manual verification, with automated Chrome and touch-emulation evidence; this does not claim every device or assistive-technology combination. For rollback, restore a matching build, public config and hosting policy together; retain hashed assets needed by already-open pages.

## Source references

[Static web plan](https://github.com/EIHRTeam/HyperBug/blob/main/docs/plan/modules/11-static-web-foundation.md); [P1 evidence](https://github.com/EIHRTeam/HyperBug/blob/main/docs/plan/evidence/11-p1-foundation.md); [release checklist](https://github.com/EIHRTeam/HyperBug/blob/main/docs/plan/modules/13-mvp-release-and-operations.md).


## Product upload configuration

`uploadOrigins` is optional public configuration with at most 16 exact HTTPS storage origins (loopback HTTP for local development). Regenerate CSP headers together with config. Storage origins must differ from the frontend/API/authorization origins and contain no credentials, paths, query or fragments. Storage must permit the frontend's direct PUT and multipart requests and expose ETag; never put signed capability URLs into runtime config. Without upload origins, forms explain that uploads are unavailable. `mediaOrigins` configures isolated downloads; processing, release and access checks still apply. Local product upload checks pass for all three profiles. Node uses real local S3-compatible storage; Workers use native local R2 with a test transfer endpoint. These checks do not establish production provider/CORS/scanner acceptance.
