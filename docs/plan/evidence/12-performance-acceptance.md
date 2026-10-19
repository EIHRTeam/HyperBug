# Module 12 local performance acceptance

Date: 2026-10-19. Checklist: 12.2g and 12.V6. These are local lab baselines, not hosted latency, field percentiles, a production SLO or G1/13.G6 acceptance.

## Method and integrity

Production static build, Node 24.21.0, PostgreSQL 18.6 or native local workerd/Miniflare/D1, Chrome 155.0.8059.80, desktop 1280×900, cache disabled, no CPU/network throttling. Each profile ran sequentially: three fresh-context cold list/detail pairs followed by one actual Staff login and authenticated create/admin SPA transitions. Each ready state has a fixed 1,500 ms observation window. The standalone web-vitals 6.2.3 attribution build is outside production dependencies; SHA-256 `edcdd0b35ec0af8519681ec3cc665034e619dc221552a3d5480772981967e026`. The collector uses standard session-window CLS and trusted keyboard/click interaction INP reports; soft-navigation/interaction-paint support is feature-detected. All three recorded Chrome runs support it. These APIs are measurement enhancements, not workflow requirements.

Reports: [Node](12-performance-node.json), [Standard](12-performance-standard.json), [Minimum](12-performance-minimum.json). The final rebuild's [manifest and asset hashes](12-bundles.json) validate against disk; every recorded performance asset filename matches this build. Authentication/permissions and real service bounds stay active. No backend clock, quota or security setting is weakened.

## Cold navigation results

Ranges are observed minimum–maximum, not percentile estimates. INP here measures the small trusted interactions exercised by this fixture, not arbitrary typing, device coverage or field responsiveness. A reported zero is retained as the instrument's value.

| Profile | Surface | LCP ms | INP ms | CLS | Ready ms | API / static requests per sample |
| --- | --- | --- | --- | --- | --- | --- |
| node | list | 76–84 | 8–8 | 0.0000–0.0803 | 80.5–114.8 | 6 / 10 |
| node | detail | 88–108 | 8–16 | 0.0009–0.0811 | 82.7–136.8 | 4 / 13 |
| standard | list | 80–92 | 8–24 | 0.0000–0.0080 | 80.7–127.5 | 6 / 10 |
| standard | detail | 80–88 | 0–16 | 0.0150–0.0811 | 101.2–120.3 | 4 / 13 |
| minimum | list | 80–112 | 8–16 | 0.0000–0.0218 | 83.5–134.2 | 6 / 10 |
| minimum | detail | 76–80 | 8–24 | 0.0009–0.0287 | 107.5–128.9 | 4 / 13 |

## Authenticated SPA and large discussion

Authenticated snapshots retain earlier navigation metrics and cumulative requests. Read the metric's path and navigation type rather than treating the whole snapshot as one route. The create/admin rows below use each route's own soft-navigation LCP/CLS and the latest reported INP for that route from the complete session. Request deltas exclude the preceding login/project journey.

| Profile | Create LCP / INP / CLS | Admin LCP / INP / CLS | Create → admin additional API / static requests | Next timeline ready ms / mounted rows / elements |
| --- | --- | --- | --- | --- |
| node | 20.3 ms / 16 ms / 0.0000 | 17.9 ms / 16 ms / 0.0000 | 0 / 2 | 48.1 / 20 / 216 |
| standard | 38.4 ms / 16 ms / 0.0000 | 18.0 ms / 16 ms / 0.0000 | 0 / 2 | 55.6 / 20 / 216 |
| minimum | 40.3 ms / 16 ms / 0.0000 | 23.1 ms / 16 ms / 0.0000 | 0 / 2 | 82.2 / 20 / 224 |

No long tasks were observed in any of the 24 samples. Each profile's create snapshot includes 15 API and 28 static requests accumulated through login/project/create; its admin snapshot includes 15 API and 30 static requests. Cold list uses six API reads (capabilities, project, taxonomy and search); detail uses four (capabilities, issue, timeline and reactions). Optional comment history/reactions and staff tools are requested when opened. There are no automatic refocus/reconnect retries or unbounded timeline prefetches.

The fixture stores 1,000 comments, mounts one 20-row page, moves forward with one timeline API request and returns to 20 rows. The ordinary DOM is 216 elements on Node/Standard and 224 on Minimum after the forward page; no virtualization or content-visibility is warranted by these samples. The separate browser matrix checks focus, scroll anchoring, permalink resolution and narrow layout. Find-in-page continues to use the ordinary visible DOM; older pages require page navigation.

## Bundles and regression investigation

| Route (shared shell/CSS included) | Raw bytes | Sum of independent gzip bytes |
| --- | --- | --- |
| list | 401,633 | 124,115 |
| detail | 479,332 | 145,081 |
| staffDetail | 483,650 | 146,439 |
| create | 480,661 | 145,389 |
| management | 469,039 | 140,188 |
| audit | 470,912 | 141,167 |
| plugins | 462,155 | 139,101 |

The shared app chunk is 341,834 bytes raw / 107,921 gzip; the main product route totals grow beyond Module 11's foundation because they now include Query/Form-driven workflows, transported-tree rendering, upload controls and recovery. Management, triage, audit and plugins remain distinct lazy chunks; no new production dependency or later-module UI is introduced. These totals exclude HTML/config and optional imports unless named; they are not actual hosted transfer sizes.

Early workflow observer sums showed startup shifts around 0.199 and could not prove CLS acceptance. Isolated source attribution identified title/loading/discussion replacements; normal CSS minimum sizes now reserve heading/status/overview space without clipping content. The final cold session-window maximum is 0.0812 (rounded up), with all measured route CLS below 0.1. Residual shifts are recorded rather than hidden. The local cold LCP/INP/CLS values are a baseline for future comparable fixtures; existing web-vitals good bands supply context, not a new service guarantee. No functionality, security or accessibility was removed to improve measurements. Mobile/throttled/field measurements remain outside this local baseline.

## Reproduction

Build with `corepack pnpm build`, then `node tests/fixtures/web-product-bundles.mjs`. Set `HYPERBUG_WEB_VITALS_PATH` to the independently verified standalone attribution build and run `node tooling/postgres-test-cluster.mjs node --import tsx tests/fixtures/web-product-local.ts --profile=PROFILE --performance` for each profile sequentially. The fixture launches the collector, then closes its owned browser/services/private files on success or failure. The metric library is not installed into the app. See the [focused review](12-focused-review.md) for research, compatibility fallbacks and security boundaries.
