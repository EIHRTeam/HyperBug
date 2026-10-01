# Frontend development

Read for product SPA work and backend-owned HTML/auth fixtures. First inspect G1 in [master progress](../../../../docs/plan/PROGRESS.md). Before G1 passes, work on the relevant backend contract/test fixture; do not scaffold the product SPA. A post-MVP feature needs its own backend acceptance before UI work.

## Research and compatibility

Follow root Context7 rules for the selected React/TanStack/Vite/UI APIs. Use the available modern-web-guidance skill before relevant HTML/CSS/client-side work: action-oriented search, relevant guide retrieval, then implementation/fallback review. Use its current instructions rather than hard-coding an old skill-version command here.

Record guide IDs, lookup date, feature status, and fallback in the owning progress entry or linked design record. If guidance is unavailable, record the gap; do not claim compliance based on a remembered guide.

The project baseline is Baseline Widely Available and WCAG 2.2 AA. Newly Available features require detection and usable fallback; Limited Availability cannot become a core dependency without the specified decision/review. Avoid blanket polyfills. Browser support does not replace keyboard, screen-reader, touch, zoom, contrast, and reduced-motion checks.

## Static application and state

The build must run on generic static hosting and Cloudflare Pages without SSR, Pages Functions, or a mandatory proxy. Runtime configuration contains public values only and can change the API origin without recompilation. Align deployment CSP with configured API/auth/media origins.

Use Router for URL/navigation state, Query for remote state, Form for form state, and React for local UI. Preserve shareable filters/sort/search, back/forward behavior, request cancellation, and bounded cache/page accumulation. Invalidate or partition user-specific state on identity changes.

Browser access tokens remain in memory; no localStorage, sessionStorage, IndexedDB, or persistent refresh token. Use top-level PKCE recovery and business API requests with omitted credentials. Short-lived one-shot redirect state/verifiers are distinct from access tokens and follow module 11's policy. Cookie-backed authorization pages retain their own CSRF defenses.

## Forms, content, and interaction

Use semantic controls, visible labels, associated help/errors, server-error mapping, and deliberate focus management. Coordinate visual/ARIA validation after interaction, handle IME composition, and keep drafts recoverable without leaking them across principals. Browser validation does not replace backend validation.

Render Markdown through the shared versioned sanitizer after raw HTML parsing; never introduce a separate feature allowlist. Upload directly through the accepted intent/finalize protocol and show safe retry/expiry/quota outcomes.

Native dialogs or established accessible primitives must provide focus placement/restoration, Escape where appropriate, and explicit close/cancel. Additional platform dismissal gestures are progressive enhancements.

Profile long timelines before optimizing. If applying content-visibility to confirmed offscreen content, reserve intrinsic size, verify sequential keyboard/find-in-page behavior, and retain ordinary rendering without support. Keep optional provider/admin resources out of the initial bundle when practical.

## Adapt guidance to HyperBug

Do not copy guide examples that add SSR fallback, cookie-based business authentication, inline script handlers, relaxed CSP, or a second sanitizer. Reviewed provider SDK origins differ from arbitrary remote plugin JavaScript. Native plugin UI is build-time composition.

Sources: ARCHITECTURE §§7–21, SECURITY §§7–20, 40–61, and PERFORMANCE §§25–34 via [SOURCES](../../../../docs/plan/SOURCES.md). Apply [testing](testing.md) and [session handoffs](session-handoffs.md) to close the work.

