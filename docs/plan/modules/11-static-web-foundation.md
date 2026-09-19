# 11 — Static web application, authentication client, and UI foundation

Phase: MVP frontend  
Prerequisites: 10.G1–10.G5 all complete.  
Progress: [Session log and current status](../progress/11-static-web-foundation.md)  
Protocol: [Mandatory execution and handoff rules](../EXECUTION.md)

## Outcome and scope

Create a portable static application that consumes the accepted backend, with accessible components and independently deployable runtime configuration.

## Ordered checklist

### Step 11.1 — Establish the static application

- [ ] **11.1a** Read the development guidance and refresh Context7 documentation for the selected React/TanStack/Vite/UI stack; search/retrieve modern-web-guidance before relevant web implementation.
- [ ] **11.1b** Scaffold `apps/web` using React 19, TypeScript 7, Vite latest stable, TanStack Router/Query/Form, Tailwind CSS 4, shadcn/ui, and Base UI at verified locked versions.
- [ ] **11.1c** Produce generic static `dist/` output with route splitting, hashed assets, and the Baseline Widely Available build target. No SSR, Pages Functions, or required host-specific proxy.
- [ ] **11.1d** Load a validated public `config.json` before initializing API access. Support API/application-name changes without recompilation, safe failure UI, and fresh config/index versus immutable asset caching.
- [ ] **11.1e** Define state ownership: Router for shareable query state, Query for server state, Form for forms, React for local UI, and minimal ephemeral global state only when justified.
- [ ] **11.1f** Establish deployment-generated CSP/security headers consistent with runtime API/auth/media origins and reviewed plugin declarations.

### Step 11.2 — Implement the browser auth boundary

- [ ] **11.2a** Implement top-level Authorization Code + PKCE S256 with per-attempt state/verifier and validated callback/return routes using the accepted backend protocol.
- [ ] **11.2b** Keep access tokens only in memory. If a redirect requires transient state/verifier storage, define a short-lived one-shot policy, clear it after callback, and never put tokens there.
- [ ] **11.2c** Implement expiry, revocation, logout, and top-level login recovery without persistent refresh tokens or hidden-iframe/third-party-cookie assumptions.
- [ ] **11.2d** Clear or partition user-specific Query caches on identity/permission changes and logout; handle expired auth during edits without leaking drafts between principals.
- [ ] **11.2e** Use the public API client with `credentials: "omit"` for business calls; keep authorization-service cookie flows separate.

### Step 11.3 — Build accessible reusable UI primitives

- [ ] **11.3a** Establish semantic landmarks, navigation, headings, labels, buttons, links, focus styles, responsive layout, contrast, zoom, and reduced-motion behavior.
- [ ] **11.3b** Implement field/error/loading/empty/permission-denied states. Synchronize visual validation with ARIA after interaction; use error summaries and avoid duplicate announcements.
- [ ] **11.3c** Choose native dialog or an accessible Base UI primitive per use case. Verify initial focus, Escape, explicit close/cancel, and focus restoration; newer dismissal gestures remain optional.
- [ ] **11.3d** Record a feature compatibility ledger with guide IDs and fallbacks. Newly Available/Limited features cannot block the core issue workflow.
- [ ] **11.3e** Wire only build-time trusted plugin UI descriptors and checked CSP origins. Reject arbitrary runtime JavaScript configuration.

## Verification and acceptance

- [ ] **11.V1** Serve the same build from a generic static server and Cloudflare Pages preview, including direct deep links and runtime config replacement.
- [ ] **11.V2** Test cross-site login/refresh/logout with third-party cookies blocked and inspect browser storage, URLs, logs, and caches for credential leaks.
- [ ] **11.V3** Run keyboard, screen-reader, touch, zoom, reduced-motion, and baseline-browser checks on navigation, forms, and dialogs.
- [ ] **11.V4** Inspect CSP violations and bundle splitting; record initial bundle/CWV measurements as baselines rather than unsupported promises.

## Source coverage

ARCHITECTURE §§7–21, 36–39; TECH-STACK §§31–36; SECURITY §§7–20, 40–61, 120–123, 132–136; PERFORMANCE §§25–34.
See [Modern web research and adaptations](../SOURCES.md#modern-web-guidance).

