# Module 10 — Current local Minimum performance supplement

Date: 2026-10-11. Profile `cloudflare-minimum`; local workerd/D1/R2 emulation on macOS ARM64. Node24.21.0, pnpm11.26.0, Vitest5.0.1. **Not actual Free CPU/billing or sustainable instance-capacity evidence.** Standard stays not measured by user decision.

The existing full authenticated MVP journey supplies the staff/reporter/peer, actual peppered PBKDF2 with50,000 iterations/ten-slot bound, durable lockout, audited tier activation, current authorization, Markdown/audit/timeline/outbox and actual quota controls. No product/security parameter changed. Storage/scanner orchestration is explicitly manual/synthetic, as in the existing matrix.

Read fixture:11 seeded Issues (one genuine form-created Issue plus ten synthetic read-scale copies), list100, title-only search10, explicit index backfill10 per page, concurrency1. After20 measured API creations there are31 Issues. Ordinary paths use20 samples, password login including hash3, successful upload reservations16 and expected quota refusal409s4. Responses are fully consumed, nearest-rank warm loopback quantiles. At n20 p99 is the observed maximum; at n3 p95/p99 are the maximum. These are observations, not sustained tails/SLOs.

| Path | p50 / p95 / p99 ms | Samples |
| --- | --- | --- |
| list | 3.568 / 4.474 / 4.580 | 20 |
| detail | 4.198 / 5.751 / 6.796 | 20 |
| search | 6.880 / 8.265 / 8.274 | 20 |
| auth-bearer | 1.676 / 3.111 / 3.133 | 20 |
| password-login-including-hash | 8.108 / 8.417 / 8.417 | 3 |
| create | 7.231 / 9.251 / 10.056 | 20 |
| comment | 6.003 / 7.460 / 8.786 | 20 |
| upload-intent | 5.189 / 8.664 / 8.664 | 16 |
| upload-intent-quota-refusal | 8.469 / 8.863 / 8.863 | 4 |

All expected success statuses pass; each path's server5xx rate0. [Scalar receipt](10-workerd-d1-minimum-local-http-baseline.json) includes all samples and orchestration-process CPU/memory; it excludes workerd child/isolate CPU/memory. Query plans/counts/rows and native dispatch are separately attributed in the [performance report](10-performance-readiness.md). No queue-lag or object-transfer metric is fabricated; upload reservations do zero PUT/GET/HEAD/DELETE and transfer0 bytes. None of these timings are comparable to the1,001-Issue full-text Standard/Node fixtures as a tier speedup.

## Command, failures and review

```sh
CI=true HYPERBUG_ACCEPTANCE_BENCHMARK=1 HYPERBUG_ACCEPTANCE_TIER=minimum corepack pnpm test:workerd tests/workerd/acceptance-journey.test.ts --reporter=verbose
```

Corrected final run:1pass,4.18s total/1.183s test. Initial21-Issue seed exhausted the unchanged conservative index-write reservation: the existing journey and three10-item backfills each reserve5,120 writes, exceeding20,000 total. This is application reservation saturation, not provider daily-quota exhaustion or a sustainable data-size ceiling. Smaller11-Issue fixture fits. The next run correctly indexed but requested search20 and received400 because Minimum supports10; corrected only the benchmark request. Neither failure publishes a baseline or changes product limits. No unchanged broad lane is repeated.

Focused primary security/performance review: no production import, bypass, threshold widening, crypto tuning, unbounded load or provider relabeling. Standard defaults remain1,001 Issues/25-index page/20-search results. Minimum receipt has its own profile/fixture and is not merged into Standard. [Regression artifact](10-local-regression-thresholds.json) adds only measured local Minimum p95/p99 investigation margins (2× rounded upward to0.001ms),0 server5xx and minimum sample counts. Existing two profiles' margins are unchanged. The unchanged comparator checks exact profile/runtime/fixture, preventing native/Standard cross-comparison. Comparator self-comparison is consistency only, not another benchmark. Owned Miniflare teardown completes; no hosted resource from this lane.

10.3b remains incomplete for actual profile metrics and billing;10.3g remains incomplete for sustainable capacity. The separate [production-root startup blocker](10-native-startup-blocker.md) currently prevents the uninstrumented native auth pilot; no native request result is inferred from this local pass.
