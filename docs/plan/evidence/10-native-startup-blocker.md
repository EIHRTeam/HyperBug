# Module 10 — Current production auth composition upload blocker

Date: 2026-10-11. **Confirmed, unresolved.** Source eb5c7f5; Modules04/10. Actual isolated test-account upload using the unchanged production Minimum bundle, registered OAuth client and live D1/R2/volumetric/signing bindings.

## Finding and evidence boundary

Correctly collected ESM chunks pass Wrangler4.144.0 dry-run. Actual Cloudflare module validation refuses the API upload with10021: `Uncaught Error: Invalid OAuth client configuration`. `createCloudflareApi` parses the registered client configuration and then requires env.DB/keyProvider during module evaluation. Cloudflare's upload validation has no live native DB binding. Minimum's existing lazy activation and upload factory explicitly account for this lifecycle, but the OAuth guard does not. The neighboring passkey guard has the same binding-dependent pattern; this is a source-review observation, not an independently measured passkey upload failure.

Earlier B15's measurement wrapper supplied a synthetic DB interface object at module evaluation, masking this guard; this explains why that instrumented composition's prior upload does not prove the unchanged production root deployable with OAuth configured. R14 omitted OAuth clients. No claim that B15's functional measurements were fabricated; their exact wrapper scope remains explicit.

No acceptance HTTP request ran in either failed trial. Trial1 initially missed ESM chunks (10021); corrected isolated trial2 then exposed the auth composition failure. Trial1 cleanup first attempted a forbidden permanent-key deletion (7500), and was repaired through current→revoked→removed. No trigger or protection was relaxed. Final cleanup receipts verify0 owned Workers/domains/active key/counter/identity state, valid FKs,177/181 respective pre-existing rows unchanged; four removed key identities retained per trial. No object/Queue/Workflow was created or external notification sent. Both finite independent cleanup guards have terminated. Private diagnostics/backups remain ignored; ephemeral generated secret copies were removed after verified cleanup, and donor R2 credentials are preserved. [Scalar attempt/cleanup receipt](10-native-upload-attempts.json) records exact artifacts and scope.

## Prepared narrow repair; authorization pending

Reviewable unapplied patch: `/tmp/hyperbug-10-auth-startup-proposal.diff`. Keep client/RP configuration parsing at module scope, but move only OAuth/passkey DB/key-provider prerequisite checks to the first runtime fetch, before any route, upload or tier activation. Missing native resources still refuse every request; malformed static configuration still fails module evaluation. The proposed patch adds no mock adapter, auth bypass, new endpoint, weaker crypto, debug hook or paid capability.

Verification would cover upload-validation composition without live bindings, runtime fail-closed missing bindings and the actual fresh owned production-root upload/auth pilot, plus focused source/security review. The patch is a repair to the Cloudflare Module04 composition lifecycle, beyond the already-authorized page CSP repair. HANDOFF-10 says: “If something outside the list must change — an unrelated defect, a contract gap, a missing capability — stop and report it ... Do not fix it in passing.” The latest user authorization was narrowly for CSP. Therefore the product patch remains unapplied pending explicit scope authorization.

10.2a/f,10.3b/g and10.G2/G4 remain incomplete. Standard remains not measured; global G1 Not passed and SPA blocked. Local Minimum benchmark and browser evidence do not substitute for actual production composition acceptance.
