import type { StaffEnrollmentStore } from '@hyperbug/application';
import type { BootstrapEnrollRequest } from '@hyperbug/contracts';
import { auditEvent, type AccountPasswordService } from '@hyperbug/security';
import { withAtomicAudit, auditRequestId } from './audit-emit.ts';
import { canonicalRegistrationHandle } from './account-registration.ts';
import { requireAuthOrigin } from './account-session.ts';
import { constantTimeEquals } from './oauth.ts';
import type {
  AuditAppend,
  BoundSensitiveActionAdmission,
} from './sensitive-admission.ts';
import { withDeadline } from './bounds.ts';
import { RequestFailure } from './errors.ts';

const accountRule = Object.freeze({
  limit: 5,
  windowMs: 3_600_000,
  retentionMs: 86_400_000,
});
const ipRule = Object.freeze({
  limit: 20,
  windowMs: 3_600_000,
  retentionMs: 86_400_000,
});

/** Operator-channel one-time code: version prefix plus 256-bit base64url. */
const enrollmentCodePattern = /^hbbs1_[A-Za-z0-9_-]{43}$/;

export function parseBootstrapEnrollmentCode(value: unknown): string | null {
  return typeof value === 'string' && enrollmentCodePattern.test(value)
    ? value
    : null;
}

/**
 * Single-shot initial Staff enrollment through the operator-channel code.
 * On the standard profiles no session is issued; the administrator then
 * signs in through /auth/login. On the minimum tier, where the reviewed
 * floor disables password login, the composition root issues the first
 * session from the returned facts so the operator can register a passkey.
 * Wrong code, occupied handle or an existing active Staff administrator all
 * answer the same generic denial so the endpoint reveals none of them.
 */
export async function enrollInitialStaff(input: {
  readonly request: Request;
  readonly body: BootstrapEnrollRequest;
  readonly admission: Pick<BoundSensitiveActionAdmission, 'require'>;
  readonly password: AccountPasswordService | null;
  readonly code: string | null;
  readonly store: StaffEnrollmentStore | null;
  readonly auditAppend: AuditAppend | null;
  readonly requestId?: string | null;
}): Promise<{ enrolled: true; principalId: string; identityId: string }> {
  const {
    request,
    body,
    admission,
    password: rootPassword,
    code,
    store,
  } = input;
  const password = rootPassword?.forRequest?.(request) ?? rootPassword;
  requireAuthOrigin(request);
  if (!password || !code || !store)
    throw new RequestFailure('BOOTSTRAP_UNAVAILABLE');
  const handle = canonicalRegistrationHandle(body.handle);
  const nowMs = Date.now();
  await admission.require({
    request,
    category: 'registration',
    checks: [
      { dimension: 'account', canonicalSubject: handle, rule: accountRule },
      { dimension: 'ip', rule: ipRule },
    ],
    nowMs,
    signal: request.signal,
    timeoutMs: 1000,
    captchaAction: 'bootstrap',
    ...(input.requestId === undefined || input.requestId === null
      ? {}
      : { requestId: input.requestId }),
  });
  const presented = parseBootstrapEnrollmentCode(body.enrollmentCode);
  const matches =
    presented !== null && (await constantTimeEquals(presented, code));
  if (!matches || request.signal.aborted)
    throw new RequestFailure('BOOTSTRAP_FORBIDDEN');
  let facts: { principalId: string; identityId: string };
  try {
    const passwordRecord = await withDeadline(request.signal, 5000, (signal) =>
      password.hash(body.password, signal),
    );
    if (request.signal.aborted)
      throw new RequestFailure('BOOTSTRAP_UNAVAILABLE');
    const principalId = crypto.randomUUID();
    const identityId = crypto.randomUUID();
    const audit = auditEvent({
      id: crypto.randomUUID(),
      projectId: null,
      actorId: null,
      systemActor: 'core.identity',
      action: 'account.enrolled',
      targetId: principalId,
      result: 'success',
      requestId: auditRequestId(input.requestId),
      createdAt: nowMs,
      metadata: { v: 1 },
    });
    const outcome = await withAtomicAudit(request.signal, 5000, () =>
      store.enrollStaff(
        {
          principalId,
          identityId,
          handle,
          passwordRecord,
          nowMs,
        },
        audit,
      ),
    );
    if (outcome?.status !== 'enrolled')
      throw new RequestFailure('BOOTSTRAP_FORBIDDEN');
    // The operator-channel enrollment is the one audited account creation.
    facts = { principalId, identityId };
  } catch (error) {
    if (error instanceof RequestFailure) throw error;
    throw new RequestFailure('BOOTSTRAP_UNAVAILABLE');
  }
  return { enrolled: true, ...facts };
}
