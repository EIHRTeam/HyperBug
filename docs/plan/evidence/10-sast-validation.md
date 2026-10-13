# Module 10 B1 — hosted SAST evidence

Lookup/verification: 2026-10-11. Source: actual GitHub REST API, not local emulation.

`01.3f` is met. `.github/workflows/codeql.yml` is committed; JavaScript/TypeScript uses `build-mode: none`, default queries (no explicit custom suite), and `github/codeql-action@v4`. Only the analyze job holds `security-events: write`, with `packages`, `actions` and `contents` read. The backend workflow has no extra security-events scope. Push targets main; PR activity targets main with opened/synchronize/reopened. No schedule is configured.

- [Hosted run 37266055745](https://github.com/EIHRTeam/HyperBug/actions/runs/37266055745): pull_request, head f13d7f17971bfe7d4bf3b604c38c5287092b4b8d, completed/success; job 111623017334 initialization/analysis/upload succeed.
- Latest Security analysis 1931226057: refs/pull/2/merge, commit c364e5369a5baa20fbae9a806d0a1d92c782312e, created 2026-10-11T10:09:28Z; 87 rules, zero results, empty error. Open alerts query returns `[]`. This proves uploaded Security results without inventing a visual Security-tab inspection.
- [Prior open/update and fixed-alert evidence](2026-10-05-pr2-ci-repair.md) is reused for unchanged workflow behavior.

Exact read-only checks: `gh api repos/EIHRTeam/HyperBug/actions/runs/37266055745`, `gh api repos/EIHRTeam/HyperBug/code-scanning/analyses?per_page=3`, `gh api repos/EIHRTeam/HyperBug/code-scanning/alerts?state=open&per_page=100`; connector fetch_workflow_run_jobs independently confirms the job. Plain sandbox gh could not reach the API; the approved network read succeeded. No secret-bearing payload recorded.

`01.V4` remains unmet: PR evidence does not prove a main-push run. PR #2 is open, feat/v1 → main; no merge or main push performed. The user's decision is pending. No gate opens.

## User equivalence decision (2026-10-11)

The user explicitly closes 01.V4 by treating hosted PR execution of the same committed workflow, source, default queries, job-local permissions and Security uploads as equivalent to its main-push half. This is an acceptance re-scope, not main execution evidence. No main push or PR #2 merge occurs. Residual risk: a default-branch/GitHub-side trigger problem remains untested until the first real main push.
