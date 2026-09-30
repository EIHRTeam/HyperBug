import type { StaffEnrollmentStore } from '@hyperbug/application';
import type { BootstrapEnrollRequest } from '@hyperbug/contracts';
import type { StandardPasswordService } from '@hyperbug/security';
import { canonicalRegistrationHandle } from './account-registration.ts';
import { requireAuthOrigin } from './account-session.ts';
import { constantTimeEquals } from './oauth.ts';
import type { BoundSensitiveActionAdmission } from './sensitive-admission.ts';
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
 * No session is issued; the administrator then signs in through /auth/login.
 * Wrong code, occupied handle or an existing active Staff administrator all
 * answer the same generic denial so the endpoint reveals none of them.
 */
export async function enrollInitialStaff(input: {
  readonly request: Request;
  readonly body: BootstrapEnrollRequest;
  readonly admission: Pick<BoundSensitiveActionAdmission, 'require'>;
  readonly password: StandardPasswordService | null;
  readonly code: string | null;
  readonly store: StaffEnrollmentStore | null;
  readonly requestId?: string | null;
}): Promise<{ enrolled: true }> {
  const { request, body, admission, password, code, store } = input;
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
  try {
    const passwordRecord = await withDeadline(request.signal, 5000, (signal) =>
      password.hash(body.password, signal),
    );
    if (request.signal.aborted)
      throw new RequestFailure('BOOTSTRAP_UNAVAILABLE');
    const outcome = await withDeadline(request.signal, 5000, () =>
      store.enrollStaff({
        principalId: crypto.randomUUID(),
        identityId: crypto.randomUUID(),
        handle,
        passwordRecord,
        nowMs,
      }),
    );
    if (outcome?.status !== 'enrolled')
      throw new RequestFailure('BOOTSTRAP_FORBIDDEN');
  } catch (error) {
    if (error instanceof RequestFailure) throw error;
    throw new RequestFailure('BOOTSTRAP_UNAVAILABLE');
  }
  return { enrolled: true };
}
