# Module 10 B6 — Standard expectation model, not measured acceptance

Date: 2026-10-11. **Cloudflare Standard is not measured by explicit user decision.** This artifact is an expectation model: not a measurement, not acceptance, not a regression threshold and not an SLO. Every actual Standard acceptance/performance/headroom row remains **not measured**. No paid feature or deployment was provisioned to produce this model.

## Inputs and provenance

- [B5 local measured HTTP baselines](10-performance-readiness.md): real Node24/PostgreSQL18.6 and local workerd/D1; 1,001 read-scale Issues, security/admission/audit active, concurrency1, n20 ordinary requests/n16 successful upload intents/n3 password logins. R2/S3 are emulated in these integrated journeys. Local Standard password login retains Argon2id; its wall latency includes hashing and cannot isolate Worker CPU.
- [Minimum assessment](10-minimum-quota-assessment.md): B15 actual peppered PBKDF2 login CPU20–47ms, and R14 native Cron interruption9ms/resume6ms/maximum dispatch9ms. Samples have earlier-source/instrumentation/billing-attribution limits; they cannot be labelled paid Standard or Argon2id results.
- [ADR0007](../../decisions/0007-cloudflare-free-minimum-tier.md) and [FREE-TIER-PROFILE](../../FREE-TIER-PROFILE.md): recorded tier policy, daily Minimum budgets and mandatory controls. [ADR0012](../../decisions/0012-cloudflare-minimum-formal-profile.md) supersedes historical gate/password exclusions; [ADR0014](../../decisions/0014-minimum-title-search.md) makes Minimum title-only while Standard searches title/body. These are product policy inputs, not paid capacity measurements.
- Official limits/pricing below, queried with Context7 on2026-10-11 (resolve then query): Workers `/llmstxt/developers_cloudflare_workers_llms-full_txt`, Queues `/websites/developers_cloudflare_queues`, Workflows `/websites/developers_cloudflare_workflows`. Exact limit-table gaps were checked against official Markdown. Dated older ADR provider statements remain historical; no normative baseline is edited.

## Current documented envelope

| Resource | Minimum/Free documented limit | Paid Standard documented limit or allowance | Interpretation |
| --- | --- | --- | --- |
| HTTP Worker CPU | 10ms/invocation | Default30s, configurable maximum300s | Active CPU, not network waiting or a target latency. Larger budget prevents some CPU refusals; it does not accelerate code. |
| Cron CPU | Free10ms | Interval below1hour:30s; at least1hour:15minutes | The limits table is more precise than the pricing summary. No configuration change is made. |
| Isolate memory/connections | 128MB;6 concurrent connections waiting for response headers | Same128MB/6 | Paid CPU does not enlarge memory or this I/O limit. Shared isolate concurrency can amplify pressure. |
| External subrequests | 50/invocation | Default10,000; configurable up to10million | Provider maxima do not authorize increasing application fan-out/bounds. |
| Worker requests/CPU billing | 100,000requests/day hard Free allowance | Included10million requests/month and30million CPU-ms/month | Paid inclusions are billing allowances; excess is billed, not a demonstrated capacity ceiling. |
| Queue operations/retention | 10,000ops/day;24h retention | Included1millionops/month; default4days, maximum14days | Write/read/delete typically3ops per delivered message. Retries add operations. |
| Queue transport limits | 128KB messages; batches100; throughput5,000messages/s | Same cited limits; up to250 concurrent push consumers | These are provider limits, not HyperBug's measured dispatch service rate. |
| Workflow running concurrency | 100 | Table50,000; prose on the same page10,000 | **Unresolved official conflict.** Use conservative10,000 only as a modeling assumption; do not claim the account's effective entitlement. Waiting instances excluded. |
| Workflow CPU/steps/output/retention | 10ms/step;1,024steps;1MiB result/event;3-day completed state | Default30s/max5min; default10,000steps/configurable25,000;1MiB result/event;30-day completed state | Paid durability/compute allowances do not prove replay or recovery throughput. |

Official sources: [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [Queues limits](https://developers.cloudflare.com/queues/platform/limits/), [Queues pricing](https://developers.cloudflare.com/queues/platform/pricing/), [Workflows limits](https://developers.cloudflare.com/workflows/reference/limits/). Provider/account entitlements must be rechecked before a future deployment.

## Derivation and uncertainty scenarios

### Latency and CPU

There is no defensible paid p50/p95/p99 extrapolation from local wall latency. A paid request includes regional D1/R2/network waits, cold/warm scheduling, full title/body indexing, admission and audit. Their distributions are unmeasured. The workerd local observed p95s (list4.786ms/detail3.414ms/search7.816ms/bearer1.335ms/password20.841ms/create6.351ms/comment6.793ms/upload6.214ms) are **inputs only**, never paid estimates or thresholds. No numeric paid latency confidence interval can be established.

For a transparent CPU-envelope sensitivity model, let `c` be hypothetical CPU per complete request and use scenarios `c=3,9,30ms`. Three is an analyst-selected light-work case, nine is informed only by the earlier native Minimum dispatch witness, thirty is an analyst-selected heavier-work case. These are not measurements of Standard requests. At the documented default30,000ms budget, `30,000/c` is respectively10,000/3,333/1,000 times the assumed work cost; this is budget margin arithmetic, **not throughput**, concurrency or safety evidence. Argon2id cost is unknown on actual paid Workers and stays mandatory at the unchanged baseline. PBKDF2 observations cannot estimate it.

Using the included30million CPU-ms monthly allowance, `30,000,000/c` yields10million/3.33million/1million same-cost requests before CPU overage. The corresponding request allowance is10million/month, so the smaller arithmetic allowance is1–10million/month across these assumptions. Background work, failures, hashing, heterogeneous requests and cold starts consume more CPU and lower this allowance. This range is a billing sensitivity range, not a sustainable instance capacity or promise. Neither its low nor high endpoint is a measured bound.

### Queues, Workflows and concurrency

Let `a=1,2,3` delivery attempts and approximate `3a` operations per message. Included1million monthly Queue operations then cover `floor(1,000,000/(3a))` =333,333/166,666/111,111 messages. This deliberately simple111,111–333,333 range excludes extra failed reads, fan-out and control operations; actual billing can differ. Daily Free10,000ops arithmetic gives3,333 one-attempt messages, but Minimum does not use Queues for authoritative dispatch. No Queue result is inserted into its acceptance row.

A maximum provider batch100 and250 push consumers permit25,000 simultaneous message slots arithmetically, subject to throughput5,000messages/s and application concurrency/bounds. HyperBug's configured limits remain authoritative; no model changes them. Sustainable delivery rate is unknown without actual provider/database/backlog measurements. Queue retention gives a retry window, not a recovery guarantee.

Workflow active concurrency is modeled conservatively at10,000 because of the contradictory official page;50,000 is only the table's unresolved alternative. If jobs spend fraction `f` actively running, `N*f <= 10,000` is necessary under that assumption, but not sufficient: D1/R2 capacity, step creation rate, CPU, quotas and application admission can bind sooner. Waiting instances do not use active slots. No `f`, service-time distribution or actual Standard completion rate is measured; no numeric job capacity is claimed.

### Minimum inputs do not predict Standard indexing or capacity

R14's maximum-content dispatch9ms/63reads/22writes is a one-event native title-only witness. Under the explicit hypothetical assumption of identical work for every event, daily5million D1 reads divided by63 gives79,365 such events and100,000writes divided by22 gives4,545. They share budgets with every account/Issue/audit operation; neither result is a measured capacity. Standard's full title/body index and Queue/Workflow composition change the work. No paid D1, R2 operation cost, scan cost, storage growth or instance user/Issue ceiling is inferred from these ratios.

## What remains unproven

No actual paid Standard integrated journey, Argon2id CPU/memory, latency distribution, query/row cost, queue lag, object operations, quota headroom, sustainable concurrency or recovery throughput is proven. The official concurrency contradiction is unresolved. Existing functional/local/provider evidence stays at its recorded scope. Measured regression thresholds remain exclusively in [the local baseline set](10-local-regression-thresholds.json); this model is never consumed by the comparator.

Standard remains **not measured** in10.2e/10.2f/10.3b. 10.G2 and global G1 cannot pass using this model; SPA/module11 stays blocked and13.G6 remains open. A future actual paid measurement would require a new user instruction; do not request or provision it during this mission.
