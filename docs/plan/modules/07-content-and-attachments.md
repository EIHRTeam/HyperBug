# 07 — Markdown policy, issue forms, templates, and attachments

Phase: MVP backend  
Prerequisites: 06 complete; cleanup job contracts from 02/05, execution completed in 09.  
Progress: [Session log and current status](../progress/07-content-and-attachments.md)  
Protocol: [Mandatory execution and handoff rules](../EXECUTION.md)

## Outcome and scope

Complete safe public content submission and direct uploads across R2 and S3, with shared server validation and rendering policy ready for the SPA.

## Ordered checklist

### Step 07.1 — Implement the canonical Markdown pipeline

- [ ] **07.1a** Write `docs/MARKDOWN-POLICY.md` with a versioned element/attribute/URL allowlist and raw Markdown as canonical data.
- [ ] **07.1b** Implement GFM → raw HTML parsing → final tree sanitization → safe representation in `packages/security/markdown`; avoid separate allowlists in features or notification channels.
- [ ] **07.1c** Strip dangerous elements/attributes/schemes, unapproved SVG/MathML, and DOM-clobbering vectors; bound body size, nesting, and processing time.
- [ ] **07.1d** Choose click-to-load external images initially unless a secure image proxy is justified; document referrer/privacy behavior and attachment URL handling.
- [ ] **07.1e** Include sanitizer policy version in any rendered cache key and define invalidation/re-rendering after a policy update.

### Step 07.2 — Implement forms and templates

- [ ] **07.2a** Implement versioned project-owned Markdown templates and structured Issue Form schemas.
- [ ] **07.2b** Support Text, Textarea, Select, Multi-select, Checkbox, Boolean, Attachment, and Markdown Notice with stable field IDs and bounded options/nesting.
- [ ] **07.2c** Validate required fields, lengths, cardinality, allowed values, attachment ownership, and active schema version on the server.
- [ ] **07.2d** Generate deterministic Markdown while retaining necessary structured answers and form-version identity; define how drafts/submissions behave when a form changes.
- [ ] **07.2e** Add staff management APIs, audit, schema compatibility rules, and malformed/adversarial schema fixtures.

### Step 07.3 — Implement portable attachment storage

- [ ] **07.3a** Implement BlobStore with R2-binding and S3-compatible adapters: put/get/head/delete, streaming, multipart create/upload/complete/abort, and temporary upload/download authorization.
- [ ] **07.3b** Implement upload intents bound to principal, project, opaque object key, expiry, quota reservation, maximum size, content type, and intended content association.
- [ ] **07.3c** Issue short-lived direct upload capabilities and configure exact storage CORS origins/headers. Keep S3 signing credentials on the backend and ordinary API requests free of file buffering.
- [ ] **07.3d** Finalize by reauthorizing, verifying actual size/type/magic bytes where practical, quota, object identity, and intent state; handle duplicate finalize and concurrent quota use.
- [ ] **07.3e** Resolve overwrite/TOCTOU risk explicitly: use an immutable verified object/version or a verified staging-to-final promotion strategy compatible with both adapters. Do not assume a signed PUT is single-use or enforces every declared constraint.
- [ ] **07.3f** Implement quarantine/release/reject states and scanning hooks. Clearly distinguish unscanned from scanned files.
- [ ] **07.3g** Serve user media from an isolated origin, authorize non-public downloads, and force dangerous HTML/SVG/XML/script types to download with nosniff and safe Content-Disposition.
- [ ] **07.3h** Implement bounded orphan/expired-intent/multipart cleanup handlers and quota release; wire scheduling in 09. Keep filesystem storage limited to development/recovery.
- [ ] **07.3i** Make multipart thresholds adapter configuration, define resume/abort behavior, and publish provider compatibility results only after tests.

## Verification and acceptance

- [ ] **07.V1** Run a malicious Markdown corpus including encodings, malformed nesting, event attributes, unsafe URLs, SVG/MathML, and clobbering on both runtimes.
- [ ] **07.V2** Exercise every form field, stale schemas, unauthorized template edits, invalid attachments, and deterministic Markdown generation.
- [ ] **07.V3** Run PUT/GET/HEAD/DELETE, presigned PUT/GET, metadata, multipart/abort, content type, checksums where used, and large streaming tests against R2 and the selected S3 test service.
- [ ] **07.V4** Reject expired/replayed intents, wrong-project uploads, quota races, misleading MIME/size, and post-finalize overwrite attempts; verify cleanup can safely resume.
- [ ] **07.V5** Confirm API responses/logs expose neither signing credentials nor reusable private download capabilities unnecessarily.

## Source coverage

PRODUCT §§17–22; TECH-STACK §§14–23, 49; SECURITY §§53–66, 99–109, 142–145, 152–153; PERFORMANCE §§35–38, 71–72.

