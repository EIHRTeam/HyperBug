# 12 — Public feedback, discussion, and staff web workflows

Phase: MVP frontend  
Prerequisites: 11 complete; only consume capabilities accepted in 10.  
Progress: [Session log and current status](../progress/12-web-product-workflows.md)  
Protocol: [Mandatory execution and handoff rules](../EXECUTION.md)

## Outcome and scope

Deliver the whole public feedback and staff triage journey through the accepted public API.

## Ordered checklist

### Step 12.1 — Implement discovery and navigation

- [ ] **12.1a** Build project selection/landing, paginated Issue lists, label/type/milestone summaries, loading/empty/error states, and stable Issue-number links.
- [ ] **12.1b** Bind search/filter/sort state to validated URLs; support refresh, sharing, bookmarking, and browser back/forward.
- [ ] **12.1c** Integrate the structured search API with debouncing/cancellation, safe syntax errors, limits, and stale-response protection.
- [ ] **12.1d** Reuse Query caches and prefetch only when useful; avoid duplicate requests, serial waterfalls, and unlimited page accumulation.

### Step 12.2 — Implement Issue submission and discussion

- [ ] **12.2a** Build template selection, every supported Issue Form field, accessible labels/help, native constraints, server-error mapping, and deterministic Markdown preview through the centralized sanitizer.
- [ ] **12.2b** Apply the retrieved forms/error-announcement guidance: validation after interaction, coordinated ARIA, actionable error summary/focus, paste/autofill support, and IME-safe submission.
- [ ] **12.2c** Implement upload intent → direct PUT/multipart → finalize with progress/cancel/retry, quota/type errors, expired capability recovery, and safe attachment preview/download.
- [ ] **12.2d** Handle stale form versions, network failures, expired login, and duplicate submission using backend idempotency. Define a privacy-aware draft policy separate from token storage.
- [ ] **12.2e** Build Issue detail, sanitized body, mixed paginated timeline, comment edit history/permalinks, reactions, and moderation/redaction states.
- [ ] **12.2f** Preserve focus, scroll anchoring, and deep-link navigation while loading older timeline pages; avoid a DOM that grows without bound.
- [ ] **12.2g** Profile large discussions before adding rendering optimization. If using content-visibility, apply it only to confirmed offscreen blocks, reserve intrinsic size, and verify keyboard/find-in-page behavior and fallback.

### Step 12.3 — Implement triage and administration

- [ ] **12.3a** Build label/assignee/type/milestone management and close/reopen/reason interactions using actual permission-aware APIs.
- [ ] **12.3b** Build project settings, Issue Form/template management, role management, audit browsing, plugin configuration/enable/disable, and account session controls.
- [ ] **12.3c** Require visible confirmation and recent authentication where policy requires it; safely handle permission loss and concurrent edits with clear conflict recovery.
- [ ] **12.3d** Redact secret settings, prevent accidental secret reads, and display plugin trust/CSP requirements accurately.
- [ ] **12.3e** Keep optional providers and admin tooling in separate lazy chunks; do not add deferred relations/notifications/bulk screens before their backend increments.

## Verification and acceptance

- [ ] **12.V1** Run Playwright journeys for anonymous visitor, Public User, Triage, Maintainer, and Administrator against each backend profile.
- [ ] **12.V2** Cover search/share/back navigation, all form fields, upload retry, create/comment/react, triage, close/reopen, and timeline permalinks.
- [ ] **12.V3** Test expired/revoked auth, stale edits, offline/network failure, duplicate retries, disabled plugins, API errors, and permission changes.
- [ ] **12.V4** Check WCAG 2.2 AA targets with automated checks plus manual keyboard/screen-reader, touch, 200% zoom, contrast, and reduced-motion testing.
- [ ] **12.V5** Re-run the Markdown corpus through actual browser rendering and test isolated dangerous-file downloads and CSP.
- [ ] **12.V6** Record list/detail/create/admin bundles, LCP/INP/CLS, long tasks, request counts, and large timeline behavior; investigate regressions without weakening functionality.

## Source coverage

PRODUCT §§6–24, 29; ARCHITECTURE §§12–21, 39; SECURITY §§46–66, 99–105, 132–141; PERFORMANCE §§25–32, 62–77.
See [Modern web research and adaptations](../SOURCES.md#modern-web-guidance).

