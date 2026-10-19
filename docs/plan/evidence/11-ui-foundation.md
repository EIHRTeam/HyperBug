# Module 11 B2 UI foundation

Date: 2026-10-13. Source-only primitives and plugin descriptors; no product issue form, backend change, new dependency or hosted traffic.

Web source/fixture typecheck, lint and production/separate fixture builds pass using the pinned toolchain. Foundation/plugin unit6 cases pass. [Automated rendered-UI receipt](11-ui-browser.json) records real Chrome155.0.8059.40 with keyboard activation/focus, delayed validation/correction, focused error summary/link, no duplicate live errors, native Cancel/Escape/restore focus, 320px reflow, 200% text enlargement, reduced-motion and emulated touch. No real physical touch or screen-reader result is implied.

Commands: `corepack pnpm --filter @hyperbug/web format|typecheck|lint|build`; `node apps/web/scripts/build-ui-fixture.ts`; `corepack pnpm test:unit tests/unit/web-foundation.test.ts`; `node tests/fixtures/web-ui-browser.mjs PRIVATE_OPTIONS_PATH`. The options file contains test origins/paths only and is removed with the fixture. The production build contains no fixture entry. Scoped formatting/lint/root typecheck and final manual results are recorded in the module log.

Review: fields have native required/length attributes, explicit labels/hints, one interacted/error boolean for both visuals and ARIA, deduplicated messages and a focus-driven summary without competing live regions. Form isTouched changes on value write; use isBlurred/submit gating and revalidate stale blur errors. Dialog showModal supplies native inertness, focus boundaries and Escape; explicit initial Cancel and trigger restoration are verified. Limited closedby/light-dismiss/back gestures are omitted. All plugin UI is source-composed, with frozen unique descriptors and exact origins feeding deployment CSP; JSON cannot inject scripts/plugins. No plugin is installed.

[FRONTEND](../../development/FRONTEND.md) contains current guide IDs, feature status, chosen fallbacks and Context7 references. User-directed manual verification replaces native computer-use tests from the steering message. Safari rendered the fixture/validation before that steering; further native automation stopped. VoiceOver inspection timed out, and no active VoiceOver process was found. Keyboard/speech/zoom/Safari results remain unverified until the user reports them.

Cleanup review: the first fixture stopped after Node's adapter independently closed a listener. Both exact local test certificates (issued within this session, with matching three test SANs) were identified by fingerprints and removed from the keychain; fixture private files and listeners were removed. The runner now removes both trust settings and the certificate and tolerates only ERR_SERVER_NOT_RUNNING. The new held fixture still requires final cleanup.

G1 remains Not passed, Module 10 Blocked, 13.G6 open.

Manual checkpoint: the user subsequently reports all pass for the complete eight-step checklist; see [manual receipt](11-manual-accessibility.json). This includes VoiceOver and Safari navigation. No captured speech transcript or real mobile device result is claimed.
