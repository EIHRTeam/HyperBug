# Cloudflare deployment inputs

Use `apps/api-cloudflare/wrangler.jsonc` and `wrangler-ingress.jsonc` as the source templates. Copy them into an ignored operator directory, resolve their relative `main`, migrations and schema paths, and replace every placeholder before applying. No resource is auto-provisioned by this package. This is prepared configuration, not a published environment.

| Input | Standard | Minimum |
| --- | --- | --- |
| Main | `apps/api-cloudflare/src/index.ts` | `apps/api-cloudflare/src/minimum.ts` |
| DB | Dedicated D1 UUID; independent migration history | Same contract; never reuse another installation's DB |
| Storage | `HYPERBUG_UPLOAD_BLOB` R2 and matching `HYPERBUG_UPLOAD_STORAGE` secret | Same optional pair; partial selection fails |
| Queue | `ASYNC_TASKS` producer and consumer | Remove producer/consumer declarations |
| Workflow | `ASYNC_WORKFLOW` / `HyperBugWorkflow` | Remove workflow declarations |
| Schedule | `*/5 * * * *` | Same schedule, five rotating phases / 25 minutes per phase |
| Tier vars | `standard`, no acknowledgement | `cloudflare-minimum`, `minimum-v2` |
| Ingress | Public ingress with `API` service binding; private API disables workers.dev/previews | Same trust boundary |
| Rate binding | `ABUSE_VOLUMETRIC`, unique reviewed namespace | Same mandatory binding |
| Policy | Exact origins, registered OAuth client, complete passkey RP | Same policy and security invariants |

Set the same private `HYPERBUG_INGRESS_KEY` on ingress and API. Provision `HYPERBUG_KEY_RING`, `HYPERBUG_ABUSE_KEY_RING` and optional `HYPERBUG_BOOTSTRAP_ENROLLMENT` through Worker Secrets, never `vars`. Activate registry references through the existing audited KeyRegistry service before account use. Optional Turnstile requires all three bindings; public test keys are local-only. Storage credentials remain backend-only. Worker configuration does not install a scanner engine/bridge; ready attachments require the separately accepted trusted scanner integration.

Named environments do not inherit every binding: repeat service/D1/R2/rate/queue/workflow/secrets selections explicitly. Preserve compatibility flags, Wasm module packaging for Standard and sampling (production 0.1; required audit remains complete). Never add paid-only `limits.cpu_ms`, Logpush or export to a Free deployment. Do not let a default local environment become a remote production target.

Before an authorized deployment, run the installed Wrangler `deploy --dry-run --config <private-config>` and inspect the emitted bindings/modules. Apply reviewed D1 migrations to the explicitly selected database, provision secrets privately, deploy private API then ingress, and verify exact hostname TLS plus readiness and real bearer/permission flows. This session permits dry-run only for release packaging; remote publication/staging is excluded. Use the bilingual reader guides and `docs/OPERATIONS.md` for the actual verification and recovery boundaries.
