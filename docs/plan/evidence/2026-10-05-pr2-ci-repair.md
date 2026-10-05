# PR 2 check repair — 2026-10-05

Scope: repair the three checks explicitly linked by the user on [PR 2](https://github.com/EIHRTeam/HyperBug/pull/2). Keep existing product behavior, Markdown budgets, sanitizer policy and release gates. The user requested “Test less, write more”; use existing focused checks and the required hosted workflows without adding automated cases.

## Failure evidence

Original head: `fff95a56bbf4f1dd3364509bc7b9cf167452e8e1`.

- [PR workerd job](https://github.com/EIHRTeam/HyperBug/actions/runs/37244822292/job/111560512420): 268 passed, two optional-provider skips, one failure. The 100-body Markdown measurement was **8,516.44 ms**, above the existing 8,000 ms ceiling.
- [Push workerd job](https://github.com/EIHRTeam/HyperBug/actions/runs/37244819906/job/111560506034): the same failure, **9,325.17 ms**; 268 passed and two optional-provider skips.
- [CodeQL check](https://github.com/EIHRTeam/HyperBug/pull/2/checks?check_run_id=111560753534): four `js/bad-tag-filter` alerts in shared content assertions and one `js/bad-code-sanitization` alert in the scanner subprocess fixture. The code-scanning API classifies all five as tests. The annotations and source show case-sensitive tag assertions and interpolation of a constant child program, rather than application sanitizer flaws or attacker-controlled process input.

The user's subsequent request to inspect `github-advanced-security[bot]` comments was checked through all PR inline comments, issue comments and reviews. Its five inline comments are exactly the alerts above: [1](https://github.com/EIHRTeam/HyperBug/pull/2#discussion_r4179816428), [2](https://github.com/EIHRTeam/HyperBug/pull/2#discussion_r4179816435), [3](https://github.com/EIHRTeam/HyperBug/pull/2#discussion_r4179816438), [4](https://github.com/EIHRTeam/HyperBug/pull/2#discussion_r4179816444), [5](https://github.com/EIHRTeam/HyperBug/pull/2#discussion_r4179816449). Its only other substantive comment is the [informational code-scanning setup notice](https://github.com/EIHRTeam/HyperBug/pull/2#issuecomment-5730942841); the associated review body is empty. No additional finding, bot reply or manual thread resolution.

## Repair and focused review

Run the Node Markdown measurements in a bounded standalone native Node process. Vitest's Vite module runner rewrites imported bindings into export getters; its own benchmarking guidance explains how that overhead can distort tight-loop measurements. Workerd continues to run the built fixture in Miniflare. Preserve all three maximum-size fixtures, one warmup, five single derivations, 100 sequential derivations, the 1,000/8,000 ms ceilings and cross-runtime adversarial correctness coverage. Log measurements before assertions and label failures by runtime/fixture.

Make shared HTML leakage assertions case-insensitive and match the script/strong tag-name boundary. These remain negative assertions; the application still uses the centralized parser and final tree sanitizer. Replace the scanner test's interpolated JavaScript with fixed literal source while preserving its real TERM-resistant descendant/process-group cleanup journey. No query exclusions, dismissed alerts, widened thresholds, dependency changes, rendered-content cache or application changes.

Changed paths: `tests/fixtures/content-http-contract.ts`, `tests/fixtures/content-projection-contract.ts`, `tests/fixtures/markdown-measurement.ts`, `tests/node/scanner-process.test.ts`, `tests/workerd/markdown.test.ts`, and the owning 01/07 progress records.

## Documentation lookup

Context7 resolve-then-query on **2026-10-05**:

- `/websites/cli_github_manual`: [run inspection](https://cli.github.com/manual/gh_run_view), [PR checks](https://cli.github.com/manual/gh_pr_checks). Used job logs, current head/check metadata and code-scanning annotations/API results.
- `/vitest-dev/vitest`: [benchmarking and module-runner overhead](https://github.com/vitest-dev/vitest/blob/main/docs/guide/benchmarking.md). Current documentation recommends native execution or built artifacts for performance measurements. Installed CLI help confirms `--disableConsoleIntercept`; no new project-wide runner configuration.
- `/remarkjs/remark-rehype`: [raw HTML handling](https://github.com/remarkjs/remark-rehype/blob/main/readme.md). The existing raw parse → sanitize pipeline remains unchanged.

Native Node 24.21.0 profiling of the unchanged source locally measured 100-body pages at 427/2,468/439 ms for plain/GFM/Unicode. The CPU profile is ignored under `.local/ci-fixes/`; it is local diagnostic evidence, not a hosted benchmark, Free CPU claim or production SLO.

## Verification and remaining work

Focused local verification passes on Node **24.21.0**, Vitest **5.0.1**, Miniflare **5.20260926.1-alpha** and real isolated PostgreSQL **18.6**:

- `corepack pnpm exec vitest run --project workerd tests/workerd/markdown.test.ts tests/workerd/issue-route.test.ts tests/workerd/repository.test.ts -t 'matches Node byte-for-byte|records bounded maximum-body|delivers the issue lifecycle|atomically projects issue/comment' --disableConsoleIntercept`: **4 passed / 170 intentionally unselected**. Native Node plain/GFM/Unicode 100-body pages: **331/2,611/435 ms**; local workerd: **290/1,919/355 ms**. Both runtimes preserve maximum code points/bytes and pass the single-body ceilings.
- `corepack pnpm exec vitest run --project node tests/node/scanner-process.test.ts`: **13 passed**; real child and descendant termination retained.
- `node tooling/postgres-test-cluster.mjs node node_modules/vitest/vitest.mjs run --project postgres tests/postgres/issue-route.test.ts tests/postgres/repository.test.ts -t 'delivers the issue lifecycle|atomically projects issue/comment'`: **2 passed / 156 intentionally unselected**.
- `corepack pnpm typecheck`, `corepack pnpm lint`, scoped `oxfmt --check`, local links and `git diff --check`: passed.

Logs remain ignored under `.local/ci-fixes/`. No new automated case or broad local rerun. New-head hosted results are pending. No acceptance gate or checklist is closed by this repair; 01.V4 still requires its complete main-push/open/update evidence, and release acceptance remainders retain their existing scope.

## First hosted repair and singleton-plan correction

Repair commit: `bbc61f20cb29f4ca1977efbc9e0eac272e654274`.

- [CodeQL](https://github.com/EIHRTeam/HyperBug/runs/111621676989) passes with zero annotations/new alerts. The Security API reports all five original alerts **fixed**; the latest PR merge analysis reports zero results (87 rules).
- Both complete workerd jobs pass **269 tests / two optional-provider skips**: [PR](https://github.com/EIHRTeam/HyperBug/actions/runs/37265519606/job/111621410247) and [push](https://github.com/EIHRTeam/HyperBug/actions/runs/37265516543/job/111621401116). Hosted maximum-GFM pages measure native Node **6,258/5,831 ms**, workerd **5,271/4,910 ms**, below the unchanged 8,000 ms budget. Both quality, Node and documentation lanes pass.
- The [PR PostgreSQL job](https://github.com/EIHRTeam/HyperBug/actions/runs/37265519606/job/111621410384) reveals a separate assertion defect: **188 passed / two skips / one failed**. The push PostgreSQL job passes. `measureKeyRegistry` rejected any `Seq Scan`, including a **one-row** scan of `key_registry_control`. The same plan uses all three required indexes on `key_versions`, `protected_records` and `key_backup_references`; the query executes in **0.087 ms**. Its singleton column has both a primary key and `CHECK (singleton = 1)` in the existing migration/schema.

The follow-up reads structured PostgreSQL plan nodes, permits a sequential scan only on that control relation with at most one returned row and zero filtered rows, and retains all required-index, one-statement, fixture-size and large-relation scan checks. Analyze the singleton fixture too so the local test exercises the previously failing plan. D1 assertions, application SQL, schema and migrations are unchanged. This corrects a false performance rejection; it neither forces an index nor hides a large-table scan.

Context7 `/websites/postgresql_18` was resolved and queried on **2026-10-05**. [Official EXPLAIN documentation](https://www.postgresql.org/docs/18/using-explain.html) explains why small tables can favor sequential scans, randomized statistics, plan nesting and actual/filtered row counts.

Focused follow-up: `node tooling/postgres-test-cluster.mjs node node_modules/vitest/vitest.mjs run --project postgres tests/postgres/repository.test.ts -t 'measures fresh registry reads'` — **one passed / 156 intentionally unselected** on real PostgreSQL 18.6. Its actual plan uses the three required indexes and the one-row control scan; one statement per snapshot, local median **0.114 ms** / p95 **0.206 ms**. Typecheck/lint/scoped formatting/diff checks pass. No automated case was added. The next hosted head must be verified before completion.
